import { test, expect } from '@playwright/test';
import { login } from './helpers';

// This suite's job: catch "the app is completely broken" before a shopkeeper does.
// Each protected route is visited and checked for (a) no crash screen and
// (b) no unhandled console error — cheap tests that catch expensive mistakes.

const PROTECTED_ROUTES = [
  '/pos',
  '/dashboard',
  '/inventory',
  '/returns',
  '/reports',
  '/customers',
  '/settings',
];

test.describe('Smoke: app boots and core routes load', () => {
  test('login works', async ({ page }) => {
    await login(page);
  });

  for (const route of PROTECTED_ROUTES) {
    test(`route ${route} loads without crashing`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      await login(page);
      await page.goto(route);

      // The React ErrorBoundary fallback would render this if a page crashes.
      await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
      expect(
        consoleErrors,
        `Console errors on ${route}:\n${consoleErrors.join('\n')}`,
      ).toHaveLength(0);
    });
  }
});
