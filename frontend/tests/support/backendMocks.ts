import type { Page } from '@playwright/test';

const pointPackages = [
  { id: 'pkg_100', points: 100, price: 30, type: 'points', name: '100 points', description: 'Small starter package' },
  { id: 'pkg_500', points: 500, price: 130, type: 'points', name: '500 points', description: 'Popular package', popular: true },
  { id: 'plan_unlimited', points: 0, price: 399, type: 'subscription', name: 'Unlimited', description: 'Membership plan' }
];

const pointConfig = {
  TRIP_BASE_COST: 50,
  TRIP_DAILY_COST: 10,
  NEW_USER_BONUS: 500,
  ATTRACTION_SEARCH_COST: 10,
  RECOMMENDATION_COUNT: 12,
  GALLERY_PAGE_SIZE_DEFAULT: 12,
  GALLERY_PAGE_SIZE_MAX: 24,
  GALLERY_PAGE_MAX: 1000,
  RANDOM_TRIPS_DEFAULT: 6,
  RANDOM_TRIPS_MAX: 12
};

export async function mockBackend(page: Page): Promise<void> {
  await page.route('http://localhost:3001/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = {};

    if (url.pathname === '/packages') body = pointPackages;
    if (url.pathname === '/config') body = pointConfig;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}