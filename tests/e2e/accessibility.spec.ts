import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('landing page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });

  test('dashboard has no critical a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });

  test('shared report has no critical a11y violations', async ({ page }) => {
    await page.goto('/share/test-token');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
});
