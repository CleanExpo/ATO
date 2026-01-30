import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests: Settings and Configuration Workflow
 *
 * Tests user settings, preferences, and configuration management:
 * - User profile management
 * - Organization settings
 * - Analysis preferences
 * - Notification settings
 * - Data retention policies
 * - Export settings
 */

test.describe('Settings Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')
  })

  test.describe('User Profile Settings', () => {
    test('should display current user profile information', async ({ page }) => {
      // Verify profile section is visible
      await expect(page.locator('[data-testid="profile-section"]')).toBeVisible()

      // Verify user details are displayed
      await expect(page.locator('[data-testid="user-email"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-name"]')).toBeVisible()
    })

    test('should update user display name', async ({ page }) => {
      // Click edit profile button
      await page.click('button:has-text("Edit Profile")')

      // Update display name
      await page.fill('[data-testid="display-name-input"]', 'John Smith')

      // Save changes
      await page.click('button:has-text("Save Changes")')

      // Verify success message
      await expect(page.locator('text=/Profile updated/i')).toBeVisible()

      // Verify new name appears
      await expect(page.locator('[data-testid="user-name"]')).toContainText('John Smith')
    })

    test('should update notification preferences', async ({ page }) => {
      // Navigate to notifications tab
      await page.click('text=Notifications')

      // Toggle email notifications
      const emailToggle = page.locator('[data-testid="email-notifications-toggle"]')
      await emailToggle.click()

      // Toggle analysis complete notifications
      const analysisToggle = page.locator('[data-testid="analysis-complete-notifications"]')
      await analysisToggle.click()

      // Save preferences
      await page.click('button:has-text("Save Preferences")')

      // Verify saved
      await expect(page.locator('text=/Preferences saved/i')).toBeVisible()
    })

    test('should change password', async ({ page }) => {
      // Navigate to security tab
      await page.click('text=Security')

      // Click change password
      await page.click('button:has-text("Change Password")')

      // Fill in password form
      await page.fill('[data-testid="current-password"]', 'current-password')
      await page.fill('[data-testid="new-password"]', 'new-secure-password-123')
      await page.fill('[data-testid="confirm-password"]', 'new-secure-password-123')

      // Submit
      await page.click('button:has-text("Update Password")')

      // Verify success
      await expect(page.locator('text=/Password updated/i')).toBeVisible()
    })
  })

  test.describe('Organization Settings', () => {
    test('should display organization details', async ({ page }) => {
      // Select an organization first
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Qld Pty Ltd')

      // Navigate to organization settings
      await page.click('text=Organization Settings')

      // Verify org details are displayed
      await expect(page.locator('[data-testid="org-name"]')).toBeVisible()
      await expect(page.locator('[data-testid="org-name"]')).toContainText('Disaster Recovery Qld')

      await expect(page.locator('[data-testid="xero-connection-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="xero-tenant-id"]')).toBeVisible()
    })

    test('should configure organization display settings', async ({ page }) => {
      await page.click('[data-testid="org-selector"]')
      await page.click('text=Disaster Recovery Qld Pty Ltd')

      await page.click('text=Organization Settings')

      // Enable/disable features
      await page.check('[data-testid="enable-rnd-analysis"]')
      await page.check('[data-testid="enable-div7a-checking"]')
      await page.uncheck('[data-testid="enable-bad-debt-recovery"]')

      // Save settings
      await page.click('button:has-text("Save Settings")')

      // Verify saved
      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should set analysis thresholds', async ({ page }) => {
      await page.click('text=Organization Settings')

      // Set minimum transaction amount for analysis
      await page.fill('[data-testid="min-transaction-amount"]', '100')

      // Set confidence threshold
      await page.fill('[data-testid="min-confidence-threshold"]', '80')

      // Set high-value threshold
      await page.fill('[data-testid="high-value-threshold"]', '50000')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should configure financial year settings', async ({ page }) => {
      await page.click('text=Organization Settings')

      // Set FY end date
      await page.selectOption('[data-testid="fy-end-month"]', '6') // June
      await page.selectOption('[data-testid="fy-end-day"]', '30')

      // Set default FY for analysis
      await page.selectOption('[data-testid="default-fy"]', 'FY2023-24')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })
  })

  test.describe('Analysis Preferences', () => {
    test('should configure analysis modules', async ({ page }) => {
      await page.click('text=Analysis Preferences')

      // Select which modules to run by default
      await page.check('[data-testid="module-rnd-tax-incentive"]')
      await page.check('[data-testid="module-division-7a"]')
      await page.check('[data-testid="module-general-deductions"]')
      await page.uncheck('[data-testid="module-tax-losses"]')

      // Save
      await page.click('button:has-text("Save Preferences")')

      await expect(page.locator('text=/Preferences saved/i')).toBeVisible()
    })

    test('should set batch processing preferences', async ({ page }) => {
      await page.click('text=Analysis Preferences')

      // Set batch size
      await page.fill('[data-testid="batch-size"]', '50')

      // Set delay between AI requests
      await page.fill('[data-testid="ai-request-delay"]', '4000')

      // Enable/disable parallel processing
      await page.check('[data-testid="enable-parallel-processing"]')

      // Save
      await page.click('button:has-text("Save Preferences")')

      await expect(page.locator('text=/Preferences saved/i')).toBeVisible()
    })

    test('should configure R&D specific settings', async ({ page }) => {
      await page.click('text=Analysis Preferences')
      await page.click('text=R&D Settings')

      // Set offset rate (auto-detected by turnover)
      await page.selectOption('[data-testid="rnd-offset-rate"]', '0.435') // 43.5%

      // Set eligibility threshold
      await page.fill('[data-testid="min-rnd-confidence"]', '85')

      // Enable four-element test validation
      await page.check('[data-testid="require-four-element-test"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should configure Division 7A settings', async ({ page }) => {
      await page.click('text=Analysis Preferences')
      await page.click('text=Division 7A Settings')

      // Set benchmark rate for FY
      await page.fill('[data-testid="div7a-benchmark-rate"]', '0.0877') // 8.77%

      // Set loan term defaults
      await page.selectOption('[data-testid="default-loan-term-unsecured"]', '7')
      await page.selectOption('[data-testid="default-loan-term-secured"]', '25')

      // Enable automatic deemed dividend calculation
      await page.check('[data-testid="auto-calculate-deemed-dividend"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })
  })

  test.describe('Data Sync Settings', () => {
    test('should configure sync schedule', async ({ page }) => {
      await page.click('text=Data Sync')

      // Set sync frequency
      await page.selectOption('[data-testid="sync-frequency"]', 'daily')

      // Set sync time
      await page.fill('[data-testid="sync-time"]', '02:00')

      // Enable auto-sync
      await page.check('[data-testid="enable-auto-sync"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Sync settings saved/i')).toBeVisible()
    })

    test('should set data retention period', async ({ page }) => {
      await page.click('text=Data Sync')

      // Set how long to keep cached data
      await page.selectOption('[data-testid="cache-retention-period"]', '90') // 90 days

      // Enable automatic cleanup
      await page.check('[data-testid="enable-auto-cleanup"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should configure sync filters', async ({ page }) => {
      await page.click('text=Data Sync')
      await page.click('text=Filters')

      // Set date range for historical sync
      await page.selectOption('[data-testid="historical-sync-years"]', '5')

      // Filter transaction types
      await page.check('[data-testid="sync-bank-transactions"]')
      await page.check('[data-testid="sync-invoices"]')
      await page.check('[data-testid="sync-bills"]')
      await page.uncheck('[data-testid="sync-contacts"]')

      // Minimum transaction amount to sync
      await page.fill('[data-testid="min-sync-amount"]', '10')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })
  })

  test.describe('Report Settings', () => {
    test('should set default report format', async ({ page }) => {
      await page.click('text=Reports')

      // Set default format
      await page.selectOption('[data-testid="default-report-format"]', 'pdf')

      // Enable/disable report sections
      await page.check('[data-testid="include-executive-summary"]')
      await page.check('[data-testid="include-detailed-analysis"]')
      await page.check('[data-testid="include-legislative-references"]')
      await page.check('[data-testid="include-recommendations"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should configure report branding', async ({ page }) => {
      await page.click('text=Reports')
      await page.click('text=Branding')

      // Enable custom branding
      await page.check('[data-testid="enable-custom-branding"]')

      // Upload logo (simulate)
      if (await page.locator('[data-testid="logo-upload"]').isVisible()) {
        await expect(page.locator('[data-testid="logo-upload"]')).toBeVisible()
      }

      // Set company name override
      await page.fill('[data-testid="report-company-name"]', 'Disaster Recovery Qld Pty Ltd')

      // Set footer text
      await page.fill('[data-testid="report-footer-text"]', 'Prepared by Australian Tax Optimizer')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should set report auto-generation triggers', async ({ page }) => {
      await page.click('text=Reports')
      await page.click('text=Auto-Generation')

      // Auto-generate report after analysis
      await page.check('[data-testid="auto-generate-after-analysis"]')

      // Auto-generate monthly summary
      await page.check('[data-testid="auto-generate-monthly-summary"]')

      // Email reports automatically
      await page.check('[data-testid="auto-email-reports"]')
      await page.fill('[data-testid="report-email-recipients"]', 'accountant@example.com')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })
  })

  test.describe('Export Settings', () => {
    test('should configure CSV export format', async ({ page }) => {
      await page.click('text=Export')

      // Set CSV delimiter
      await page.selectOption('[data-testid="csv-delimiter"]', ',')

      // Set date format
      await page.selectOption('[data-testid="csv-date-format"]', 'YYYY-MM-DD')

      // Set number format
      await page.selectOption('[data-testid="csv-number-format"]', 'en-AU')

      // Include headers
      await page.check('[data-testid="csv-include-headers"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })

    test('should set Excel export preferences', async ({ page }) => {
      await page.click('text=Export')
      await page.click('text=Excel')

      // Include formulas
      await page.check('[data-testid="excel-include-formulas"]')

      // Include formatting
      await page.check('[data-testid="excel-include-formatting"]')

      // Include charts
      await page.check('[data-testid="excel-include-charts"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      await expect(page.locator('text=/Settings saved/i')).toBeVisible()
    })
  })

  test.describe('Integrations', () => {
    test('should display connected Xero organizations', async ({ page }) => {
      await page.click('text=Integrations')

      // Verify Xero section
      await expect(page.locator('[data-testid="xero-integration"]')).toBeVisible()

      // Verify connected organizations
      await expect(page.locator('text=Connected Organizations')).toBeVisible()
      await expect(page.locator('[data-testid="connected-org"]')).toHaveCount(3)
    })

    test('should disconnect Xero organization', async ({ page }) => {
      await page.click('text=Integrations')

      // Find an organization to disconnect
      const orgRow = page.locator('[data-testid="connected-org"]').last()

      // Click disconnect
      await orgRow.locator('button:has-text("Disconnect")').click()

      // Confirm
      await page.click('button:has-text("Confirm Disconnect")')

      // Verify disconnected
      await expect(page.locator('text=/Disconnected successfully/i')).toBeVisible()
    })

    test('should reconnect Xero organization', async ({ page }) => {
      await page.click('text=Integrations')

      // Click "Connect Organization"
      await page.click('button:has-text("Connect Xero Organization")')

      // Should redirect to Xero OAuth
      await expect(page).toHaveURL(/.*xero\.com\/identity\/connect/i, { timeout: 10000 })
    })
  })

  test.describe('Billing and Subscription', () => {
    test('should display current subscription plan', async ({ page }) => {
      await page.click('text=Billing')

      // Verify plan details
      await expect(page.locator('[data-testid="current-plan"]')).toBeVisible()
      await expect(page.locator('[data-testid="plan-price"]')).toBeVisible()

      // Verify organization count and pricing
      await expect(page.locator('text=/3 organizations/i')).toBeVisible()
      await expect(page.locator('text=/\\$1,393/i')).toBeVisible()
    })

    test('should display pricing breakdown', async ({ page }) => {
      await page.click('text=Billing')

      // Verify pricing breakdown
      await expect(page.locator('text=/Base: \\$995/i')).toBeVisible()
      await expect(page.locator('text=/Additional: \\$398/i')).toBeVisible()

      // Breakdown: 2 × $199
      await expect(page.locator('text=/2 additional organizations/i')).toBeVisible()
    })

    test('should show billing history', async ({ page }) => {
      await page.click('text=Billing')
      await page.click('text=Billing History')

      // Verify invoice list
      await expect(page.locator('[data-testid="invoice-row"]')).toHaveCount((count) => count > 0)

      // Verify invoice details
      const firstInvoice = page.locator('[data-testid="invoice-row"]').first()
      await expect(firstInvoice.locator('[data-testid="invoice-date"]')).toBeVisible()
      await expect(firstInvoice.locator('[data-testid="invoice-amount"]')).toBeVisible()
      await expect(firstInvoice.locator('[data-testid="invoice-status"]')).toBeVisible()
    })

    test('should download invoice', async ({ page }) => {
      await page.click('text=Billing')
      await page.click('text=Billing History')

      const firstInvoice = page.locator('[data-testid="invoice-row"]').first()

      // Click download
      const downloadPromise = page.waitForEvent('download')
      await firstInvoice.locator('button:has-text("Download")').click()

      const download = await downloadPromise

      // Verify filename
      expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf/i)
    })
  })

  test.describe('Advanced Settings', () => {
    test('should enable debug mode', async ({ page }) => {
      await page.click('text=Advanced')

      // Enable debug mode
      await page.check('[data-testid="enable-debug-mode"]')

      // Save
      await page.click('button:has-text("Save Settings")')

      // Verify enabled
      await expect(page.locator('text=/Debug mode enabled/i')).toBeVisible()
    })

    test('should clear all cached data', async ({ page }) => {
      await page.click('text=Advanced')

      // Click clear cache
      await page.click('button:has-text("Clear All Cache")')

      // Confirm
      await page.click('button:has-text("Confirm Clear Cache")')

      // Verify cleared
      await expect(page.locator('text=/Cache cleared/i')).toBeVisible()
    })

    test('should export all data', async ({ page }) => {
      await page.click('text=Advanced')

      // Click export all data
      const downloadPromise = page.waitForEvent('download')
      await page.click('button:has-text("Export All Data")')

      const download = await downloadPromise

      // Verify filename
      expect(download.suggestedFilename()).toMatch(/data-export.*\.(zip|json)/i)
    })

    test('should reset settings to defaults', async ({ page }) => {
      await page.click('text=Advanced')

      // Click reset to defaults
      await page.click('button:has-text("Reset to Defaults")')

      // Confirm
      await page.click('button:has-text("Confirm Reset")')

      // Verify reset
      await expect(page.locator('text=/Settings reset to defaults/i')).toBeVisible()
    })
  })

  test.describe('Settings Validation', () => {
    test('should validate numeric inputs', async ({ page }) => {
      await page.click('text=Organization Settings')

      // Try to enter invalid number
      await page.fill('[data-testid="min-transaction-amount"]', '-100')

      // Try to save
      await page.click('button:has-text("Save Settings")')

      // Should show error
      await expect(page.locator('text=/must be greater than 0/i')).toBeVisible()
    })

    test('should validate email addresses', async ({ page }) => {
      await page.click('text=Reports')
      await page.click('text=Auto-Generation')

      // Enter invalid email
      await page.fill('[data-testid="report-email-recipients"]', 'invalid-email')

      // Try to save
      await page.click('button:has-text("Save Settings")')

      // Should show error
      await expect(page.locator('text=/invalid email/i')).toBeVisible()
    })

    test('should require confirmation for destructive actions', async ({ page }) => {
      await page.click('text=Advanced')

      // Click clear cache (destructive action)
      await page.click('button:has-text("Clear All Cache")')

      // Should show confirmation dialog
      await expect(page.locator('text=/Are you sure/i')).toBeVisible()
      await expect(page.locator('button:has-text("Confirm Clear Cache")')).toBeVisible()
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible()
    })
  })
})
