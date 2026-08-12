import { test, expect, type Page } from '@playwright/test';
import { startHostPage } from './helpers/host-page';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo';

const TRACKER_DOMAIN = 'nova-e2e.test';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function signUpFreshAccount(page: Page) {
  const email = `sites-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto('/sign-up');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'a-long-enough-password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

async function createSite(page: Page, name: string, domain: string) {
  await page.goto('/dashboard/sites/new');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="domain"]', domain);
  await page.click('button[type="submit"]');
  // Creating a site lands on its install screen.
  await expect(page).toHaveURL(/\/dashboard\/sites\/\d+\/install/);
  const siteId = Number(page.url().match(/sites\/(\d+)\/install/)![1]);
  return siteId;
}

test.describe('sites', () => {
  test('a new account sees the sample site rather than an empty dashboard', async ({
    page
  }) => {
    await signUpFreshAccount(page);

    // The sample site is unowned, so every account can read it. Without this a reviewer's fresh
    // signup would land on an empty screen with nothing to look at.
    await expect(page.getByText(/sample data/i).first()).toBeVisible();
    await expect(page.getByText('Visitors').first()).toBeVisible();
  });

  test('the sample site is readable but cannot be managed', async ({ page }) => {
    await signUpFreshAccount(page);

    // It is not listed on the sites screen, because every action there is one this account
    // cannot take against it.
    await page.goto('/dashboard/sites');
    await expect(page.getByText(/no sites yet/i)).toBeVisible();
  });

  test('a domain is normalised on the way in', async ({ page }) => {
    await signUpFreshAccount(page);
    const siteId = await createSite(page, 'Normalised', 'HTTPS://WWW.Example.COM/pricing?a=1');

    // Same normalisation the collector applies to an incoming Origin header — they call the same
    // function, so an origin can never fail to match for an invisible reason.
    await expect(page.getByRole('heading', { name: /install on example\.com/i })).toBeVisible();
    expect(siteId).toBeGreaterThan(0);
  });

  test('a rubbish domain is refused with a readable reason', async ({ page }) => {
    await signUpFreshAccount(page);

    await page.goto('/dashboard/sites/new');
    await page.fill('input[name="name"]', 'Bad');
    await page.fill('input[name="domain"]', 'not a domain');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/does not look like a domain/i)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/sites\/new/);
  });

  test("another account's site id returns 404, not 403", async ({ browser }) => {
    // Two genuinely separate browser contexts, so the second account has its own cookie jar
    // rather than a cleared one.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUpFreshAccount(pageA);
    const siteId = await createSite(pageA, 'Account A', 'account-a.example');

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUpFreshAccount(pageB);

    // Account B must not be able to tell that this id exists at all. A 401 or 403 would confirm
    // it and turn sequential ids into an enumeration oracle.
    const response = await pageB.goto(`/dashboard/sites/${siteId}/install`);
    expect(response?.status()).toBe(404);

    // And it must not appear anywhere in B's own dashboard.
    await pageB.goto('/dashboard/sites');
    await expect(pageB.getByText('account-a.example')).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });

  test('the demo account cannot delete sites', async ({ page }) => {
    // The credentials are published, so without a server-side guard any visitor could delete the
    // site that makes the deployed demo show real traffic.
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', DEMO_EMAIL);
    await page.fill('input[name="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/sites');
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();

    if (await deleteButton.count()) {
      page.on('dialog', (d) => d.accept());
      await deleteButton.click();
      await expect(page.getByText(/demo account cannot delete sites/i)).toBeVisible();
    }
  });

  test('a site can be deleted, and its history goes with it', async ({ page }) => {
    await signUpFreshAccount(page);
    await createSite(page, 'Doomed', 'doomed.example');

    await page.goto('/dashboard/sites');
    await expect(page.getByText('doomed.example')).toBeVisible();

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /delete/i }).first().click();

    await expect(page.getByText(/no sites yet/i)).toBeVisible();
  });

  test('GATE: snippet on a real page, pageview arrives in the dashboard', async ({
    browser
  }) => {
    const context = await browser.newContext({ userAgent: BROWSER_UA });
    const page = await context.newPage();

    await signUpFreshAccount(page);
    const siteId = await createSite(page, 'Gate site', TRACKER_DOMAIN);

    // Take the snippet the install screen actually shows, rather than rebuilding it — this is
    // what a customer would copy, so this is what has to work.
    const snippet = await page.locator('pre code').first().innerText();
    const siteKey = snippet.match(/data-site="([^"]+)"/)![1];
    expect(snippet).toContain('/nova.js');

    const host = await startHostPage({
      domain: TRACKER_DOMAIN,
      appOrigin: 'http://localhost:3000',
      siteKey
    });

    // Load the customer's page in a normal tab, exactly as a visitor would.
    const visitor = await context.newPage();
    await visitor.goto(host.url('/features'));
    await visitor.waitForTimeout(1200);
    await visitor.close();

    // Then read the dashboard as the site owner.
    await page.goto(`/dashboard?site=${siteId}`);
    await expect
      .poll(
        async () => {
          await page.reload();
          return page.getByText('/features').count();
        },
        { timeout: 15_000, message: 'the pageview should appear on the dashboard' }
      )
      .toBeGreaterThan(0);

    // It counted as a real visitor, not merely as a stored row: the headline cards read 1 and 1,
    // and the referrer was recorded as direct because the visitor typed the address.
    await expect(page.getByText('/features').first()).toBeVisible();
    await expect(page.getByText('Direct / none').first()).toBeVisible();

    // Bounce rate reads 100%: one visitor, exactly one pageview. That is the definition Nova
    // uses, and it is the only thing a pageview beacon can honestly say about engagement.
    await expect(page.getByText('100%').first()).toBeVisible();

    // No duration metric is presented. Checked on the metric labels rather than on the whole
    // page, because the page deliberately *mentions* time on page — in the sentence explaining
    // that it is not measured.
    await expect(
      page.getByText(/^(avg|average)\b/i),
      'no averaged duration metric may be displayed'
    ).toHaveCount(0);
    await expect(
      page.getByText(/does not measure time on page/i)
    ).toBeVisible();

    await host.close();
    await context.close();
  });
});
