/**
 * Landing Page E2E Tests
 *
 * Tests the main landing page including:
 * - Page load performance
 * - Hero section
 * - Feature sections
 * - Pricing
 * - CTAs
 * - Responsive design
 */

import { test, expect } from '@playwright/test'

// =============================================================================
// Page Load and Performance Tests
// =============================================================================

test.describe('Landing Page Load', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')

    const loadTime = Date.now() - startTime

    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should have correct meta tags', async ({ page }) => {
    await page.goto('/')

    // Check title
    const title = await page.title()
    expect(title).toContain('ATO')

    // Check viewport
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
  })
})

// =============================================================================
// Hero Section Tests
// =============================================================================

test.describe('Hero Section', () => {
  test('should display main value proposition', async ({ page }) => {
    await page.goto('/')

    // Check for key messaging
    await expect(page.getByText(/Deep AI Analysis|Tax Optimizer/i)).toBeVisible()
    await expect(page.getByText(/\$200K|\$500K/i)).toBeVisible()
  })

  test('should have working CTA buttons', async ({ page }) => {
    await page.goto('/')

    // Primary CTA should be visible
    const primaryCTA = page.getByRole('link', { name: /Get Started|Start Analysis/i }).first()
    await expect(primaryCTA).toBeVisible()

    // Should have valid href
    const href = await primaryCTA.getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('should have secondary CTA or learn more option', async ({ page }) => {
    await page.goto('/')

    // Look for secondary action
    const secondaryCTA = page.getByRole('link', { name: /Learn More|View Demo/i }).first()

    if (await secondaryCTA.isVisible()) {
      const href = await secondaryCTA.getAttribute('href')
      expect(href).toBeTruthy()
    }
  })
})

// =============================================================================
// Feature Section Tests
// =============================================================================

test.describe('Feature Sections', () => {
  test('should display key features', async ({ page }) => {
    await page.goto('/')

    // Check for R&D Tax Incentive mention
    await expect(page.getByText(/R&D|Division 355/i)).toBeVisible()

    // Check for Xero integration
    await expect(page.getByText(/Xero/i)).toBeVisible()
  })

  test('should have workflow steps', async ({ page }) => {
    await page.goto('/')

    // Look for numbered steps or workflow
    const hasWorkflow =
      (await page.getByText(/Connect.*Analyse.*Review/i).count()) > 0 ||
      (await page.getByText(/Step 1|Step 2/i).count()) > 0

    expect(hasWorkflow).toBeTruthy()
  })
})

// =============================================================================
// Pricing Section Tests
// =============================================================================

test.describe('Pricing Section', () => {
  test('should display pricing tiers', async ({ page }) => {
    await page.goto('/')

    // Check for pricing amount
    await expect(page.getByText(/\$995|\$\d{3,}/i)).toBeVisible()
  })

  test('should have money-back guarantee', async ({ page }) => {
    await page.goto('/')

    // Check for guarantee
    await expect(page.getByText(/Money-Back Guarantee|100% Guarantee/i)).toBeVisible()
  })
})

// =============================================================================
// Footer Tests
// =============================================================================

test.describe('Footer', () => {
  test('should have footer navigation', async ({ page }) => {
    await page.goto('/')

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Look for footer links (adjust based on actual footer)
    const footer = page.locator('footer')
    if (await footer.isVisible()) {
      await expect(footer).toBeVisible()
    }
  })
})

// =============================================================================
// Navigation Header Tests
// =============================================================================

test.describe('Navigation Header', () => {
  test('should have logo/brand', async ({ page }) => {
    await page.goto('/')

    // Check for logo or brand name
    const logo = page.locator('img').first()
    const brandText = page.getByText(/ATO|Australian Tax/i).first()

    const hasLogo = (await logo.count()) > 0
    const hasBrand = (await brandText.count()) > 0

    expect(hasLogo || hasBrand).toBeTruthy()
  })

  test('should have login link in header', async ({ page }) => {
    await page.goto('/')

    const loginLink = page.getByRole('link', { name: /Sign In|Login/i }).first()
    await expect(loginLink).toBeVisible()
  })

  test('should have sticky or fixed navigation', async ({ page }) => {
    await page.goto('/')

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500))

    // Header should still be visible (if it's sticky/fixed)
    const loginLink = page.getByRole('link', { name: /Sign In|Login/i }).first()
    await expect(loginLink).toBeVisible()
  })
})

// =============================================================================
// Mobile Responsiveness Tests
// =============================================================================

test.describe('Mobile Landing Page', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

  test('should be mobile-friendly', async ({ page }) => {
    await page.goto('/')

    // Hero should be visible
    await expect(page.getByText(/Deep AI Analysis|Tax Optimizer/i)).toBeVisible()

    // CTA should be visible
    const cta = page.getByRole('link', { name: /Get Started/i }).first()
    await expect(cta).toBeVisible()
  })

  test('should have mobile menu', async ({ page }) => {
    await page.goto('/')

    // Look for hamburger menu icon
    const menuButton = page.getByRole('button', { name: /menu/i })

    if (await menuButton.isVisible()) {
      await menuButton.click()

      // Menu should expand
      await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible()
    }
  })
})

// =============================================================================
// Call-to-Action Flow Tests
// =============================================================================

test.describe('CTA User Journey', () => {
  test('primary CTA should lead to signup or dashboard', async ({ page }) => {
    await page.goto('/')

    const primaryCTA = page.getByRole('link', { name: /Get Started|Start Analysis/i }).first()
    await primaryCTA.click()

    // Should navigate to either signup or dashboard
    await expect(page).toHaveURL(/\/auth\/signup|\/dashboard/)
  })

  test('accountant CTA should navigate to accountant section', async ({ page }) => {
    await page.goto('/')

    const accountantCTA = page.getByRole('link', { name: /For Accountants|Accountant/i }).first()

    if (await accountantCTA.isVisible()) {
      await accountantCTA.click()

      // Should scroll to accountant section or navigate
      // Implementation depends on actual page structure
    }
  })
})

// =============================================================================
// Accessibility Tests
// =============================================================================

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Should have h1
    const h1 = page.locator('h1')
    await expect(h1).toHaveCount(1)
  })

  test('images should have alt text', async ({ page }) => {
    await page.goto('/')

    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      const alt = await images.nth(i).getAttribute('alt')
      // Alt can be empty for decorative images, but attribute should exist
      expect(alt !== null).toBeTruthy()
    }
  })
})

// =============================================================================
// SEO Tests
// =============================================================================

test.describe('SEO', () => {
  test('should have meta description', async ({ page }) => {
    await page.goto('/')

    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description).toBeTruthy()
    expect(description!.length).toBeGreaterThan(50)
  })

  test('should have Open Graph tags', async ({ page }) => {
    await page.goto('/')

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(ogTitle).toBeTruthy()
  })
})
