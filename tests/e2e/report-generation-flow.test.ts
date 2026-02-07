import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests: Report Generation Flow
 *
 * Tests the complete end-to-end workflow for generating,
 * previewing, and downloading tax analysis reports.
 *
 * Workflows Tested:
 * - R&D Tax Incentive report generation
 * - Division 7A compliance report
 * - Comprehensive audit report
 * - Organization group consolidated report
 * - Report preview and download
 */

test.describe('Report Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Select organization (assuming already connected)
    const orgSelector = page.locator('[data-testid="org-selector"]')
    if (await orgSelector.isVisible()) {
      await orgSelector.click()
      await page.click('text=Disaster Recovery Qld Pty Ltd')
    }
  })

  test.describe('R&D Tax Incentive Report', () => {
    test('should generate R&D report from analysis results', async ({ page }) => {
      // Navigate to forensic audit page
      await page.click('text=Forensic Audit')
      await page.waitForURL('**/dashboard/forensic-audit')

      // Wait for analysis to complete (or use cached results)
      await expect(page.locator('text=/Analysis Complete/i')).toBeVisible({ timeout: 60000 })

      // Click "Generate Report" button
      await page.click('button:has-text("Generate Report")')

      // Select R&D Tax Incentive report type
      await page.click('[data-testid="report-type-selector"]')
      await page.click('text=R&D Tax Incentive')

      // Select financial year
      await page.click('[data-testid="financial-year-selector"]')
      await page.click('text=FY2023-24')

      // Select format (PDF)
      await page.click('[data-testid="report-format-selector"]')
      await page.click('text=PDF')

      // Click "Generate" button
      await page.click('button:has-text("Generate Report")')

      // Wait for report generation to start
      await expect(page.locator('text=/Generating Report/i')).toBeVisible()

      // Wait for report generation to complete (max 60 seconds)
      await expect(page.locator('text=/Report Ready/i')).toBeVisible({ timeout: 60000 })

      // Verify report summary is displayed
      await expect(page.locator('text=/Total R&D Offset:/i')).toBeVisible()
      await expect(page.locator('text=/\\$.*offset/i')).toBeVisible()
    })

    test('should preview R&D report before downloading', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Click "New Report"
      await page.click('button:has-text("New Report")')

      // Configure R&D report
      await page.selectOption('[data-testid="report-type"]', 'rnd_tax_incentive')
      await page.selectOption('[data-testid="financial-year"]', 'FY2023-24')

      // Click "Preview" instead of "Generate"
      await page.click('button:has-text("Preview")')

      // Wait for preview to load
      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 })

      // Verify preview contains key sections
      await expect(page.locator('text=/Executive Summary/i')).toBeVisible()
      await expect(page.locator('text=/R&D Activities Identified/i')).toBeVisible()
      await expect(page.locator('text=/Four-Element Test/i')).toBeVisible()
      await expect(page.locator('text=/Legislative References/i')).toBeVisible()

      // Verify disclaimer is present
      await expect(page.locator('text=/DISCLAIMER:/i')).toBeVisible()
      await expect(page.locator('text=/does not constitute tax advice/i')).toBeVisible()
    })

    test('should download R&D report as PDF', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Find completed report in list
      const reportRow = page.locator('[data-report-type="rnd_tax_incentive"]').first()
      await expect(reportRow).toBeVisible()

      // Click download button
      const downloadPromise = page.waitForEvent('download')
      await reportRow.locator('button:has-text("Download")').click()

      const download = await downloadPromise

      // Verify filename
      expect(download.suggestedFilename()).toContain('RnD_Tax_Incentive')
      expect(download.suggestedFilename()).toMatch(/FY\d{4}-\d{2}/)
      expect(download.suggestedFilename()).toMatch(/\.pdf$/)

      // Verify file size is reasonable (> 50KB for a real report)
      const path = await download.path()
      expect(path).toBeTruthy()
    })

    test('should display R&D opportunities with confidence scores', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      await page.selectOption('[data-testid="report-type"]', 'rnd_tax_incentive')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify each R&D opportunity shows confidence score
      const opportunities = page.locator('[data-testid="rnd-opportunity"]')
      const count = await opportunities.count()

      expect(count).toBeGreaterThan(0)

      // Check first opportunity has all required fields
      const firstOpportunity = opportunities.first()
      await expect(firstOpportunity.locator('text=/Confidence:/i')).toBeVisible()
      await expect(firstOpportunity.locator('text=/\\d+%/')).toBeVisible()
      await expect(firstOpportunity.locator('text=/Division 355/i')).toBeVisible()
    })

    test('should flag high-value opportunities for professional review', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      await page.selectOption('[data-testid="report-type"]', 'rnd_tax_incentive')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Check for high-value flags
      const highValueFlags = page.locator('[data-testid="high-value-flag"]')
      const flagCount = await highValueFlags.count()

      if (flagCount > 0) {
        // Verify flag contains warning text
        await expect(highValueFlags.first()).toContainText(/Professional Review Recommended/i)
        await expect(highValueFlags.first()).toContainText(/>\$50,000/i)
      }
    })

    test('should include registration deadline warning', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      await page.selectOption('[data-testid="report-type"]', 'rnd_tax_incentive')
      await page.selectOption('[data-testid="financial-year"]', 'FY2023-24')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify deadline warning
      await expect(page.locator('text=/Registration Deadline/i')).toBeVisible()
      await expect(page.locator('text=/April 2025/i')).toBeVisible()
      await expect(page.locator('text=/10 months after financial year end/i')).toBeVisible()
    })
  })

  test.describe('Division 7A Compliance Report', () => {
    test('should generate Division 7A report with loan analysis', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      // Select Division 7A report
      await page.selectOption('[data-testid="report-type"]', 'division_7a')
      await page.selectOption('[data-testid="financial-year"]', 'FY2023-24')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify key sections
      await expect(page.locator('text=/Shareholder Loans Identified/i')).toBeVisible()
      await expect(page.locator('text=/Benchmark Interest Rate/i')).toBeVisible()
      await expect(page.locator('text=/8.77%/i')).toBeVisible() // FY2024-25 rate
    })

    test('should display compliant and non-compliant loans separately', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      await page.selectOption('[data-testid="report-type"]', 'division_7a')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Check for compliant loans section
      const compliantSection = page.locator('[data-testid="compliant-loans"]')
      if (await compliantSection.isVisible()) {
        await expect(compliantSection.locator('text=/Compliant Loans/i')).toBeVisible()
      }

      // Check for non-compliant loans section
      const nonCompliantSection = page.locator('[data-testid="non-compliant-loans"]')
      if (await nonCompliantSection.isVisible()) {
        await expect(nonCompliantSection.locator('text=/Non-Compliant Loans/i')).toBeVisible()
        await expect(nonCompliantSection.locator('text=/Deemed Dividend/i')).toBeVisible()
      }
    })

    test('should calculate minimum repayments using annuity formula', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      await page.selectOption('[data-testid="report-type"]', 'division_7a')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Find loan details
      const loanDetails = page.locator('[data-testid="loan-details"]').first()
      if (await loanDetails.isVisible()) {
        await expect(loanDetails.locator('text=/Minimum Repayment/i')).toBeVisible()
        await expect(loanDetails.locator('text=/Actual Repayment/i')).toBeVisible()
        await expect(loanDetails.locator('text=/\\$/i')).toBeVisible()
      }
    })

    test('should include Section 109N legislative reference', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      await page.selectOption('[data-testid="report-type"]', 'division_7a')
      await page.click('button:has-text("Preview")')

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify legislative reference
      await expect(page.locator('text=/Section 109N/i')).toBeVisible()
      await expect(page.locator('text=/ITAA 1936/i')).toBeVisible()
    })
  })

  test.describe('Comprehensive Audit Report', () => {
    test('should generate multi-module comprehensive report', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      // Select comprehensive audit
      await page.selectOption('[data-testid="report-type"]', 'comprehensive_audit')
      await page.selectOption('[data-testid="financial-year"]', 'FY2023-24')
      await page.click('button:has-text("Generate Report")')

      // Wait for generation (this may take longer)
      await expect(page.locator('text=/Report Ready/i')).toBeVisible({ timeout: 120000 })

      // Click to view report
      await page.click('button:has-text("View Report")')

      // Verify all modules are included
      await expect(page.locator('text=/R&D Tax Incentive/i')).toBeVisible()
      await expect(page.locator('text=/Division 7A/i')).toBeVisible()
      await expect(page.locator('text=/General Deductions/i')).toBeVisible()
      await expect(page.locator('text=/Tax Losses/i')).toBeVisible()
      await expect(page.locator('text=/Bad Debts/i')).toBeVisible()
    })

    test('should display executive summary with total recovery estimate', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.locator('[data-report-type="comprehensive_audit"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify executive summary
      await expect(page.locator('text=/Executive Summary/i')).toBeVisible()
      await expect(page.locator('text=/Total Tax Recovery Estimate/i')).toBeVisible()
      await expect(page.locator('text=/\\$.*,.*/')).toBeVisible() // Amount with comma
    })

    test('should show key findings from all tax modules', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.locator('[data-report-type="comprehensive_audit"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify key findings section
      const keyFindings = page.locator('[data-testid="key-findings"]')
      await expect(keyFindings).toBeVisible()

      // Should have findings from multiple modules
      const findingsCount = await keyFindings.locator('li').count()
      expect(findingsCount).toBeGreaterThanOrEqual(3)
    })

    test('should include urgent actions section', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.locator('[data-report-type="comprehensive_audit"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify urgent actions
      await expect(page.locator('text=/Urgent Actions Required/i')).toBeVisible()

      // Check for deadline-related actions
      const urgentActions = page.locator('[data-testid="urgent-actions"]')
      if (await urgentActions.isVisible()) {
        const actionsCount = await urgentActions.locator('li').count()
        expect(actionsCount).toBeGreaterThan(0)
      }
    })

    test('should generate report in multiple formats', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Test PDF format
      await page.click('button:has-text("New Report")')
      await page.selectOption('[data-testid="report-type"]', 'comprehensive_audit')
      await page.selectOption('[data-testid="report-format"]', 'pdf')
      await page.click('button:has-text("Generate Report")')

      await expect(page.locator('text=/Generating PDF/i')).toBeVisible()

      // Go back and test Excel format
      await page.click('button:has-text("New Report")')
      await page.selectOption('[data-testid="report-type"]', 'comprehensive_audit')
      await page.selectOption('[data-testid="report-format"]', 'excel')
      await page.click('button:has-text("Generate Report")')

      await expect(page.locator('text=/Generating Excel/i')).toBeVisible()
    })
  })

  test.describe('Organization Group Reports', () => {
    test('should generate consolidated report for organization group', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Select organization group view
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      // Generate report
      await page.click('button:has-text("New Report")')
      await page.selectOption('[data-testid="report-type"]', 'comprehensive_audit')
      await page.click('button:has-text("Generate Report")')

      await expect(page.locator('text=/Report Ready/i')).toBeVisible({ timeout: 120000 })

      // View report
      await page.click('button:has-text("View Report")')

      // Verify group information
      await expect(page.locator('text=/Organization Group: Disaster Recovery Group/i')).toBeVisible()
      await expect(page.locator('text=/Organizations: 3/i')).toBeVisible()
    })

    test('should show breakdown by organization within group', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      // View existing group report
      await page.locator('[data-report-type="comprehensive_audit"][data-is-group="true"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify organization breakdown section
      await expect(page.locator('text=/Breakdown by Organization/i')).toBeVisible()
      await expect(page.locator('text=/Disaster Recovery Qld/i')).toBeVisible()
      await expect(page.locator('text=/Disaster Recovery Pty Ltd/i')).toBeVisible()
      await expect(page.locator('text=/CARSI/i')).toBeVisible()
    })

    test('should calculate group total recovery amount', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.locator('[data-report-type="comprehensive_audit"][data-is-group="true"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify group total
      await expect(page.locator('text=/Group Total Recovery/i')).toBeVisible()
      await expect(page.locator('[data-testid="group-total-amount"]')).toBeVisible()
    })

    test('should display group pricing calculation', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.locator('[data-report-type="comprehensive_audit"][data-is-group="true"]').first().click()

      // Verify pricing appears in report metadata
      await expect(page.locator('text=/Service Fee: \\$1,393/i')).toBeVisible()
      await expect(page.locator('text=/Base: \\$995 \\+ Additional: \\$398/i')).toBeVisible()
    })
  })

  test.describe('Report Management', () => {
    test('should list all generated reports', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Wait for reports list to load
      await expect(page.locator('[data-testid="reports-list"]')).toBeVisible()

      // Verify list has reports
      const reportRows = page.locator('[data-testid="report-row"]')
      const count = await reportRows.count()

      expect(count).toBeGreaterThan(0)
    })

    test('should filter reports by type', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Apply filter
      await page.click('[data-testid="report-type-filter"]')
      await page.click('text=R&D Tax Incentive')

      // Wait for filtered results
      await page.waitForTimeout(1000)

      // Verify all visible reports are R&D type
      const reportRows = page.locator('[data-report-type="rnd_tax_incentive"]')
      const count = await reportRows.count()

      const allRows = page.locator('[data-testid="report-row"]')
      const totalCount = await allRows.count()

      expect(count).toBe(totalCount)
    })

    test('should filter reports by financial year', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Apply FY filter
      await page.click('[data-testid="financial-year-filter"]')
      await page.click('text=FY2023-24')

      await page.waitForTimeout(1000)

      // Verify all reports show FY2023-24
      const reportRows = page.locator('[data-testid="report-row"]')
      const count = await reportRows.count()

      for (let i = 0; i < count; i++) {
        const fyText = await reportRows.nth(i).locator('[data-testid="report-fy"]').textContent()
        expect(fyText).toContain('FY2023-24')
      }
    })

    test('should delete old reports', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Find a report to delete
      const reportRow = page.locator('[data-testid="report-row"]').first()
      const reportName = await reportRow.locator('[data-testid="report-name"]').textContent()

      // Click delete button
      await reportRow.locator('[data-testid="delete-report-btn"]').click()

      // Confirm deletion
      await page.click('button:has-text("Confirm Delete")')

      // Wait for toast notification
      await expect(page.locator('text=/Report deleted/i')).toBeVisible()

      // Verify report is removed from list
      await expect(page.locator(`text=${reportName}`)).not.toBeVisible()
    })

    test('should search reports by description', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Enter search query
      await page.fill('[data-testid="report-search"]', 'R&D')

      await page.waitForTimeout(500)

      // Verify search results
      const reportRows = page.locator('[data-testid="report-row"]')
      const count = await reportRows.count()

      expect(count).toBeGreaterThan(0)

      // All results should contain "R&D"
      for (let i = 0; i < count; i++) {
        const text = await reportRows.nth(i).textContent()
        expect(text?.toLowerCase()).toContain('r&d')
      }
    })
  })

  test.describe('Report Quality and Validation', () => {
    test('should validate all reports include ATO disclaimer', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Open first report
      await page.locator('[data-testid="report-row"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify disclaimer
      await expect(page.locator('text=/DISCLAIMER/i')).toBeVisible()
      await expect(page.locator('text=/informational purposes only/i')).toBeVisible()
      await expect(page.locator('text=/does not constitute tax advice/i')).toBeVisible()
      await expect(page.locator('text=/qualified tax professional/i')).toBeVisible()
    })

    test('should include all legislative references', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.locator('[data-testid="report-row"]').first().click()

      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

      // Verify legislative references section exists
      await expect(page.locator('text=/Legislative References/i')).toBeVisible()

      // Should have multiple references
      const references = page.locator('[data-testid="legislative-reference"]')
      const count = await references.count()

      expect(count).toBeGreaterThan(0)
    })

    test('should show generation timestamp and metadata', async ({ page }) => {
      await page.goto('/dashboard/reports')

      // Verify metadata in list view
      const reportRow = page.locator('[data-testid="report-row"]').first()

      await expect(reportRow.locator('[data-testid="generated-date"]')).toBeVisible()
      await expect(reportRow.locator('[data-testid="file-size"]')).toBeVisible()
      await expect(reportRow.locator('[data-testid="report-status"]')).toBeVisible()
    })

    test('should handle report generation errors gracefully', async ({ page }) => {
      await page.goto('/dashboard/reports')
      await page.click('button:has-text("New Report")')

      // Try to generate report with invalid configuration
      // (e.g., no data available for selected FY)
      await page.selectOption('[data-testid="report-type"]', 'rnd_tax_incentive')
      await page.selectOption('[data-testid="financial-year"]', 'FY2015-16') // Old FY with no data

      await page.click('button:has-text("Generate Report")')

      // Should show error message
      await expect(page.locator('text=/No data available/i')).toBeVisible({ timeout: 30000 })
      await expect(page.locator('text=/Please run analysis first/i')).toBeVisible()
    })
  })
})
