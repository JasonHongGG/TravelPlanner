import { expect, test } from '@playwright/test';
import { mockBackend } from '../support/backendMocks';

test('public entry renders without backend access', async ({ page }) => {
  await mockBackend(page);

  await page.goto('/');

  await expect(page).toHaveTitle(/Travel Planner/);
  await expect(page.getByRole('heading', { name: /Design Your/i })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Failed to fetch');
});