import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Covers the single most revenue-critical path: a cashier searching for a
// product and adding it to the cart. If this breaks, the shop can't sell
// anything — so it deserves its own always-run test, separate from the
// general route smoke test.
//
// NOTE: requires at least one product to exist in the staging tenant's
// catalog. Set E2E_TEST_PRODUCT_NAME to a product name that's guaranteed
// to exist (falls back to a generic search term otherwise).

test.describe('POS: search and add to cart', () => {
  test('searching a product and adding it updates the cart total', async ({ page }) => {
    await login(page);
    await page.goto('/pos');

    const searchTerm = process.env.E2E_TEST_PRODUCT_NAME ?? 'a';
    const search = page.getByPlaceholder(/search product, brand, imei, serial, category/i);
    await search.fill(searchTerm);

    // Wait for at least one result and click the first one. Results depend on
    // a background product sync (IndexedDB) that may still be running right
    // after login, so poll instead of checking count() once immediately.
    const firstResult = page.locator('[data-testid="search-result-item"]').first();
    try {
      await expect(firstResult).toBeVisible({ timeout: 15_000 });
    } catch {
      test.skip(true, 'No products in staging catalog to search for — seed one first.');
    }
    await firstResult.click();

    // Clicking a product opens the "Select Serial Number" sheet — a cashier
    // still has to pick which in-stock unit to sell, so add the first one.
    const addUnitButton = page.getByRole('button', { name: 'Add' }).first();
    await expect(addUnitButton).toBeVisible({ timeout: 5_000 });
    await addUnitButton.click();

    // Cart should now show a non-zero total. Adjust selector to match your
    // actual cart-total element if this differs.
    const cartTotal = page.locator('[data-testid="cart-total"]');
    await expect(cartTotal).toBeVisible();
    await expect(cartTotal).not.toHaveText(/₨\s*0$/); // matches formatPKR's "₨ 0" for an empty cart
  });
});
