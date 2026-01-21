#!/usr/bin/env node

/**
 * Test Brave Search Integration
 * Fetches actual tax rates from ATO.gov.au
 */

import 'dotenv/config'

console.log('🔍 Testing Brave Search Integration\n')
console.log('=' .repeat(60))

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY

if (!BRAVE_API_KEY) {
  console.log('⚠️  BRAVE_API_KEY not set in .env.local')
  console.log('   System will use fallback values for tax rates.')
  console.log('   This is OK for testing, but production should have the key set.')
  console.log('')
}

async function testBraveSearch() {
  try {
    console.log('1️⃣  Testing Brave Search API...\n')

    // Test search query
    const query = 'site:ato.gov.au instant asset write-off'
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`

    console.log(`   Query: "${query}"`)
    console.log(`   URL: ${url}`)
    console.log('')

    if (!BRAVE_API_KEY) {
      console.log('   ⏭️  Skipping (no API key)')
      return
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
    })

    if (!response.ok) {
      console.log(`   ❌ API returned ${response.status}`)
      console.log(`   ${await response.text()}`)
      return
    }

    const data = await response.json()
    const results = data.web?.results || []

    console.log(`   ✅ Found ${results.length} results`)
    console.log('')

    if (results.length > 0) {
      console.log('   Top results:')
      results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.title}`)
        console.log(`      ${result.url}`)
        console.log('')
      })
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }
}

async function testJinaScraper() {
  try {
    console.log('2️⃣  Testing Jina AI Scraper...\n')

    // Test URL (ATO instant write-off page)
    const testUrl = 'https://www.ato.gov.au/business/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business/instant-asset-write-off'

    console.log(`   URL: ${testUrl}`)
    console.log('')

    const jinaUrl = `https://r.jina.ai/${testUrl}`
    const JINA_API_KEY = 'jina_c016fb6c12c1444c98737d7e9f70966eNpogql_hauwHSi3Ta2KPptcvhXLc'

    const response = await fetch(jinaUrl, {
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'text/plain',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.log(`   ❌ Jina API returned ${response.status}`)
      return
    }

    const markdown = await response.text()

    console.log(`   ✅ Scraped ${markdown.length} characters`)
    console.log('')

    // Look for dollar amounts
    const amounts = markdown.match(/\$(\d{1,3}(?:,\d{3})*)/g)

    if (amounts && amounts.length > 0) {
      console.log(`   Found ${amounts.length} dollar amounts:`)
      const uniqueAmounts = [...new Set(amounts)].slice(0, 10)
      uniqueAmounts.forEach(amount => console.log(`      ${amount}`))
      console.log('')

      // Parse and find likely threshold
      const parsed = amounts
        .map(a => parseInt(a.replace(/[$,]/g, '')))
        .filter(n => n >= 1000 && n <= 1000000)

      if (parsed.length > 0) {
        const threshold = Math.max(...parsed)
        console.log(`   💰 Likely threshold: $${threshold.toLocaleString()}`)
        console.log('')
      }
    } else {
      console.log(`   ⚠️  No dollar amounts found in content`)
      console.log(`   First 500 chars: ${markdown.substring(0, 500)}...`)
      console.log('')
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }
}

async function testTaxRatesAPI() {
  try {
    console.log('3️⃣  Testing Tax Rates API (Local)...\n')

    const url = 'http://localhost:3000/api/tax-data/rates'
    console.log(`   URL: ${url}`)
    console.log('')

    const response = await fetch(url)

    if (!response.ok) {
      console.log(`   ❌ API returned ${response.status}`)
      if (response.status === 404) {
        console.log(`   ⚠️  Make sure dev server is running: npm run dev`)
      }
      return
    }

    const data = await response.json()

    if (data.success) {
      console.log(`   ✅ API working`)
      console.log('')
      console.log(`   Tax Rates:`)
      console.log(`      Instant Write-off: $${(data.data.instantWriteOffThreshold || 0).toLocaleString()}`)
      console.log(`      Home Office Rate:  $${(data.data.homeOfficeRatePerHour || 0).toFixed(2)}/hour`)
      console.log(`      R&D Offset Rate:   ${((data.data.rndOffsetRate || 0) * 100).toFixed(1)}%`)
      console.log('')
      console.log(`   Cache Status:`)
      console.log(`      Cache Hit: ${data.data.cacheHit ? 'Yes' : 'No (fresh fetch)'}`)
      if (data.data.cacheAge) {
        const ageMinutes = Math.round(data.data.cacheAge / 1000 / 60)
        console.log(`      Cache Age: ${ageMinutes} minutes`)
      }
      console.log('')
    } else {
      console.log(`   ❌ API error: ${data.error}`)
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`   ⚠️  Dev server not running. Start with: npm run dev`)
    } else {
      console.log(`   ❌ Error: ${error.message}`)
    }
  }
}

async function runAllTests() {
  await testBraveSearch()
  console.log('='.repeat(60))
  await testJinaScraper()
  console.log('='.repeat(60))
  await testTaxRatesAPI()
  console.log('='.repeat(60))
  console.log('\n✅ Testing complete!')
}

runAllTests().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
