#!/usr/bin/env node

/**
 * Deployment Status Checker
 * Checks current deployment status and provides next steps
 */

console.log('🔍 Checking Deployment Status...\n')
console.log('=' .repeat(70))

// Production URL
const PRODUCTION_URL = 'https://ato-pyypajndj-team-agi.vercel.app'

async function checkEndpoint(name, path) {
  try {
    const url = `${PRODUCTION_URL}${path}`
    console.log(`\n📡 Testing: ${name}`)
    console.log(`   URL: ${url}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (response.ok) {
      console.log(`   ✅ Status: ${response.status} - WORKING`)
      return true
    } else {
      console.log(`   ❌ Status: ${response.status} - ${response.statusText}`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
    return false
  }
}

async function main() {
  console.log(`\nProduction URL: ${PRODUCTION_URL}\n`)

  // Test new endpoints
  const results = {
    taxRates: await checkEndpoint('Tax Rates API (NEW)', '/api/tax-data/rates'),
    cacheStats: await checkEndpoint('Cache Stats API (NEW)', '/api/tax-data/cache-stats'),
    agentReports: await checkEndpoint('Agent Reports API (NEW)', '/api/agents/reports'),
    analysisStatus: await checkEndpoint('Analysis Status API (EXISTING)', '/api/audit/analysis-status/8a8caf6c-614b-45a5-9e15-46375122407c'),
  }

  console.log('\n' + '='.repeat(70))
  console.log('📊 RESULTS')
  console.log('='.repeat(70))

  const working = Object.values(results).filter(r => r).length
  const total = Object.values(results).length

  console.log(`\n✅ Working: ${working}/${total} endpoints`)
  console.log(`❌ Not Working: ${total - working}/${total} endpoints`)

  if (working === total) {
    console.log('\n🎉 SUCCESS! All endpoints are working in production!')
    console.log('✅ New features have been deployed successfully!')
  } else if (working === 0) {
    console.log('\n⚠️  PRODUCTION SITE NOT RESPONDING')
    console.log('This could mean:')
    console.log('  1. Site is down temporarily')
    console.log('  2. Network/firewall blocking the connection')
    console.log('  3. Vercel deployment failed')
  } else if (results.analysisStatus && !results.taxRates) {
    console.log('\n⚠️  OLD DEPLOYMENT IS ACTIVE')
    console.log('The production site is running an old version (2+ days old).')
    console.log('New API endpoints are NOT yet deployed.')
    console.log('\n🎯 DEPLOYMENT NEEDED!')
  }

  console.log('\n' + '='.repeat(70))
  console.log('🚀 NEXT STEPS')
  console.log('='.repeat(70))

  if (working < total) {
    console.log('\n📋 Option 1: Manual Deploy (Quickest - 2 minutes)')
    console.log('   1. Go to: https://vercel.com/unite-group/ato')
    console.log('   2. Click "..." menu on latest deployment')
    console.log('   3. Select "Redeploy" → "Production"')
    console.log('   4. Wait ~2 minutes')
    console.log('   5. Run this script again to verify')

    console.log('\n📋 Option 2: Set Up Auto-Deploy (One-time setup)')
    console.log('   1. Get Vercel token from: https://vercel.com/account/tokens')
    console.log('   2. Go to: https://github.com/CleanExpo/ATO/settings/secrets/actions')
    console.log('   3. Add secret: VERCEL_TOKEN = [your token]')
    console.log('   4. Add secret: VERCEL_ORG_ID = team_zp1CsU87brPbSks2eFbPqWJQ')
    console.log('   5. Add secret: VERCEL_PROJECT_ID = prj_I5D99PvXGdaAHX35iUfkSqGeNo4W')
    console.log('   6. Push any commit to trigger auto-deploy')
    console.log('\n   After setup, all future pushes to main will auto-deploy!')
  } else {
    console.log('\n✅ All systems operational!')
    console.log('   Production is running the latest code.')
  }

  console.log('\n' + '='.repeat(70))
  console.log('\n💡 TIP: Run this script anytime to check deployment status:')
  console.log('   node check-deployment-status.mjs\n')
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
