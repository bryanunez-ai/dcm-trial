import { test, expect } from '@playwright/test';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo';

/**
 * The whitelabel gate: no trace of the starter's identity in anything a visitor can see.
 *
 * Grepping the source is not sufficient on its own — copy can arrive from a component, a metadata
 * export or a font, and the question the brief actually asks is about the rendered page.
 */
const STARTER_TRACES = [
  'ACME',
  'Next.js SaaS Starter',
  'saas-starter',
  'Stripe',
  'Team Subscription',
  'Invite Team Member',
  'Build Your SaaS'
];

const PUBLIC_ROUTES = ['/', '/sign-in', '/sign-up', '/this-route-does-not-exist'];
const AUTHED_ROUTES = [
  '/dashboard',
  '/dashboard/general',
  '/dashboard/activity',
  '/dashboard/security'
];

async function assertNoStarterTraces(html: string, route: string) {
  for (const trace of STARTER_TRACES) {
    expect(html, `${route} must not mention "${trace}"`).not.toContain(trace);
  }
}

test.describe('whitelabel', () => {
  test('public pages carry no starter branding', async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      await assertNoStarterTraces(await page.content(), route);
    }
  });

  test('authenticated pages carry no starter branding', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', DEMO_EMAIL);
    await page.fill('input[name="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    for (const route of AUTHED_ROUTES) {
      await page.goto(route);
      await assertNoStarterTraces(await page.content(), route);
    }
  });

  test('the app identifies itself as Nova Analytics', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Nova Analytics/);
    await expect(page.getByRole('link', { name: /Nova Analytics/i }).first()).toBeVisible();
  });

  test('the removed routes are gone', async ({ request }) => {
    // /pricing was the build-time Stripe call; /api/team backed the member list.
    expect((await request.get('/pricing')).status()).toBe(404);
    expect((await request.get('/api/team')).status()).toBe(404);
  });

  test('the demo credentials panel fills the sign-in form', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /fill in demo credentials/i }).click();

    await expect(page.locator('input[name="email"]')).toHaveValue(DEMO_EMAIL);
    await expect(page.locator('input[name="password"]')).toHaveValue(DEMO_PASSWORD);
  });
});
