/**
 * Dashboard Navigation E2E Tests
 *
 * Tests navigation and layout of the main dashboard.
 * Note: Some tests require authentication which may need to be mocked.
 */

import { test, expect } from '@playwright/test'

// =============================================================================
// Dashboard Access Tests
// =============================================================================

test.describe('Dashboard Access', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('landing page CTA should link to dashboard', async ({ page }) => {
    await page.goto('/')

    // Find "Get Started" or "Start Analysis" button
    const ctaButton = page.getByRole('link', { name: /Get Started|Start Analysis/i }).first()

    // Get the href to verify it points to dashboard or auth
    const href = await ctaButton.getAttribute('href')
    expect(href).toMatch(/dashboard|auth/)
  })
})

// =============================================================================
// Dashboard Layout Tests (if accessible without auth)
// =============================================================================

test.describe('Dashboard Structure', () => {
  test.skip('should have main navigation sidebar', async ({ page }) => {
    // This test requires authentication
    // Will be implemented with auth setup
  })

  test.skip('should have responsive mobile menu', async ({ page }) => {
    // This test requires authentication
    // Will be implemented with auth setup
  })
})

// =============================================================================
// Forensic Audit Page Tests
// =============================================================================

test.describe('Forensic Audit Navigation', () => {
  test('forensic audit page should require authentication', async ({ page }) => {
    await page.goto('/dashboard/forensic-audit')

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

// =============================================================================
// Settings Page Tests
// =============================================================================

test.describe('Settings Navigation', () => {
  test('settings page should require authentication', async ({ page }) => {
    await page.goto('/dashboard/settings')

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

// =============================================================================
// Mobile Navigation Tests
// =============================================================================

test.describe('Mobile Dashboard Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should redirect to login on mobile', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
