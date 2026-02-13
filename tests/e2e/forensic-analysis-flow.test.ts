/**
 * Forensic Analysis Flow E2E Tests
 *
 * Tests the complete forensic audit workflow:
 * - Starting forensic analysis
 * - Monitoring progress
 * - Viewing analysis results
 * - Filtering and sorting findings
 * - Exporting reports
 */

import { test, expect } from '@playwright/test'

test.describe('Forensic Analysis Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is logged in with synced data
    await page.goto('/dashboard/forensic-audit')
  })

  test('should display forensic audit dashboard', async ({ page }) => {
    // Should show analysis status
    await expect(page.locator('h1:has-text("Forensic Audit")')).toBeVisible()

    // Should have start analysis button
    await expect(page.locator('button:has-text("Start Analysis")')).toBeVisible()

    // Should show cached transaction count
    await expect(page.locator('[data-testid="transaction-count"]')).toBeVisible()
  })

  test('should start forensic analysis', async ({ page }) => {
    // Click start analysis button
    await page.click('button:has-text("Start Analysis")')

    // Should show confirmation dialog
    await expect(page.locator('text=/This will analyze all cached transactions/i')).toBeVisible()

    // Confirm
    await page.click('button:has-text("Confirm")')

    // Should redirect to progress page
    await page.waitForURL('**/forensic-audit/progress*')

    // Should show progress indicator
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible()
  })

  test('should configure analysis settings before starting', async ({ page }) => {
    // Open settings
    await page.click('button:has-text("Analysis Settings")')

    // Configure batch size
    await page.selectOption('[data-testid="batch-size"]', '100')

    // Select financial years
    await page.check('[data-testid="fy-2023-24"]')
    await page.check('[data-testid="fy-2022-23"]')

    // Select analysis types
    await page.check('[data-testid="analysis-rnd"]')
    await page.check('[data-testid="analysis-deductions"]')
    await page.check('[data-testid="analysis-div7a"]')

    // Save settings
    await page.click('button:has-text("Save Settings")')

    // Settings should be saved
    await expect(page.locator('text=/settings saved/i')).toBeVisible()
  })
})

test.describe('Analysis Progress Monitoring', () => {
  test('should display real-time progress', async ({ page }) => {
    // Navigate to analysis in progress
    await page.goto('/dashboard/forensic-audit/progress?analysisId=test-123')

    // Should show progress bar
    const progressBar = page.locator('[role="progressbar"]')
    await expect(progressBar).toBeVisible()

    // Should show percentage
    await expect(page.locator('text=/%/i')).toBeVisible()

    // Should show transactions processed
    await expect(page.locator('text=/\d+ of \d+ transactions/i')).toBeVisible()
  })

  test('should show estimated time remaining', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/progress?analysisId=test-123')

    // Should display ETA
    await expect(page.locator('[data-testid="eta"]')).toContainText(/minute|second/)
  })

  test('should update progress automatically', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/progress?analysisId=test-123')

    const progressBar = page.locator('[role="progressbar"]')
    const initialValue = await progressBar.getAttribute('aria-valuenow')

    // Wait for progress to update
    await page.waitForTimeout(3000)

    const updatedValue = await progressBar.getAttribute('aria-valuenow')

    // Progress should increase (or be complete)
    expect(Number(updatedValue)).toBeGreaterThanOrEqual(Number(initialValue) || 0)
  })

  test('should allow canceling analysis', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/progress?analysisId=test-123')

    // Click cancel
    await page.click('button:has-text("Cancel Analysis")')

    // Confirm cancellation
    await page.click('button:has-text("Yes, Cancel")')

    // Should show cancellation message
    await expect(page.locator('text=/analysis cancelled/i')).toBeVisible()
  })

  test('should show batch processing details', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/progress?analysisId=test-123')

    // Should show current batch
    await expect(page.locator('text=/batch \d+ of \d+/i')).toBeVisible()

    // Should show processing speed
    await expect(page.locator('[data-testid="processing-speed"]')).toBeVisible()
  })

  test('should redirect to results when complete', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/progress?analysisId=test-123&status=complete')

    // Should auto-redirect to results
    await page.waitForURL('**/forensic-audit/results*', { timeout: 5000 })

    // Should show results page
    await expect(page.locator('h1:has-text("Analysis Results")')).toBeVisible()
  })
})

