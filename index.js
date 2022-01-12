;(async () => {
  const scraperapiClient = require('scraperapi-sdk')('')
  const fs = require('fs')
  const pLimit = require('p-limit')

  const params = {
    // render: true,
    country_code: 'fr',
    autoparse: true
  }

  const searchKey = ''

  const limit = pLimit(4)

  let allRelatedSearches = []
  let allOrganicResults = []
  let searchFailedList = []

  const start = Date.now()

  function scrapGoogle(searchKey, params) {
    const url = `https://www.google.com/search?q=${searchKey}&hl=fr&gl=fr`
    return scraperapiClient.get(url, params)
  }

  try {
    const data = await scrapGoogle(searchKey, params)
    const parsedData = JSON.parse(data)
    console.log(parsedData)

    if (parsedData.search_information.total_results > 0 && parsedData.related_searches.length > 0) {
      const relatedSearches = parsedData.related_searches.map((relatedSearch) => relatedSearch.query)
      console.log(relatedSearches)

      if (parsedData.organic_results.length > 0) allOrganicResults.push(...parsedData.organic_results.map((organic_res) => organic_res.link))

      try {
        let promises = relatedSearches.map((rel) => limit(() => scrapGoogle(rel, params)))

        console.log(promises)
        const results = await Promise.allSettled(promises)

        results.forEach((res) => {
          if (res.status === 'rejected') throw new Error(res.reason)

          const parsedData = JSON.parse(res.value)

          if (parsedData.search_information.total_results > 0) {
            // merge related searches
            if (parsedData.related_searches.length > 0) allRelatedSearches.push(...parsedData.related_searches.map((related) => related.query))

            // merge organic results
            if (parsedData.organic_results.length > 0) allOrganicResults.push(...parsedData.organic_results.map((organic_res) => organic_res.link))
          } else {
            // searchFailedList.push(related)
            throw new Error('No Results')
          }
        })
      } catch (error) {
        console.log(error)
      }
    } else {
      throw new Error('No related_searches ')
    }

    // get all organic results from all related searches
    let promises = allRelatedSearches.map((rel) => limit(() => scrapGoogle(rel, params)))
    console.log(promises)
    const results = await Promise.allSettled(promises)

    results.forEach((res) => {
      if (res.status === 'rejected') throw new Error(res.reason)
      const parsedData = JSON.parse(res.value)
      if (parsedData.organic_results.length > 0) allOrganicResults.push(...parsedData.organic_results.map((organic_res) => organic_res.link))
    })
  } catch (error) {
    console.log(error)
  } finally {
    console.log(`Duration: ${Date.now() - start}ms`)
    console.log(searchFailedList)
    console.log(allRelatedSearches)
    console.log(allOrganicResults)

    const today = getToday()
    if (allOrganicResults) fs.writeFileSync(`./organic_results_${searchKey}_${today}.json`, JSON.stringify(allOrganicResults))
    if (allRelatedSearches) fs.writeFileSync(`./related_searches_${searchKey}_${today}.json`, JSON.stringify(allRelatedSearches))
  }
})()

function getToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${day}-${month}-${year}`
}
