#!/usr/bin/env node

/**
 * Test Production Endpoints
 * Quick verification that production deployment is working
 */

// Get production URL from command line or environment
const PRODUCTION_URL = process.argv[2] || process.env.PRODUCTION_URL

if (!PRODUCTION_URL) {
  console.log('❌ No production URL provided')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/test-production.mjs https://your-app.vercel.app')
  console.log('')
  console.log('Or check Vercel dashboard at:')
  console.log('  https://vercel.com/unite-group/ato')
  process.exit(1)
}

console.log('🧪 Testing Production Deployment\n')
console.log('URL:', PRODUCTION_URL)
console.log('=' .repeat(60))

const results = {
  passed: 0,
  failed: 0
}

async function testEndpoint(name, path) {
  try {
    const url = `${PRODUCTION_URL}${path}`
    console.log(`\n${name}`)
    console.log(`  URL: ${url}`)

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    })

    const status = response.status
    const ok = response.ok

    console.log(`  Status: ${status} ${ok ? '✅' : '❌'}`)

    if (ok) {
      try {
        const data = await response.json()
        console.log(`  Response: ${JSON.stringify(data).substring(0, 100)}...`)
        results.passed++
      } catch (e) {
        console.log(`  Response: [non-JSON]`)
        results.passed++
      }
    } else {
      const text = await response.text()
      console.log(`  Error: ${text.substring(0, 200)}`)
      results.failed++
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`)
    results.failed++
  }
}

async function runTests() {
  await testEndpoint('1️⃣  Tax Rates API', '/api/tax-data/rates')
  await testEndpoint('2️⃣  Cache Stats API', '/api/tax-data/cache-stats')
  await testEndpoint('3️⃣  Agent Reports API', '/api/agents/reports')
  await testEndpoint('4️⃣  Analysis Status API', '/api/audit/analysis-status/8a8caf6c-614b-45a5-9e15-46375122407c')

  console.log('\n' + '='.repeat(60))
  console.log('📊 PRODUCTION TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Passed: ${results.passed}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log('='.repeat(60))

  if (results.failed === 0) {
    console.log('\n✅ All production endpoints working!')
    process.exit(0)
  } else {
    console.log('\n❌ Some endpoints failed. Check Vercel logs.')
    process.exit(1)
  }
}

runTests().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
