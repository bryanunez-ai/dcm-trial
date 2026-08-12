import { test, expect, type Page } from '@playwright/test';

async function signUpFreshAccount(page: Page) {
  const email = `share-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto('/sign-up');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'a-long-enough-password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

async function createSite(page: Page, name: string, domain: string) {
  await page.goto('/dashboard/sites/new');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="domain"]', domain);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard\/sites\/\d+\/install/);
  return Number(page.url().match(/sites\/(\d+)\/install/)![1]);
}

/**
 * Publishes a share link and returns its *path*.
 *
 * The displayed URL is absolute and built from BASE_URL, which is the value the owner would paste
 * into an email — correct for them, but not necessarily the origin these tests are pointed at.
 * Navigating by path keeps the suite portable, which is what lets the same specs run against the
 * deployed URL later.
 */
async function publishShareLink(page: Page) {
  await page.getByRole('button', { name: /publish share link/i }).click();
  const input = page.getByLabel('Share link');
  await expect(input).toBeVisible();

  const absolute = await input.inputValue();
  return { absolute, path: new URL(absolute).pathname };
}

test.describe('sharing', () => {
  test('GATE: a published link renders with no session, and a revoked one 404s', async ({
    browser
  }) => {
    const owner = await browser.newContext();
    const ownerPage = await owner.newPage();
    await signUpFreshAccount(ownerPage);
    await createSite(ownerPage, 'Client site', 'client-site.example');
    const { absolute, path: sharePath } = await publishShareLink(ownerPage);

    expect(absolute).toMatch(/\/share\/[a-z2-9]{32}$/);

    // A genuinely separate context: no cookies, no session — a private window.
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();

    const response = await strangerPage.goto(sharePath);
    expect(response?.status()).toBe(200);
    await expect(
      strangerPage.getByRole('heading', { name: 'Client site' })
    ).toBeVisible();
    await expect(strangerPage.getByText(/read-only view/i)).toBeVisible();
    await expect(strangerPage.getByText(/in the last 5 minutes/i)).toBeVisible();

    // Now revoke it, and the same URL must die — with a real 404 status, not a 200 carrying a
    // not-found page. This is what PPR being incremental rather than global buys: a blanket
    // static shell would have committed a 200 before notFound() ever ran.
    await ownerPage.getByRole('button', { name: /revoke link/i }).click();
    await expect(
      ownerPage.getByRole('button', { name: /publish share link/i })
    ).toBeVisible();

    const revoked = await strangerPage.goto(sharePath);
    expect(revoked?.status(), 'a revoked share link must 404, not 200').toBe(404);

    await owner.close();
    await stranger.close();
  });

  test('an unknown token 404s exactly like a page that never existed', async ({
    page
  }) => {
    const unknown = await page.goto('/share/thistokenneverexistedatall1234');
    expect(unknown?.status()).toBe(404);

    const nonsense = await page.goto('/share/x');
    expect(nonsense?.status()).toBe(404);
  });

  test('re-publishing mints a different token', async ({ page }) => {
    await signUpFreshAccount(page);
    await createSite(page, 'Rotating', 'rotating.example');

    const first = await publishShareLink(page);
    await page.getByRole('button', { name: /revoke link/i }).click();
    await expect(
      page.getByRole('button', { name: /publish share link/i })
    ).toBeVisible();
    const second = await publishShareLink(page);

    // Re-enabling must not resurrect the old URL — somebody revoked it for a reason.
    expect(second.path).not.toBe(first.path);

    const old = await page.goto(first.path);
    expect(old?.status()).toBe(404);
  });

  test('the share page leaks no site key and asks not to be indexed', async ({
    browser
  }) => {
    const owner = await browser.newContext();
    const ownerPage = await owner.newPage();
    await signUpFreshAccount(ownerPage);
    await createSite(ownerPage, 'Leak check', 'leak-check.example');

    const siteKey = (await ownerPage.locator('pre code').first().innerText())
      .match(/data-site="([^"]+)"/)![1];
    const { path: sharePath } = await publishShareLink(ownerPage);

    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    await strangerPage.goto(sharePath);

    const html = await strangerPage.content();
    expect(html, 'the site key must never reach a public page').not.toContain(siteKey);
    expect(html).toContain('noindex');

    await owner.close();
    await stranger.close();
  });

  test('the live endpoint 404s for strangers and for the unauthenticated', async ({
    browser,
    request
  }) => {
    const owner = await browser.newContext();
    const ownerPage = await owner.newPage();
    await signUpFreshAccount(ownerPage);
    const siteId = await createSite(ownerPage, 'Live site', 'live-site.example');

    // The owner can read it.
    const ownerResponse = await ownerPage.request.get(`/api/sites/${siteId}/live`);
    expect(ownerResponse.status()).toBe(200);
    expect(await ownerResponse.json()).toHaveProperty('live');

    // With no session at all: 404, not 401. A 401 would confirm the id exists.
    const anonymous = await request.get(`/api/sites/${siteId}/live`);
    expect(anonymous.status()).toBe(404);

    // Another account: also 404, and indistinguishable from the id not existing.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signUpFreshAccount(otherPage);

    const strangerResponse = await otherPage.request.get(`/api/sites/${siteId}/live`);
    expect(strangerResponse.status()).toBe(404);

    const missing = await otherPage.request.get('/api/sites/99999999/live');
    expect(missing.status()).toBe(404);
    expect(await strangerResponse.text()).toBe(await missing.text());

    await owner.close();
    await other.close();
  });
});
