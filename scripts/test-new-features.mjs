#!/usr/bin/env node

/**
 * Test script for new features
 * Tests Brave Search integration and autonomous agents
 */

import 'dotenv/config'

console.log('🧪 Testing New Features\n')
console.log('=' .repeat(60))

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TENANT_ID = process.env.TEST_TENANT_ID || '8a8caf6c-614b-45a5-9e15-46375122407c'

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (details) console.log(`   ${details}`)

  results.tests.push({ name, passed, details })
  if (passed) results.passed++
  else results.failed++
}

async function testEndpoint(name, url, method = 'GET', expectedStatus = 200) {
  try {
    const options = { method }
    const response = await fetch(url, options)

    const passed = response.status === expectedStatus
    logTest(
      name,
      passed,
      `Status: ${response.status} ${passed ? '(expected)' : `(expected ${expectedStatus})`}`
    )

    if (response.ok) {
      try {
        const data = await response.json()
        console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`)
        return { passed, data }
      } catch (e) {
        // Not JSON, that's OK
        return { passed, data: null }
      }
    }

    return { passed, data: null }
  } catch (error) {
    logTest(name, false, `Error: ${error.message}`)
    return { passed: false, error }
  }
}

async function runTests() {
  console.log('\n📊 TEST SUITE: API Endpoints\n')

  // Test 1: Tax Rates API
  console.log('1️⃣  Tax Rates API')
  await testEndpoint(
    'GET /api/tax-data/rates',
    `${BASE_URL}/api/tax-data/rates`
  )

  // Test 2: Cache Stats API
  console.log('\n2️⃣  Cache Statistics API')
  await testEndpoint(
    'GET /api/tax-data/cache-stats',
    `${BASE_URL}/api/tax-data/cache-stats`
  )

  // Test 3: Agent Reports API
  console.log('\n3️⃣  Agent Reports API')
  await testEndpoint(
    'GET /api/agents/reports',
    `${BASE_URL}/api/agents/reports`
  )

  // Test 4: Analysis Status API
  console.log('\n4️⃣  Analysis Status API')
  await testEndpoint(
    'GET /api/audit/analysis-status',
    `${BASE_URL}/api/audit/analysis-status/${TENANT_ID}`
  )

  // Test 5: Recommendations API
  console.log('\n5️⃣  Recommendations API')
  await testEndpoint(
    'GET /api/audit/recommendations',
    `${BASE_URL}/api/audit/recommendations?tenantId=${TENANT_ID}`
  )

  // Test 6: Opportunities by Year API
  console.log('\n6️⃣  Opportunities by Year API')
  await testEndpoint(
    'GET /api/audit/opportunities-by-year',
    `${BASE_URL}/api/audit/opportunities-by-year?tenantId=${TENANT_ID}`
  )

  console.log('\n\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Passed: ${results.passed}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log(`📊 Total:  ${results.tests.length}`)

  if (results.failed > 0) {
    console.log('\n❌ Some tests failed. Review output above.')
    console.log('\nFailed tests:')
    results.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.details}`))
  } else {
    console.log('\n✅ All tests passed!')
  }

  console.log('='.repeat(60))

  // Exit with error code if tests failed
  process.exit(results.failed > 0 ? 1 : 0)
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Fatal error running tests:', error)
  process.exit(1)
})
