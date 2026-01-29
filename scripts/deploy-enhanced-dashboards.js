#!/usr/bin/env node

/**
 * Deployment Script for Enhanced Dashboards
 *
 * This script will:
 * 1. Backup original dashboard pages
 * 2. Replace them with enhanced versions
 * 3. Verify all component files exist
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 Deploying Enhanced Dashboards...\n')

// Step 1: Verify all component files exist
console.log('Step 1: Verifying component files...')
const componentFiles = [
  'components/dashboard/LiveProgressCard.tsx',
  'components/dashboard/AnimatedCounter.tsx',
  'components/dashboard/LiveChart.tsx',
  'components/dashboard/ActivityFeed.tsx',
  'components/dashboard/ViewToggle.tsx',
  'components/dashboard/FormatToggleWrapper.tsx',
  'lib/utils/client-view-transformer.ts'
]

let allComponentsExist = true
componentFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file)
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`)
  } else {
    console.log(`  ❌ ${file} - MISSING!`)
    allComponentsExist = false
  }
})

if (!allComponentsExist) {
  console.error('\n❌ Some component files are missing. Please check the implementation.')
  process.exit(1)
}

console.log('\n✅ All components verified!\n')

// Step 2: Backup and replace Data Quality page
console.log('Step 2: Deploying Data Quality dashboard...')
const dataQualityOriginal = path.join(__dirname, '../app/dashboard/data-quality/page.tsx')
const dataQualityEnhanced = path.join(__dirname, '../app/dashboard/data-quality/page-enhanced.tsx')
const dataQualityBackup = path.join(__dirname, '../app/dashboard/data-quality/page-original.tsx')

if (fs.existsSync(dataQualityEnhanced)) {
  // Backup original if it exists and hasn't been backed up
  if (fs.existsSync(dataQualityOriginal) && !fs.existsSync(dataQualityBackup)) {
    fs.copyFileSync(dataQualityOriginal, dataQualityBackup)
    console.log('  ✅ Backed up original data-quality/page.tsx')
  }

  // Replace with enhanced version
  fs.copyFileSync(dataQualityEnhanced, dataQualityOriginal)
  console.log('  ✅ Deployed enhanced data-quality/page.tsx')
} else {
  console.log('  ⚠️  Enhanced data quality page not found')
}

// Step 3: Backup and replace Forensic Audit page
console.log('\nStep 3: Deploying Forensic Audit dashboard...')
const forensicOriginal = path.join(__dirname, '../app/dashboard/forensic-audit/page.tsx')
const forensicEnhanced = path.join(__dirname, '../app/dashboard/forensic-audit/page-enhanced.tsx')
const forensicBackup = path.join(__dirname, '../app/dashboard/forensic-audit/page-original.tsx')

if (fs.existsSync(forensicEnhanced)) {
  // Backup original if it exists and hasn't been backed up
  if (fs.existsSync(forensicOriginal) && !fs.existsSync(forensicBackup)) {
    fs.copyFileSync(forensicOriginal, forensicBackup)
    console.log('  ✅ Backed up original forensic-audit/page.tsx')
  }

  // Replace with enhanced version
  fs.copyFileSync(forensicEnhanced, forensicOriginal)
  console.log('  ✅ Deployed enhanced forensic-audit/page.tsx')
} else {
  console.log('  ⚠️  Enhanced forensic audit page not found')
}

console.log('\n🎉 Deployment complete!\n')
console.log('Next steps:')
console.log('  1. Run: npm run dev')
console.log('  2. Navigate to /dashboard/data-quality')
console.log('  3. Navigate to /dashboard/forensic-audit')
console.log('  4. Test live progress and dual-format toggle\n')
console.log('To rollback:')
console.log('  - Restore from page-original.tsx files')
console.log('  - Or use git to revert changes\n')
