import { test, expect } from '@playwright/test';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo';

test.describe('authentication', () => {
  test('an unauthenticated visitor is redirected away from the dashboard', async ({ page }) => {
    const response = await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/sign-in/);
    // The redirect is the middleware's, so the final document is the sign-in page.
    expect(response?.status()).toBe(200);
  });

  test('the sign-in form is server-rendered, not an empty shell', async ({ request }) => {
    // Guards the PPR trap: a client component reading search params ships the form as an empty
    // shell that only appears after hydration. Asserting on the raw HTML — no browser, no
    // JavaScript, nothing hydrated — is the only way to tell the difference from the outside. A
    // rendered page would pass either way.
    const response = await request.get('/sign-in');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html, 'the email field must be in the server response').toMatch(
      /<input[^>]*name="email"/
    );
    expect(html, 'the password field must be in the server response').toMatch(
      /<input[^>]*name="password"/
    );
    expect(html).toContain('Sign in to Nova Analytics');
  });

  test('the seeded demo account signs in and reaches the dashboard', async ({ page }) => {
    await page.goto('/sign-in');

    await page.fill('input[name="email"]', DEMO_EMAIL);
    await page.fill('input[name="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'session');

    expect(session, 'a session cookie is set').toBeDefined();
    expect(session!.httpOnly, 'the session cookie is httpOnly').toBe(true);
    expect(session!.sameSite).toBe('Lax');
  });

  test('a new account can sign up and lands on the dashboard', async ({ page }) => {
    // Signing up used to create a team and a membership row alongside the user. Teams are gone,
    // so this exercises the simplified path end to end.
    const email = `signup-${Date.now()}@example.test`;

    await page.goto('/sign-up');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'a-long-enough-password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    // A brand new account lands on a populated Overview rather than an empty screen, because the
    // unowned sample site is readable by everyone.
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(email).toContain('@');
  });

  test('wrong credentials do not create a session', async ({ page }) => {
    await page.goto('/sign-in');

    await page.fill('input[name="email"]', DEMO_EMAIL);
    await page.fill('input[name="password"]', 'not-the-password');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);

    const session = (await page.context().cookies()).find((c) => c.name === 'session');
    expect(session, 'no session cookie is set').toBeUndefined();
  });
});