test.describe('Analysis Results', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?analysisId=test-123')
  })

  test('should display summary statistics', async ({ page }) => {
    // Should show total transactions analyzed
    await expect(page.locator('[data-testid="total-analyzed"]')).toBeVisible()

    // Should show findings count
    await expect(page.locator('[data-testid="findings-count"]')).toBeVisible()

    // Should show potential savings
    await expect(page.locator('[data-testid="potential-savings"]')).toBeVisible()
  })

  test('should show findings grouped by category', async ({ page }) => {
    // Should have category cards
    await expect(page.locator('[data-testid="category-rnd"]')).toBeVisible()
    await expect(page.locator('[data-testid="category-deductions"]')).toBeVisible()
    await expect(page.locator('[data-testid="category-div7a"]')).toBeVisible()

    // Each should show count
    const rndCount = page.locator('[data-testid="category-rnd"] [data-testid="finding-count"]')
    await expect(rndCount).toContainText(/\d+/)
  })

  test('should display high-value opportunities first', async ({ page }) => {
    // High-value section should be visible
    await expect(page.locator('text=/High-Value Opportunities/i')).toBeVisible()

    // Should show opportunities >$10k
    const highValueItems = page.locator('[data-value-threshold="high"]')
    await expect(highValueItems.first()).toBeVisible()
  })

  test('should allow filtering findings by category', async ({ page }) => {
    // Open filter dropdown
    await page.click('[data-testid="filter-category"]')

    // Select R&D only
    await page.click('[data-testid="filter-option-rnd"]')

    // Results should be filtered
    await expect(page.locator('[data-category="R&D_TAX_INCENTIVE"]')).toBeVisible()
    await expect(page.locator('[data-category="GENERAL_DEDUCTION"]')).not.toBeVisible()
  })

  test('should allow filtering by confidence level', async ({ page }) => {
    // Set confidence filter
    await page.click('[data-testid="filter-confidence"]')
    await page.click('[data-testid="confidence-high"]') // >90%

    // Should only show high-confidence results
    const findings = page.locator('[data-testid="finding-item"]')
    const count = await findings.count()

    for (let i = 0; i < count; i++) {
      const confidence = await findings.nth(i).getAttribute('data-confidence')
      expect(Number(confidence)).toBeGreaterThan(90)
    }
  })

  test('should allow sorting findings', async ({ page }) => {
    // Open sort dropdown
    await page.click('[data-testid="sort-by"]')

    // Sort by savings (highest first)
    await page.click('[data-testid="sort-savings-desc"]')

    // First item should have highest savings
    const firstItemSavings = await page.locator('[data-testid="finding-item"]').first()
      .getAttribute('data-savings')

    const secondItemSavings = await page.locator('[data-testid="finding-item"]').nth(1)
      .getAttribute('data-savings')

    expect(Number(firstItemSavings)).toBeGreaterThanOrEqual(Number(secondItemSavings) || 0)
  })

  test('should expand finding to show details', async ({ page }) => {
    // Click on first finding
    await page.click('[data-testid="finding-item"]')

    // Details panel should open
    await expect(page.locator('[data-testid="finding-details"]')).toBeVisible()

    // Should show transaction details
    await expect(page.locator('text=/Transaction ID/i')).toBeVisible()
    await expect(page.locator('text=/Description/i')).toBeVisible()
    await expect(page.locator('text=/Amount/i')).toBeVisible()
  })

  test('should show AI analysis reasoning', async ({ page }) => {
    await page.click('[data-testid="finding-item"]')

    // Should display reasoning
    await expect(page.locator('[data-testid="analysis-reasoning"]')).toBeVisible()

    // Should show confidence score
    await expect(page.locator('[data-testid="confidence-score"]')).toContainText(/%/)
  })

  test('should display legislative references', async ({ page }) => {
    await page.click('[data-testid="finding-item"]')

    // Should show relevant sections
    await expect(page.locator('text=/Division|Section|ITAA/i')).toBeVisible()
  })

  test('should provide actionable recommendations', async ({ page }) => {
    await page.click('[data-testid="finding-item"]')

    // Should show recommendations
    await expect(page.locator('[data-testid="recommendations"]')).toBeVisible()

    // Should be a list
    const recommendations = page.locator('[data-testid="recommendation-item"]')
    expect(await recommendations.count()).toBeGreaterThan(0)
  })
})

