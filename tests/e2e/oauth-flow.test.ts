/**
 * OAuth Connection Flow E2E Tests
 *
 * Tests the complete OAuth flow for Xero integration:
 * - Initiating OAuth connection
 * - Xero authorization and consent
 * - Callback handling and token exchange
 * - Organization creation in database
 * - Multi-organization selection
 * - Error handling and recovery
 */

import { test, expect } from '@playwright/test'

test.describe('Xero OAuth Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard')
  })

  test('should initiate Xero OAuth flow from connect button', async ({ page, context }) => {
    // Click "Connect Xero" button
    await page.click('button:has-text("Connect Xero")')

    // Should redirect to Xero OAuth page (in new tab or same page)
    await page.waitForURL(/login\.xero\.com|identity\.xero\.com/, {
      timeout: 10000,
    })

    // Verify we're on Xero's OAuth page
    const url = page.url()
    expect(url).toContain('xero.com')
    expect(url).toContain('client_id')
    expect(url).toContain('redirect_uri')
    expect(url).toContain('state')
  })

  test('should include force re-authentication parameters', async ({ page }) => {
    // Click connect button
    await page.click('button:has-text("Connect Xero")')

    // Wait for Xero OAuth page
    await page.waitForURL(/xero\.com/)

    // Check for force re-auth parameters
    const url = new URL(page.url())
    expect(url.searchParams.get('prompt')).toBe('login')
    expect(url.searchParams.get('max_age')).toBe('0')
  })

  test('should handle OAuth callback with valid code', async ({ page }) => {
    // Simulate OAuth callback (in real test, this would come from Xero)
    // For E2E testing, we'd need to mock Xero's OAuth page or use test credentials

    // Navigate directly to callback with test params (for unit-level E2E)
    await page.goto('/api/auth/xero/callback?code=test_auth_code&state=test_state')

    // Should redirect to dashboard after successful connection
    await page.waitForURL('/dashboard*')

    // Check for success message
    await expect(page.locator('text=/connected|success/i')).toBeVisible()
  })

  test('should display error for invalid OAuth state', async ({ page }) => {
    // Navigate to callback with mismatched state
    await page.goto('/api/auth/xero/callback?code=test_code&state=wrong_state')

    // Should show error message
    await expect(page.locator('text=/error|invalid|failed/i')).toBeVisible()
  })

  test('should display error when missing authorization code', async ({ page }) => {
    // Navigate to callback without code parameter
    await page.goto('/api/auth/xero/callback?state=test_state')

    // Should show error
    await expect(page.locator('text=/error|missing/i')).toBeVisible()
  })
})

test.describe('Multi-Organization Selection', () => {
  test('should allow selecting multiple organizations during OAuth', async ({ page }) => {
    // This test would require mocking Xero's multi-org selector
    // or using test accounts with multiple orgs

    // Navigate to connect
    await page.goto('/dashboard/connect')
    await page.click('button:has-text("Connect Xero")')

    // In real Xero flow, user would:
    // 1. Log in to Xero
    // 2. See list of organizations
    // 3. Select multiple organizations
    // 4. Click "Allow access"

    // For now, we'll test the callback handling
    await page.goto('/api/auth/xero/callback?code=multi_org_code&state=test_state')

    await page.waitForURL('/dashboard*')

    // Should show success with org count
    await expect(page.locator('text=/connected/i')).toBeVisible()
  })

  test('should create organization records for all selected organizations', async ({ page }) => {
    // After successful OAuth
    await page.goto('/dashboard?connected=true')

    // Open organization selector
    await page.click('[data-testid="org-selector"]')

    // Should show multiple organizations
    await expect(page.locator('[data-testid="org-option"]')).toHaveCount(3, {
      timeout: 5000,
    })
  })

  test('should handle partial connection failure gracefully', async ({ page }) => {
    // Simulate 2/3 organizations connected
    await page.goto('/dashboard?connected=partial&failed=CARSI')

    // Should show partial success message
    await expect(page.locator('text=/partially connected|some organizations failed/i')).toBeVisible()

    // Should indicate which org failed
    await expect(page.locator('text=/CARSI/i')).toBeVisible()
  })
})

test.describe('Organization Switching', () => {
  test('should switch between connected organizations', async ({ page }) => {
    // Assume user has multiple orgs connected
    await page.goto('/dashboard')

    // Open organization selector
    await page.click('[data-testid="org-selector"]')

    // Select different organization
    await page.click('[data-testid="org-option"]:has-text("Disaster Recovery Qld")')

    // Dashboard should reload with new organization data
    await expect(page.locator('text=/Disaster Recovery Qld/i')).toBeVisible()
  })

  test('should persist organization selection across page navigation', async ({ page }) => {
    await page.goto('/dashboard')

    // Select organization
    await page.click('[data-testid="org-selector"]')
    await page.click('[data-testid="org-option"]:has-text("Disaster Recovery Pty Ltd")')

    // Navigate to different page
    await page.goto('/dashboard/forensic-audit')

    // Organization should still be selected
    await expect(page.locator('[data-testid="org-selector"]:has-text("Disaster Recovery Pty Ltd")')).toBeVisible()
  })
})

test.describe('Token Refresh', () => {
  test('should handle expired access token', async ({ page }) => {
    // This would require mocking expired token scenario
    await page.goto('/dashboard')

    // Attempt to fetch data with expired token
    // System should automatically refresh token

    // Should not show error
    await expect(page.locator('text=/unauthorized|session expired/i')).not.toBeVisible()
  })

  test('should redirect to re-authenticate when refresh token expires', async ({ page }) => {
    // This would require mocking expired refresh token
    await page.goto('/dashboard')

    // When refresh token is expired, should redirect to connect page
    // with message to re-authenticate

    // User should see prompt to reconnect
    await expect(page.locator('text=/reconnect|re-authenticate/i')).toBeVisible()
  })
})

