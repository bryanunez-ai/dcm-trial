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
