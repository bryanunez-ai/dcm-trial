import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  columnsOf,
  countEventsForSite,
  createTestSite,
  deleteTestSite,
  eventsForSite
} from './helpers/db';
import { startHostPage } from './helpers/host-page';

/**
 * The ingestion gate.
 *
 * Unlike sign-in, the collector is a plain route handler, so it can and should be driven by hand
 * with real HTTP requests — that is exactly how an abusive client would reach it.
 */

const DOMAIN = 'collector-test.example';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Resolved to 127.0.0.1 by a host-resolver rule in playwright.config.ts, so a page served on it
// is in the same address space as the collector. See the comment there.
const TRACKER_DOMAIN = 'nova-e2e.test';

let siteId: number;
let siteKey: string;
let sampleSiteId: number;
let sampleSiteKey: string;
let trackerSiteId: number;
let trackerSiteKey: string;

test.beforeAll(async () => {
  const site = await createTestSite({ domain: DOMAIN });
  siteId = site.id;
  siteKey = site.siteKey;

  const trackerSite = await createTestSite({ domain: TRACKER_DOMAIN });
  trackerSiteId = trackerSite.id;
  trackerSiteKey = trackerSite.siteKey;

  const sample = await createTestSite({
    domain: 'sample-collector-test.example',
    isSample: true
  });
  sampleSiteId = sample.id;
  sampleSiteKey = sample.siteKey;
});

test.afterAll(async () => {
  await deleteTestSite(siteId);
  await deleteTestSite(sampleSiteId);
  await deleteTestSite(trackerSiteId);
});

async function post(
  request: APIRequestContext,
  options: {
    body?: string;
    origin?: string | null;
    userAgent?: string | null;
    contentType?: string;
  } = {}
) {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'text/plain;charset=UTF-8'
  };
  if (options.origin !== null) {
    headers.origin = options.origin ?? `https://${DOMAIN}`;
  }
  // Note: Playwright's request context sends its own User-Agent unless one is set, so an absent
  // header cannot be simulated by omitting it — pass '' to test the no-user-agent case.
  headers['user-agent'] = options.userAgent ?? BROWSER_UA;

  return request.post('/api/collect', {
    headers,
    data: options.body ?? JSON.stringify({ siteKey, path: '/', referrer: null })
  });
}

/** A fingerprint of everything a caller can observe about a response. */
async function fingerprint(response: Awaited<ReturnType<typeof post>>) {
  const headers = response.headers();
  return {
    status: response.status(),
    body: await response.text(),
    contentType: headers['content-type'] ?? null,
    contentLength: headers['content-length'] ?? null
  };
}