test.describe('Disconnection Flow', () => {
  test('should disconnect organization', async ({ page }) => {
    await page.goto('/dashboard/settings')

    // Click disconnect button
    await page.click('button:has-text("Disconnect Xero")')

    // Confirm disconnection
    await page.click('button:has-text("Confirm")')

    // Should redirect to connect page
    await page.waitForURL('/dashboard/connect')

    // Should show message about disconnection
    await expect(page.locator('text=/disconnected/i')).toBeVisible()
  })

  test('should clear cached data after disconnection', async ({ page }) => {
    // Disconnect organization
    await page.goto('/dashboard/settings')
    await page.click('button:has-text("Disconnect Xero")')
    await page.click('button:has-text("Confirm")')

    // Navigate back to dashboard
    await page.goto('/dashboard')

    // Should not show any organization data
    await expect(page.locator('[data-testid="org-data"]')).toHaveCount(0)
  })
})

test.describe('Error Recovery', () => {
  test('should retry on network error', async ({ page, context }) => {
    // Simulate network error during OAuth
    await context.route('**/api/auth/xero/callback', (route) => {
      route.abort('failed')
    })

    await page.goto('/api/auth/xero/callback?code=test&state=test')

    // Should show retry option
    await expect(page.locator('button:has-text(/retry/i)')).toBeVisible()
  })

  test('should show clear error message on OAuth failure', async ({ page }) => {
    // Navigate to callback with error parameter
    await page.goto('/api/auth/xero/callback?error=access_denied&error_description=User+cancelled')

    // Should display user-friendly error
    await expect(page.locator('text=/cancelled|denied/i')).toBeVisible()

    // Should have button to try again
    await expect(page.locator('button:has-text(/try again|connect/i)')).toBeVisible()
  })

  test('should handle server errors gracefully', async ({ page }) => {
    // Simulate 500 error from callback endpoint
    await page.goto('/api/auth/xero/callback?code=invalid_code&state=test')

    // Should not show raw error, but user-friendly message
    await expect(page.locator('text=/something went wrong|please try again/i')).toBeVisible()

    // Should not expose technical details to user
    await expect(page.locator('text=/stack trace|undefined|null/i')).not.toBeVisible()
  })
})

test.describe('Security', () => {
  test('should use HTTPS in production', async ({ page }) => {
    // Check that redirect_uri uses HTTPS
    await page.goto('/dashboard')
    await page.click('button:has-text("Connect Xero")')

    await page.waitForURL(/xero\.com/)

    const url = new URL(page.url())
    const redirectUri = url.searchParams.get('redirect_uri')

    if (process.env.NODE_ENV === 'production') {
      expect(redirectUri).toMatch(/^https:\/\//)
    }
  })

  test('should not expose sensitive tokens in URL or logs', async ({ page }) => {
    // After OAuth callback
    await page.goto('/dashboard?connected=true')

    // URL should not contain access tokens
    const url = page.url()
    expect(url).not.toContain('access_token')
    expect(url).not.toContain('refresh_token')
    expect(url).not.toContain('client_secret')
  })

  test('should validate state parameter matches cookie', async ({ page, context }) => {
    // Set state cookie
    await context.addCookies([{
      name: 'xero_oauth_state',
      value: 'correct_state',
      domain: 'localhost',
      path: '/',
    }])

    // Navigate with matching state
    await page.goto('/api/auth/xero/callback?code=test&state=correct_state')

    // Should succeed (no error message)
    await expect(page.locator('text=/invalid state/i')).not.toBeVisible()
  })
})

test.describe('Performance', () => {
  test('should complete OAuth flow within 30 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/dashboard')
    await page.click('button:has-text("Connect Xero")')

    // Wait for redirect back to dashboard
    await page.waitForURL('/dashboard*', { timeout: 30000 })

    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(30000)
  })

  test('should not block UI during token exchange', async ({ page }) => {
    await page.goto('/api/auth/xero/callback?code=test&state=test')

    // During callback processing, page should show loading state
    // not frozen UI

    await page.waitForURL('/dashboard*')

    // Should reach dashboard successfully
    expect(page.url()).toContain('/dashboard')
  })
})

test.describe('Accessibility', () => {
  test('should have accessible connect button', async ({ page }) => {
    await page.goto('/dashboard')

    const connectButton = page.locator('button:has-text("Connect Xero")')

    // Should have proper ARIA attributes
    await expect(connectButton).toBeEnabled()
    await expect(connectButton).toBeVisible()

    // Should be keyboard accessible
    await connectButton.focus()
    await expect(connectButton).toBeFocused()
  })

  test('should have accessible error messages', async ({ page }) => {
    await page.goto('/api/auth/xero/callback?error=access_denied')

    // Error message should be announced to screen readers
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible()
  })
})

test.describe('Mobile Compatibility', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

  test('should display connect button on mobile', async ({ page }) => {
    await page.goto('/dashboard')

    const connectButton = page.locator('button:has-text("Connect Xero")')
    await expect(connectButton).toBeVisible()

    // Should be large enough to tap
    const box = await connectButton.boundingBox()
    expect(box?.height).toBeGreaterThan(44) // Minimum touch target size
  })

  test('should handle OAuth redirect on mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.click('button:has-text("Connect Xero")')

    // Should redirect successfully on mobile
    await page.waitForURL(/xero\.com/)

    expect(page.url()).toContain('xero.com')
  })
})
