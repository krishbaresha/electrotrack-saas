import { Page, expect } from '@playwright/test';

/**
 * Logs in through the real UI (not an API shortcut) so every e2e run also
 * verifies the login form itself still works.
 * Requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD env vars pointing at a
 * disposable staging/test tenant account — never real shop credentials.
 */
export async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (a staging test account) before running e2e tests.',
    );
  }

  await page.goto('/login');
  await page.getByPlaceholder('admin@techbill.app').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 10_000 });
}