test.describe('collector', () => {
  test('a valid event is stored, normalised', async ({ request }) => {
    const before = await countEventsForSite(siteId);

    const response = await post(request, {
      body: JSON.stringify({
        siteKey,
        // Query string and fragment must not survive: they are a common accidental carrier of
        // personal data (reset tokens, emails in redirect params).
        path: '/blog/hello?utm_source=newsletter&email=someone@example.com#section',
        referrer: 'https://news.ycombinator.com/item?id=12345'
      })
    });

    expect(response.status()).toBe(202);

    await expect
      .poll(() => countEventsForSite(siteId), { timeout: 5000 })
      .toBe(before + 1);

    const stored = (await eventsForSite(siteId)).at(-1)!;

    expect(stored.path, 'query string and fragment stripped').toBe('/blog/hello');
    expect(stored.referrerDomain, 'referrer reduced to a bare domain').toBe(
      'news.ycombinator.com'
    );
    expect(stored.visitorHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('a self-referral is stored as null, not as the site itself', async ({ request }) => {
    await post(request, {
      body: JSON.stringify({
        siteKey,
        path: '/self-referral',
        referrer: `https://${DOMAIN}/previous-page`
      })
    });

    await expect
      .poll(
        async () =>
          (await eventsForSite(siteId)).filter((e) => e.path === '/self-referral').length,
        { timeout: 5000 }
      )
      .toBe(1);

    const stored = (await eventsForSite(siteId)).find(
      (e) => e.path === '/self-referral'
    )!;
    expect(stored.referrerDomain).toBeNull();
  });

  test('every rejection is stored nowhere and looks identical to success', async ({
    request
  }) => {
    const before = await countEventsForSite(siteId);

    // Each case writes to a distinct path, so if one does leak through, the assertion names it
    // instead of just reporting that a count moved.
    const rejected = {
      'unknown site key': await post(request, {
        body: JSON.stringify({
          siteKey: 'nosuchsitekeyatallxxxxxxxxxxxxxx',
          path: '/reject-unknown-key'
        })
      }),
      'wrong origin': await post(request, {
        origin: 'https://attacker.example',
        body: JSON.stringify({ siteKey, path: '/reject-wrong-origin' })
      }),
      'missing origin': await post(request, {
        origin: null,
        body: JSON.stringify({ siteKey, path: '/reject-no-origin' })
      }),
      'bot user agent': await post(request, {
        userAgent:
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        body: JSON.stringify({ siteKey, path: '/reject-bot-ua' })
      }),
      'empty user agent': await post(request, {
        userAgent: '',
        body: JSON.stringify({ siteKey, path: '/reject-empty-ua' })
      }),
      'malformed JSON': await post(request, { body: '{not json at all' }),
      'empty body': await post(request, { body: '' }),
      'oversized body': await post(request, {
        body: JSON.stringify({ siteKey, path: '/reject-oversized' + 'x'.repeat(4000) })
      }),
      'JSON array not object': await post(request, { body: '[1,2,3]' }),
      'missing path': await post(request, { body: JSON.stringify({ siteKey }) }),
      'sample site': await post(request, {
        body: JSON.stringify({ siteKey: sampleSiteKey, path: '/reject-sample-site' }),
        origin: 'https://sample-collector-test.example'
      })
    };

    // Nothing was written by any of them.
    const paths = (await eventsForSite(siteId)).map((e) => e.path);
    expect(paths.filter((p) => p.startsWith('/reject-'))).toEqual([]);
    expect(await countEventsForSite(siteId)).toBe(before);
    expect(await countEventsForSite(sampleSiteId)).toBe(0);

    // And none of them is distinguishable from a success. A collector that answers differently
    // for a valid key, an unknown key and a rejected origin is an oracle for enumerating
    // customers.
    const success = await fingerprint(await post(request, { body: JSON.stringify({ siteKey, path: '/oracle-check' }) }));

    for (const [label, response] of Object.entries(rejected)) {
      expect(await fingerprint(response), `"${label}" is distinguishable from success`).toEqual(
        success
      );
    }
  });

  test('the events table has nowhere to put an IP address or a user agent', async () => {
    // The privacy design is structural, not procedural: this is not a policy that could be
    // quietly changed, it is a fact about the schema.
    const columns = await columnsOf('events');

    expect(columns.sort()).toEqual(
      ['id', 'path', 'referrer_domain', 'site_id', 'timestamp', 'visitor_hash'].sort()
    );

    for (const forbidden of ['ip', 'ip_address', 'user_agent', 'ua', 'address', 'client_ip']) {
      expect(columns, `events must have no ${forbidden} column`).not.toContain(forbidden);
    }
  });

  test('the tracker fires a real pageview from a page on the registered domain', async ({
    browser
  }) => {
    // The default headless UA contains "HeadlessChrome", which the bot filter correctly rejects —
    // so this needs a context that presents itself as an ordinary browser. Worth stating plainly:
    // the filter working here is the reason the override is necessary, not a workaround for a bug.
    const context = await browser.newContext({ userAgent: BROWSER_UA });
    const page = await context.newPage();
    // A real browser, a real page served over a real socket on the site's registered domain, the
    // real script and the real endpoint. This is the only way to know the beacon survives as a
    // CORS simple request rather than tripping a preflight.
    const before = await countEventsForSite(siteId);

    const host = await startHostPage({
      domain: TRACKER_DOMAIN,
      appOrigin: 'http://localhost:3000',
      siteKey: trackerSiteKey
    });

    await page.goto(host.url('/pricing?utm_campaign=launch'));

    await expect
      .poll(
        async () =>
          (await eventsForSite(trackerSiteId)).filter((e) => e.path === '/pricing')
            .length,
        { timeout: 10_000, message: 'the pageview should arrive within seconds' }
      )
      .toBe(1);

    const stored = (await eventsForSite(trackerSiteId)).find(
      (e) => e.path === '/pricing'
    )!;
    // The query string was stripped on the way in.
    expect(stored.path).toBe('/pricing');
    expect(stored.visitorHash).toMatch(/^[0-9a-f]{64}$/);
    // And nothing leaked into the unrelated site.
    expect(await countEventsForSite(siteId)).toBe(before);

    // A single-page navigation is a pageview too: the tracker patches history.pushState.
    await page.click('#spa');
    await expect
      .poll(
        async () =>
          (await eventsForSite(trackerSiteId)).filter((e) => e.path === '/about').length,
        { timeout: 10_000, message: 'an SPA navigation should be tracked' }
      )
      .toBe(1);

    await context.close();
    await host.close();
  });

  test('the tracker is served and carries no site key of its own', async ({ request }) => {
    const response = await request.get('/nova.js');

    expect(response.status()).toBe(200);
    const body = await response.text();

    expect(body).toContain('sendBeacon');
    expect(body).toContain('data-site');
    // The snippet supplies the key; the script must be identical for every customer.
    expect(body).not.toContain(siteKey);
  });
});