test.describe('R&D Tax Incentive Findings', () => {
  test('should identify R&D candidates', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?category=rnd')

    // Should show R&D section
    await expect(page.locator('text=/R&D Tax Incentive/i')).toBeVisible()

    // Should display eligible expenditure
    await expect(page.locator('[data-testid="rnd-expenditure"]')).toBeVisible()

    // Should calculate 43.5% offset
    await expect(page.locator('[data-testid="rnd-offset"]')).toBeVisible()
  })

  test('should show four-element test assessment', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?category=rnd')

    await page.click('[data-testid="rnd-finding"]')

    // Should show four-element test results
    await expect(page.locator('text=/Unknown Outcome/i')).toBeVisible()
    await expect(page.locator('text=/Systematic Approach/i')).toBeVisible()
    await expect(page.locator('text=/New Knowledge/i')).toBeVisible()
    await expect(page.locator('text=/Scientific Method/i')).toBeVisible()
  })

  test('should display registration deadline warning', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?category=rnd')

    // Should warn about 10-month deadline
    await expect(page.locator('text=/registration deadline|10 months/i')).toBeVisible()
  })
})

test.describe('Division 7A Findings', () => {
  test('should identify potential Division 7A loans', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?category=div7a')

    // Should show Division 7A section
    await expect(page.locator('text=/Division 7A/i')).toBeVisible()

    // Should flag shareholder loans
    await expect(page.locator('text=/shareholder loan|deemed dividend/i')).toBeVisible()
  })

  test('should show benchmark interest rate compliance', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?category=div7a')

    await page.click('[data-testid="div7a-finding"]')

    // Should display 8.77% benchmark rate
    await expect(page.locator('text=/8.77%|benchmark rate/i')).toBeVisible()
  })

  test('should calculate minimum repayment', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?category=div7a')

    await page.click('[data-testid="div7a-finding"]')

    // Should show minimum repayment calculation
    await expect(page.locator('[data-testid="minimum-repayment"]')).toBeVisible()
  })
})

test.describe('Export and Reporting', () => {
  test('should export results to PDF', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results')

    // Click export button
    await page.click('button:has-text("Export Report")')

    // Select PDF format
    await page.click('[data-testid="format-pdf"]')

    // Click generate
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Generate Report")')

    const download = await downloadPromise

    // Should download PDF
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  test('should export results to Excel', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results')

    await page.click('button:has-text("Export Report")')
    await page.click('[data-testid="format-excel"]')

    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Generate Report")')

    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.xlsx?$/)
  })

  test('should allow customizing report sections', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results')

    await page.click('button:has-text("Export Report")')

    // Select sections to include
    await page.check('[data-testid="include-executive-summary"]')
    await page.check('[data-testid="include-rnd-findings"]')
    await page.check('[data-testid="include-deductions"]')
    await page.uncheck('[data-testid="include-methodology"]')

    // Verify selections
    expect(await page.isChecked('[data-testid="include-executive-summary"]')).toBe(true)
    expect(await page.isChecked('[data-testid="include-methodology"]')).toBe(false)
  })

  test('should generate executive summary', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results')

    // Click view executive summary
    await page.click('button:has-text("Executive Summary")')

    // Should show summary page
    await expect(page.locator('text=/Total Potential Savings/i')).toBeVisible()
    await expect(page.locator('text=/Key Findings/i')).toBeVisible()
    await expect(page.locator('text=/Recommendations/i')).toBeVisible()
  })
})

