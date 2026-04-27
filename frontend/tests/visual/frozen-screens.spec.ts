import { expect, test } from '@playwright/test';
import { mockBackend } from '../support/backendMocks';

test('landing page visual baseline', async ({ page }) => {
  await mockBackend(page);

  await page.goto('/');
  await expect(page).toHaveScreenshot('landing-page.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.01
  });
});