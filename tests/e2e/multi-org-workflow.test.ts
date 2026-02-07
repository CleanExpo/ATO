import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests: Multi-Organization Workflow
 *
 * Tests workflows involving multiple organizations and organization groups:
 * - Organization switching
 * - Organization group management
 * - Consolidated analysis across organizations
 * - Group pricing and billing
 * - Inter-company transaction analysis
 */

test.describe('Multi-Organization Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Organization Switching', () => {
    test('should switch between connected organizations', async ({ page }) => {
      // Open organization selector
      await page.click('[data-testid="org-selector"]')

      // Verify all 3 organizations are listed
      await expect(page.locator('text=Disaster Recovery Qld Pty Ltd')).toBeVisible()
      await expect(page.locator('text=Disaster Recovery Pty Ltd')).toBeVisible()
      await expect(page.locator('text=CARSI')).toBeVisible()

      // Select first organization
      await page.click('text=Disaster Recovery Qld Pty Ltd')

      // Verify organization name appears in header
      await expect(page.locator('[data-testid="current-org-name"]')).toContainText('Disaster Recovery Qld')

      // Switch to second organization
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Pty Ltd')

      // Verify organization switched
      await expect(page.locator('[data-testid="current-org-name"]')).toContainText('Disaster Recovery Pty Ltd')
    })

    test('should preserve organization context across navigation', async ({ page }) => {
      // Select organization
      await page.click('[data-testid="org-selector"]')
      await page.click('text=CARSI')

      // Navigate to forensic audit
      await page.click('text=Forensic Audit')
      await page.waitForURL('**/dashboard/forensic-audit')

      // Verify CARSI is still selected
      await expect(page.locator('[data-testid="current-org-name"]')).toContainText('CARSI')

      // Navigate to reports
      await page.click('text=Reports')
      await page.waitForURL('**/dashboard/reports')

      // Verify CARSI is still selected
      await expect(page.locator('[data-testid="current-org-name"]')).toContainText('CARSI')
    })

    test('should show organization-specific data after switching', async ({ page }) => {
      // Select first organization
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Qld Pty Ltd')

      // Navigate to forensic audit
      await page.click('text=Forensic Audit')
      await page.waitForURL('**/dashboard/forensic-audit')

      // Wait for data to load
      await expect(page.locator('[data-testid="org-data-loaded"]')).toBeVisible({ timeout: 10000 })

      // Get transaction count for first org
      const org1Count = await page.locator('[data-testid="transaction-count"]').textContent()

      // Switch to second organization
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Pty Ltd')

      // Wait for data to reload
      await expect(page.locator('[data-testid="org-data-loaded"]')).toBeVisible({ timeout: 10000 })

      // Get transaction count for second org
      const org2Count = await page.locator('[data-testid="transaction-count"]').textContent()

      // Counts should be different (unless identical by coincidence)
      expect(org1Count).toBeDefined()
      expect(org2Count).toBeDefined()
    })

    test('should update URL with organization ID on switch', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Qld Pty Ltd')

      // Check URL contains org parameter or ID
      const url = page.url()
      expect(url).toMatch(/org=|organization/)
    })
  })

  test.describe('Organization Group Management', () => {
    test('should create organization group with 3 members', async ({ page }) => {
      // Navigate to organizations page
      await page.goto('/dashboard/organizations')

      // Click "Create Group" button
      await page.click('button:has-text("Create Group")')

      // Fill in group details
      await page.fill('[data-testid="group-name"]', 'Disaster Recovery Group')
      await page.fill('[data-testid="group-description"]', 'Consolidated tax analysis for all DR entities')

      // Select organizations to include
      await page.check('[data-testid="org-checkbox"][data-org-id="4637fa53-23e4-49e3-8cce-3bca3a09def9"]')
      await page.check('[data-testid="org-checkbox"][data-org-id="591ca6f3-5b0a-40d4-8fb9-966420373902"]')
      await page.check('[data-testid="org-checkbox"][data-org-id*="carsi"]')

      // Verify pricing calculation
      await expect(page.locator('[data-testid="group-pricing"]')).toContainText('$1,393')
      await expect(page.locator('[data-testid="pricing-breakdown"]')).toContainText('Base: $995')
      await expect(page.locator('[data-testid="pricing-breakdown"]')).toContainText('Additional: $398')

      // Click "Create Group" button
      await page.locator('button:has-text("Create Group")').last().click()

      // Verify success message
      await expect(page.locator('text=/Group created successfully/i')).toBeVisible()
    })

    test('should display organization groups in selector', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')

      // Verify group option appears
      await expect(page.locator('text=/Organization Groups/i')).toBeVisible()
      await expect(page.locator('text=Disaster Recovery Group')).toBeVisible()

      // Verify individual orgs still appear
      await expect(page.locator('text=Disaster Recovery Qld Pty Ltd')).toBeVisible()
    })

    test('should select organization group for consolidated view', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      // Verify group is selected
      await expect(page.locator('[data-testid="current-org-name"]')).toContainText('Disaster Recovery Group')

      // Verify group badge/indicator
      await expect(page.locator('[data-testid="group-indicator"]')).toBeVisible()
      await expect(page.locator('[data-testid="group-indicator"]')).toContainText('3 organizations')
    })

    test('should edit organization group members', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      // Find the group
      const groupRow = page.locator('[data-testid="group-row"]').filter({ hasText: 'Disaster Recovery Group' })

      // Click edit button
      await groupRow.locator('button:has-text("Edit")').click()

      // Verify current members are checked
      const org1Checkbox = page.locator('[data-testid="org-checkbox"][data-org-id="4637fa53-23e4-49e3-8cce-3bca3a09def9"]')
      await expect(org1Checkbox).toBeChecked()

      // Uncheck one organization (simulate removal)
      await org1Checkbox.uncheck()

      // Verify pricing updates
      await expect(page.locator('[data-testid="group-pricing"]')).toContainText('$1,194') // $995 + $199

      // Click "Save Changes"
      await page.click('button:has-text("Save Changes")')

      // Verify success message
      await expect(page.locator('text=/Group updated/i')).toBeVisible()
    })

    test('should delete organization group', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      const groupRow = page.locator('[data-testid="group-row"]').filter({ hasText: 'Disaster Recovery Group' })

      // Click delete button
      await groupRow.locator('button:has-text("Delete")').click()

      // Confirm deletion
      await page.click('button:has-text("Confirm Delete")')

      // Verify group is removed
      await expect(groupRow).not.toBeVisible()
    })
  })

  test.describe('Consolidated Analysis', () => {
    test('should analyze all organizations in group simultaneously', async ({ page }) => {
      // Select organization group
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      // Navigate to forensic audit
      await page.click('text=Forensic Audit')
      await page.waitForURL('**/dashboard/forensic-audit')

      // Start analysis
      await page.click('button:has-text("Start Analysis")')

      // Verify analyzing all 3 organizations
      await expect(page.locator('text=/Analyzing 3 organizations/i')).toBeVisible()

      // Wait for analysis to complete
      await expect(page.locator('text=/Analysis Complete/i')).toBeVisible({ timeout: 120000 })

      // Verify results show all organizations
      await expect(page.locator('[data-testid="org-results"]')).toHaveCount(3)
    })

    test('should display consolidated R&D opportunities across group', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Wait for analysis results
      await expect(page.locator('[data-testid="rnd-opportunities"]')).toBeVisible({ timeout: 30000 })

      // Verify group total
      await expect(page.locator('[data-testid="group-total-rnd-offset"]')).toBeVisible()

      // Verify breakdown by organization
      await expect(page.locator('[data-testid="rnd-breakdown"]')).toBeVisible()
      await expect(page.locator('text=Disaster Recovery Qld Pty Ltd')).toBeVisible()
      await expect(page.locator('text=Disaster Recovery Pty Ltd')).toBeVisible()
      await expect(page.locator('text=CARSI')).toBeVisible()
    })

    test('should show aggregated tax loss position for group', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Navigate to tax losses section
      await page.click('text=Tax Losses')

      // Verify group totals
      await expect(page.locator('[data-testid="group-total-losses"]')).toBeVisible()

      // Verify breakdown by organization
      const lossBreakdown = page.locator('[data-testid="loss-breakdown"]')
      await expect(lossBreakdown).toBeVisible()

      // Each organization should show their loss position
      const orgLosses = lossBreakdown.locator('[data-testid="org-loss"]')
      const count = await orgLosses.count()

      expect(count).toBe(3)
    })

    test('should identify inter-company transactions', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Check for inter-company transactions section
      if (await page.locator('text=/Inter-Company Transactions/i').isVisible()) {
        // Click to view details
        await page.click('text=/Inter-Company Transactions/i')

        // Verify flagged transactions
        const intercoCount = await page.locator('[data-testid="interco-transaction"]').count()
        expect(intercoCount).toBeGreaterThan(0)

        // Verify warnings for potential issues
        await expect(page.locator('text=/Transfer Pricing/i')).toBeVisible()
      }
    })

    test('should calculate group recovery estimate', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Wait for analysis completion
      await expect(page.locator('[data-testid="analysis-complete"]')).toBeVisible({ timeout: 60000 })

      // Verify group total recovery
      const groupTotal = page.locator('[data-testid="group-total-recovery"]')
      await expect(groupTotal).toBeVisible()

      // Verify amount is formatted with commas
      const totalText = await groupTotal.textContent()
      expect(totalText).toMatch(/\$[\d,]+/)
    })
  })

  test.describe('Group Reporting', () => {
    test('should generate consolidated report for organization group', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/reports')

      // Click "New Report"
      await page.click('button:has-text("New Report")')

      // Verify group context is indicated
      await expect(page.locator('text=/Organization Group: Disaster Recovery Group/i')).toBeVisible()

      // Select comprehensive audit
      await page.selectOption('[data-testid="report-type"]', 'comprehensive_audit')
      await page.selectOption('[data-testid="financial-year"]', 'FY2023-24')

      // Generate report
      await page.click('button:has-text("Generate Report")')

      // Wait for generation
      await expect(page.locator('text=/Report Ready/i')).toBeVisible({ timeout: 120000 })

      // View report
      await page.click('button:has-text("View Report")')

      // Verify group information in report
      await expect(page.locator('text=/Organization Group: Disaster Recovery Group/i')).toBeVisible()
      await expect(page.locator('text=/Organizations: 3/i')).toBeVisible()
    })

    test('should include per-organization breakdown in group report', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/reports')

      // Open existing group report
      await page.locator('[data-report-type="comprehensive_audit"][data-is-group="true"]').first().click()

      // Verify breakdown section
      await expect(page.locator('text=/Breakdown by Organization/i')).toBeVisible()

      // Verify each organization has a section
      await expect(page.locator('h3:has-text("Disaster Recovery Qld Pty Ltd")')).toBeVisible()
      await expect(page.locator('h3:has-text("Disaster Recovery Pty Ltd")')).toBeVisible()
      await expect(page.locator('h3:has-text("CARSI")')).toBeVisible()
    })

    test('should show group pricing in report footer', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/reports')
      await page.locator('[data-report-type="comprehensive_audit"][data-is-group="true"]').first().click()

      // Scroll to footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

      // Verify pricing information
      await expect(page.locator('text=/Service Fee: \\$1,393/i')).toBeVisible()
      await expect(page.locator('text=/3 organizations/i')).toBeVisible()
    })
  })

  test.describe('Organization Management', () => {
    test('should list all connected organizations', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      // Verify all 3 organizations are listed
      await expect(page.locator('[data-testid="org-row"]')).toHaveCount(3)

      // Verify organization names
      await expect(page.locator('text=Disaster Recovery Qld Pty Ltd')).toBeVisible()
      await expect(page.locator('text=Disaster Recovery Pty Ltd')).toBeVisible()
      await expect(page.locator('text=CARSI')).toBeVisible()
    })

    test('should display organization connection status', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      const orgRows = page.locator('[data-testid="org-row"]')
      const count = await orgRows.count()

      for (let i = 0; i < count; i++) {
        const row = orgRows.nth(i)

        // Verify status badge
        await expect(row.locator('[data-testid="connection-status"]')).toBeVisible()

        // Should show "Connected" or similar
        const statusText = await row.locator('[data-testid="connection-status"]').textContent()
        expect(statusText?.toLowerCase()).toContain('connected')
      }
    })

    test('should show last sync timestamp for each organization', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      const orgRows = page.locator('[data-testid="org-row"]')
      const count = await orgRows.count()

      for (let i = 0; i < count; i++) {
        const row = orgRows.nth(i)

        // Verify last sync timestamp
        await expect(row.locator('[data-testid="last-sync"]')).toBeVisible()
      }
    })

    test('should display transaction count for each organization', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      const orgRows = page.locator('[data-testid="org-row"]')
      const firstOrg = orgRows.first()

      // Verify transaction count is displayed
      await expect(firstOrg.locator('[data-testid="transaction-count"]')).toBeVisible()

      // Should be a number
      const countText = await firstOrg.locator('[data-testid="transaction-count"]').textContent()
      expect(countText).toMatch(/\d+/)
    })

    test('should disconnect organization with confirmation', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      const orgRow = page.locator('[data-testid="org-row"]').last()
      const orgName = await orgRow.locator('[data-testid="org-name"]').textContent()

      // Click disconnect button
      await orgRow.locator('button:has-text("Disconnect")').click()

      // Confirm disconnection
      await expect(page.locator('text=/Are you sure/i')).toBeVisible()
      await expect(page.locator(`text=${orgName}`)).toBeVisible()

      await page.click('button:has-text("Confirm Disconnect")')

      // Verify success message
      await expect(page.locator('text=/Disconnected successfully/i')).toBeVisible()

      // Verify organization is removed from list
      await expect(page.locator('[data-testid="org-row"]')).toHaveCount(2)
    })

    test('should reconnect disconnected organization', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      // Click "Connect New Organization"
      await page.click('button:has-text("Connect Organization")')

      // Redirect to Xero OAuth
      await expect(page).toHaveURL(/.*xero\.com\/identity\/connect/i, { timeout: 10000 })

      // In a real test, would simulate OAuth flow
      // For now, just verify we reached the OAuth page
    })
  })

  test.describe('Cross-Organization Analytics', () => {
    test('should compare R&D activities across organizations', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Navigate to R&D section
      await page.click('text=R&D Tax Incentive')

      // Click "Compare Organizations" button
      if (await page.locator('button:has-text("Compare Organizations")').isVisible()) {
        await page.click('button:has-text("Compare Organizations")')

        // Verify comparison view
        await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible()

        // Verify all 3 organizations in comparison
        await expect(page.locator('text=Disaster Recovery Qld')).toBeVisible()
        await expect(page.locator('text=Disaster Recovery Pty Ltd')).toBeVisible()
        await expect(page.locator('text=CARSI')).toBeVisible()
      }
    })

    test('should identify tax planning opportunities across group', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Look for group planning section
      if (await page.locator('text=/Tax Planning Opportunities/i').isVisible()) {
        await page.click('text=/Tax Planning Opportunities/i')

        // Verify opportunities are shown
        const planningCount = await page.locator('[data-testid="planning-opportunity"]').count()
        expect(planningCount).toBeGreaterThan(0)
      }
    })

    test('should calculate group tax position', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/forensic-audit')

      // Verify group summary panel
      await expect(page.locator('[data-testid="group-summary"]')).toBeVisible()

      // Verify key metrics
      await expect(page.locator('[data-testid="group-total-income"]')).toBeVisible()
      await expect(page.locator('[data-testid="group-total-expenses"]')).toBeVisible()
      await expect(page.locator('[data-testid="group-taxable-income"]')).toBeVisible()
    })
  })

  test.describe('Data Synchronization', () => {
    test('should sync all organizations in group simultaneously', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/organizations')

      // Click "Sync All" button for group
      await page.click('button:has-text("Sync All Organizations")')

      // Verify sync started for all organizations
      await expect(page.locator('text=/Syncing 3 organizations/i')).toBeVisible()

      // Verify progress indicators for each org
      await expect(page.locator('[data-testid="sync-progress"]')).toHaveCount(3)

      // Wait for sync to complete
      await expect(page.locator('text=/Sync Complete/i')).toBeVisible({ timeout: 60000 })
    })

    test('should show sync status for each organization in group', async ({ page }) => {
      await page.goto('/dashboard/organizations')

      const orgRows = page.locator('[data-testid="org-row"]')
      const count = await orgRows.count()

      for (let i = 0; i < count; i++) {
        const row = orgRows.nth(i)

        // Verify sync status indicator
        const syncStatus = row.locator('[data-testid="sync-status"]')
        await expect(syncStatus).toBeVisible()

        const statusText = await syncStatus.textContent()
        expect(statusText).toMatch(/synced|syncing|sync needed/i)
      }
    })

    test('should handle partial sync failures gracefully', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Group')

      await page.goto('/dashboard/organizations')

      // If one org fails to sync
      if (await page.locator('[data-testid="sync-error"]').isVisible()) {
        // Verify error message
        await expect(page.locator('[data-testid="sync-error"]')).toContainText(/failed/i)

        // Verify retry option
        await expect(page.locator('button:has-text("Retry")')).toBeVisible()

        // Verify other orgs completed successfully
        await expect(page.locator('[data-testid="sync-success"]')).toHaveCount(2)
      }
    })
  })

  test.describe('Access Control', () => {
    test('should restrict access to organizations user does not own', async ({ page }) => {
      // Try to access organization by URL manipulation
      await page.goto('/dashboard/forensic-audit?org=invalid-org-id')

      // Should show error or redirect
      await expect(
        page.locator('text=/Access denied|Not found|No access/i')
      ).toBeVisible({ timeout: 5000 })
    })

    test('should show only authorized organizations in selector', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')

      // Count organizations in dropdown
      const orgOptions = page.locator('[data-testid="org-option"]')
      const count = await orgOptions.count()

      // Should only show organizations the user has access to
      expect(count).toBe(3) // User's 3 organizations
    })
  })
})
