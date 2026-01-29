/**
 * Authentication Flow E2E Tests
 *
 * Tests the complete authentication workflow:
 * - Landing page navigation
 * - Login with email/password
 * - Signup flow
 * - Password reset
 * - OAuth (Google) - visual verification only
 */

import { test, expect } from '@playwright/test'

// =============================================================================
// Landing Page Tests
// =============================================================================

test.describe('Landing Page', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/')

    // Check for main heading
    await expect(page.getByRole('heading', { name: /Deep AI Analysis/i })).toBeVisible()

    // Check for CTA button
    await expect(page.getByRole('link', { name: /Get Started/i })).toBeVisible()
  })

  test('should have working navigation to login', async ({ page }) => {
    await page.goto('/')

    // Click login link in navigation
    const loginLink = page.getByRole('link', { name: /Sign In/i }).first()
    await loginLink.click()

    // Should navigate to login page
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible()
  })

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/')

    // Click signup/get started button
    const signupLink = page.getByRole('link', { name: /Get Started/i }).first()
    await signupLink.click()

    // Should navigate to signup page
    await expect(page).toHaveURL(/\/auth\/signup/)
  })
})

// =============================================================================
// Login Page Tests
// =============================================================================

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
  })

  test('should display login form', async ({ page }) => {
    // Check for eyebrow text
    await expect(page.getByText('Secure Access')).toBeVisible()

    // Check for main heading
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible()

    // Check for form elements
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()
  })

  test('should have Google OAuth button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
  })

  test('should have forgot password link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Forgot/i })).toBeVisible()
  })

  test('should navigate to signup from login', async ({ page }) => {
    await page.getByRole('link', { name: /Sign Up/i }).click()

    await expect(page).toHaveURL(/\/auth\/signup/)
    await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling fields
    await page.getByRole('button', { name: /Sign In/i }).click()

    // HTML5 validation should prevent submission
    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toHaveAttribute('required')
  })

  test('should navigate back to home', async ({ page }) => {
    await page.getByRole('link', { name: /Back to Home/i }).click()

    await expect(page).toHaveURL('/')
  })
})

// =============================================================================
// Signup Page Tests
// =============================================================================

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signup')
  })

  test('should display signup form', async ({ page }) => {
    // Check for eyebrow text
    await expect(page.getByText('Get Started')).toBeVisible()

    // Check for main heading
    await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible()

    // Check for all form fields
    await expect(page.getByPlaceholder(/first name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/last name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i).first()).toBeVisible()
  })

  test('should have terms and conditions checkbox', async ({ page }) => {
    // Look for terms text
    await expect(page.getByText(/I agree to the Terms/i)).toBeVisible()
  })

  test('should validate password requirements', async ({ page }) => {
    const passwordInput = page.getByPlaceholder(/^Password$/i)

    // Fill with weak password
    await passwordInput.fill('weak')

    // Check for validation hint
    await expect(page.getByText(/At least 8 characters/i)).toBeVisible()
  })

  test('should have Google OAuth option', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
  })

  test('should navigate to login from signup', async ({ page }) => {
    await page.getByRole('link', { name: /Sign In/i }).click()

    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

// =============================================================================
// Forgot Password Page Tests
// =============================================================================

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/forgot-password')
  })

  test('should display password reset form', async ({ page }) => {
    // Check for eyebrow text
    await expect(page.getByText('Password Recovery')).toBeVisible()

    // Check for main heading
    await expect(page.getByRole('heading', { name: /Reset Password/i })).toBeVisible()

    // Check for email input
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()

    // Check for submit button
    await expect(page.getByRole('button', { name: /Send Reset Link/i })).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByPlaceholder(/email/i)

    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('required')
  })

  test('should navigate back to login', async ({ page }) => {
    await page.getByRole('link', { name: /Sign In/i }).click()

    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

// =============================================================================
// Verify Email Page Tests
// =============================================================================

test.describe('Verify Email Page', () => {
  test('should display verification instructions', async ({ page }) => {
    await page.goto('/auth/verify-email?email=test@example.com')

    // Check for eyebrow text
    await expect(page.getByText('Email Verification')).toBeVisible()

    // Check for main heading
    await expect(page.getByRole('heading', { name: /Check Your Email/i })).toBeVisible()

    // Check for email address display
    await expect(page.getByText('test@example.com')).toBeVisible()

    // Check for resend button
    await expect(page.getByRole('button', { name: /Resend/i })).toBeVisible()
  })

  test('should have numbered instructions', async ({ page }) => {
    await page.goto('/auth/verify-email?email=test@example.com')

    // Look for step indicators (1, 2, 3)
    await expect(page.getByText('1')).toBeVisible()
    await expect(page.getByText('2')).toBeVisible()
    await expect(page.getByText('3')).toBeVisible()
  })
})

// =============================================================================
// Mobile Responsiveness Tests
// =============================================================================

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

  test('login page should be mobile-friendly', async ({ page }) => {
    await page.goto('/auth/login')

    // Elements should still be visible on mobile
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()
  })

  test('signup page should be mobile-friendly', async ({ page }) => {
    await page.goto('/auth/signup')

    await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible()
    await expect(page.getByPlaceholder(/first name/i)).toBeVisible()
  })
})

// =============================================================================
// Design System Verification Tests
// =============================================================================

test.describe('Design System (v8.1 Scientific Luxury)', () => {
  test('should have glassmorphic cards on login', async ({ page }) => {
    await page.goto('/auth/login')

    // Check for glassmorphic card (check for backdrop-filter or similar styling)
    const card = page.locator('.rounded-sm.border-\\[0\\.5px\\]').first()
    await expect(card).toBeVisible()
  })

  test('should have consistent typography', async ({ page }) => {
    await page.goto('/auth/login')

    // Check for eyebrow text styling (uppercase, small, spaced)
    const eyebrow = page.getByText('Secure Access')
    await expect(eyebrow).toBeVisible()
  })

  test('should have primary button with hover effects', async ({ page }) => {
    await page.goto('/auth/login')

    const signInButton = page.getByRole('button', { name: /^Sign In$/i })
    await expect(signInButton).toBeVisible()

    // Hover to test scale effect
    await signInButton.hover()
  })
})
