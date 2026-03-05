import { expect, test } from '@playwright/test';

test('throw route smoke test', async ({ page }) => {
  await page.goto('/dice-throw');

  await expect(page).toHaveURL(/\/dice-throw$/);
  await expect(page.locator('app-throw-composer')).toBeVisible();
});

test('analysis route smoke test', async ({ page }) => {
  await page.goto('/dice-analysis');

  await expect(page).toHaveURL(/\/dice-analysis$/);
  await expect(page.locator('app-throw-composer')).toBeVisible();
  await expect(page.locator('#iterations')).toBeVisible();
});
