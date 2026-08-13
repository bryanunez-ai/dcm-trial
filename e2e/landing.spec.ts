import { test, expect } from '@playwright/test';

const WIDTHS = [375, 768, 1280];

test.describe('landing page', () => {
  for (const width of WIDTHS) {
    test(`renders at ${width}px without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      // Every required section is present.
      await expect(
        page.getByRole('heading', { level: 1, name: /cookie banner/i })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Running in about a minute/i })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /deliberately nothing else/i })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Questions worth asking/i })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /next five minutes/i })
      ).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();

      // The page must never scroll sideways. This is the check that actually catches broken
      // responsive layouts — a fixed-width child, a long unbroken string, an overflowing pre.
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth
        };
      });
      expect(
        overflow.scrollWidth,
        `document scrolls horizontally at ${width}px`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);

      // No individual element may spill past the viewport either — except where it is contained
      // by an ancestor that scrolls or clips on its own. Wide content (the install snippet) is
      // allowed to scroll inside its own box; what is forbidden is the page scrolling sideways.
      const spills = await page.evaluate((vw) => {
        const containedByScroller = (el: Element) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const overflowX = getComputedStyle(p).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
              return true;
            }
          }
          return false;
        };

        return [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > vw + 1 && !containedByScroller(el);
          })
          .slice(0, 5)
          .map((el) => `${el.tagName}.${(el.className || '').toString().slice(0, 60)}`);
      }, width);
      expect(spills, `elements overflow the viewport at ${width}px`).toEqual([]);
    });
  }

  test('headings read correctly as text, not just visually', async ({ page }) => {
    // A <span className="block"> inside a heading breaks the line on screen but leaves the text
    // content concatenated, so this heading once read "without thecookie banner" to a screen
    // reader and a search engine while looking perfect to a sighted user. Nova's own AI advisor
    // found it on the deployed site. Asserted on textContent because that is what the bug was.
    await page.goto('/');

    const h1 = await page
      .locator('h1')
      .first()
      .evaluate((el) => el.textContent?.replace(/\s+/g, ' ').trim());

    expect(h1).toBe('Web analytics without the cookie banner');
    expect(h1, 'words must not be glued together').not.toMatch(/[a-z][A-Z]|thecookie/);
  });

  test('every page has exactly one h1 and its own description', async ({ page }) => {
    for (const [path, expectedDescription] of [
      ['/', /Privacy-first web analytics/i],
      ['/sign-in', /Sign in to your Nova Analytics dashboard/i],
      ['/sign-up', /Create a Nova Analytics account/i]
    ] as const) {
      await page.goto(path);

      await expect(page.locator('h1'), `${path} needs exactly one h1`).toHaveCount(1);

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(description, `${path} needs its own description`).toMatch(
        expectedDescription
      );
    }
  });

  test('the primary calls to action lead to signup and sign-in', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /start for free/i }).click();
    await expect(page).toHaveURL(/\/sign-up/);

    await page.goto('/');
    await page.getByRole('link', { name: /view the demo dashboard/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('the FAQ opens without JavaScript state', async ({ page }) => {
    await page.goto('/');

    const question = page.getByText(/Do I really not need a cookie consent banner/i);
    const answer = page.getByText(/same approach Plausible and Fathom take/i);

    await expect(answer).toBeHidden();
    await question.click();
    await expect(answer).toBeVisible();
  });

  test('the footer links to the process page, which renders the real documents', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /how this was built/i }).click();
    await expect(page).toHaveURL(/\/process/);

    await expect(
      page.getByRole('heading', { level: 1, name: /how this was built/i })
    ).toBeVisible();

    // Both screenshots resolve — a broken image here would be invisible in an assertion that
    // only checked the <img> existed.
    for (const src of ['/process/0-md-files.png', '/process/2-plan-after-spec.png']) {
      const response = await page.request.get(src);
      expect(response.status(), `${src} must be served`).toBe(200);
      expect(response.headers()['content-type']).toContain('image');
    }

    // The documents are inlined from the repository, not retyped, so their real content must be
    // present rather than a summary of it.
    const html = await page.content();
    expect(html).toContain('Nova Analytics — Full Specification');
    expect(html).toContain('The bootstrap prompt');
    expect(html).toContain('visitor_hash = sha256');
  });

  test('the marketing page ships no chart library', async ({ page }) => {
    // The dashboard preview is hand-written SVG precisely so a visitor to the marketing page
    // never downloads Recharts. If that regresses, this catches it.
    const scriptUrls: string[] = [];
    page.on('response', (r) => {
      if (r.request().resourceType() === 'script') scriptUrls.push(r.url());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const chartBundles = scriptUrls.filter((u) => /recharts|d3-|victory|chart\.js/i.test(u));
    expect(chartBundles).toEqual([]);
  });
});