test.describe('Multi-Organization Analysis', () => {
  test('should analyze all organizations in group', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit')

    // Select organization group
    await page.click('[data-testid="org-selector"]')
    await page.click('[data-testid="org-group-disaster-recovery"]')

    // Should show all orgs in group
    await expect(page.locator('text=/3 organizations/i')).toBeVisible()

    // Start analysis
    await page.click('button:has-text("Start Analysis")')
    await page.click('button:has-text("Confirm")')

    // Should analyze all orgs
    await expect(page.locator('text=/analyzing all organizations/i')).toBeVisible()
  })

  test('should aggregate results across organizations', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?groupId=disaster-recovery-group')

    // Should show combined statistics
    await expect(page.locator('[data-testid="group-total-savings"]')).toBeVisible()

    // Should breakdown by organization
    await page.click('button:has-text("View by Organization")')

    await expect(page.locator('text=/Disaster Recovery Qld/i')).toBeVisible()
    await expect(page.locator('text=/Disaster Recovery Pty Ltd/i')).toBeVisible()
    await expect(page.locator('text=/CARSI/i')).toBeVisible()
  })

  test('should compare findings across organizations', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results?groupId=disaster-recovery-group')

    // Click comparison view
    await page.click('button:has-text("Compare Organizations")')

    // Should show comparison table
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible()

    // Should have columns for each org
    await expect(page.locator('th:has-text("Disaster Recovery Qld")')).toBeVisible()
  })
})

test.describe('Analysis History', () => {
  test('should display past analysis runs', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/history')

    // Should show list of analyses
    const historyItems = page.locator('[data-testid="analysis-history-item"]')
    expect(await historyItems.count()).toBeGreaterThan(0)
  })

  test('should allow viewing past results', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/history')

    // Click on historical analysis
    await page.click('[data-testid="analysis-history-item"]')

    // Should navigate to results
    await page.waitForURL('**/forensic-audit/results*')

    await expect(page.locator('[data-testid="findings-count"]')).toBeVisible()
  })

  test('should compare results across time periods', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/history')

    // Select two analyses to compare
    await page.check('[data-testid="compare-checkbox-1"]')
    await page.check('[data-testid="compare-checkbox-2"]')

    // Click compare button
    await page.click('button:has-text("Compare Selected")')

    // Should show comparison view
    await expect(page.locator('text=/Comparison/i')).toBeVisible()
  })
})

test.describe('Performance', () => {
  test('should load results page within 2 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/dashboard/forensic-audit/results?analysisId=test-123')

    await page.waitForSelector('[data-testid="findings-count"]')

    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(2000)
  })

  test('should handle large result sets efficiently', async ({ page }) => {
    // Navigate to results with 1000+ findings
    await page.goto('/dashboard/forensic-audit/results?count=large')

    // Should use virtualization/pagination
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible()

    // Should load quickly
    await expect(page.locator('[data-testid="findings-count"]')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results')

    // Tab through findings
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should focus on finding
    const focused = await page.locator(':focus').getAttribute('data-testid')
    expect(focused).toBeDefined()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit/results')

    // Check progress bar
    const progressBar = page.locator('[role="progressbar"]')
    await expect(progressBar).toHaveAttribute('aria-label')

    // Check buttons
    const exportButton = page.locator('button:has-text("Export Report")')
    await expect(exportButton).toHaveAttribute('aria-label')
  })
})
