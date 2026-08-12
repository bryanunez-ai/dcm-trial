import { test, expect } from '@playwright/test';
import {
  assertUrlIsSafe,
  extractSignals,
  isBlockedAddress
} from '../lib/ai/fetch-page';
import { choosePaths, computeCostMicros } from '../lib/ai/analyze';
import { analysisSchema, analysisJsonSchema } from '../lib/ai/schema';

/**
 * The advisor's guards, tested directly.
 *
 * These run in Node rather than a browser because the thing under test is server-side logic that
 * decides whether a request leaves the machine at all.
 */

test.describe('SSRF guards', () => {
  test('non-routable addresses are refused', () => {
    const blocked = [
      '127.0.0.1',
      '127.53.1.9',
      '0.0.0.0',
      '10.0.0.7',
      '172.16.4.2',
      '172.31.255.254',
      '192.168.1.1',
      // The cloud metadata endpoint — the single most valuable SSRF target there is.
      '169.254.169.254',
      '169.254.1.1',
      '100.64.0.1', // CGNAT
      '224.0.0.1', // multicast
      '::1',
      '::',
      'fe80::1',
      'fd00::1',
      'ff02::1',
      '::ffff:127.0.0.1', // IPv4-mapped loopback
      'not-an-address'
    ];

    for (const ip of blocked) {
      expect(isBlockedAddress(ip), `${ip} must be blocked`).toBe(true);
    }
  });

  test('ordinary public addresses are allowed', () => {
    for (const ip of ['93.184.216.34', '1.1.1.1', '8.8.8.8', '2606:4700::1111']) {
      expect(isBlockedAddress(ip), `${ip} should be allowed`).toBe(false);
    }
  });

  test('http, other hosts and non-routable hosts are all refused', async () => {
    const domain = 'example.com';

    const cases: Array<[url: string, why: string]> = [
      ['http://example.com/', 'plain http'],
      ['ftp://example.com/', 'a non-http scheme'],
      ['https://evil.example/', 'a different domain'],
      ['https://example.com.evil.test/', 'a lookalike suffix'],
      ['https://localhost/', 'localhost'],
      ['https://127.0.0.1/', 'loopback by IP'],
      ['https://169.254.169.254/latest/meta-data/', 'the metadata endpoint'],
      ['https://10.0.0.1/', 'a private address'],
      ['https://[::1]/', 'IPv6 loopback'],
      ['not even a url', 'an unparseable URL']
    ];

    for (const [url, why] of cases) {
      const verdict = await assertUrlIsSafe(url, domain);
      expect(verdict.ok, `${why} must be refused (${url})`).toBe(false);
    }
  });

  test('the registered domain over https is allowed', async () => {
    // A real resolvable public domain, so this exercises the DNS path rather than only the
    // string checks.
    const verdict = await assertUrlIsSafe('https://example.com/pricing', 'example.com');
    expect(verdict.ok).toBe(true);
  });

  test('www and the bare domain are treated as the same site', async () => {
    const verdict = await assertUrlIsSafe('https://www.example.com/', 'example.com');
    expect(verdict.ok).toBe(true);
  });
});

test.describe('on-page signal extraction', () => {
  test('signals are read from real markup, not guessed', () => {
    const html = `<!doctype html>
      <html><head>
        <title>  Pricing — Acme  </title>
        <meta name='description' content="Plans and pricing">
        <link rel="canonical" href="https://acme.test/pricing"/>
        <meta name="robots" content="noindex">
        <meta content="OG Pricing" property="og:title">
        <meta property="og:description" content="OG desc">
      </head>
      <body>
        <h1>Pricing</h1><h1>Second heading</h1>
        <h2>Teams</h2><h2>Individuals</h2><h2>FAQ</h2>
        <p>One two three four five.</p>
        <script>var ignored = "this text must not be counted";</script>
        <style>.ignored { color: red }</style>
        <img src="/a.png" alt="described">
        <img src="/b.png">
        <img src="/c.png" alt="   ">
        <a href="/features">internal</a>
        <a href="https://acme.test/about">also internal</a>
        <a href="https://elsewhere.test/x">external</a>
        <a href="#anchor">ignored</a>
        <a href="mailto:x@y.z">ignored</a>
      </body></html>`;

    const s = extractSignals(html, 'https://acme.test/pricing', 'acme.test');

    // Attribute order varies — note og:title has content before property above.
    expect(s.title).toBe('Pricing — Acme');
    expect(s.metaDescription).toBe('Plans and pricing');
    expect(s.canonical).toBe('https://acme.test/pricing');
    expect(s.robots).toBe('noindex');
    expect(s.ogTitle).toBe('OG Pricing');
    expect(s.hasOgImage).toBe(false);
    expect(s.h1s).toEqual(['Pricing', 'Second heading']);
    expect(s.h2Count).toBe(3);
    expect(s.imageCount).toBe(3);
    // A whitespace-only alt is a missing alt.
    expect(s.imagesMissingAlt).toBe(2);
    expect(s.internalLinks).toBe(2);
    expect(s.externalLinks).toBe(1);
    // Script and style contents are excluded from the word count.
    expect(s.wordCount).toBeGreaterThan(0);
    expect(s.wordCount).toBeLessThan(20);
  });
});

test.describe('analysis plumbing', () => {
  test('page selection takes the busiest five, quietest three, and always the homepage', () => {
    const pages = [
      { path: '/popular', pageviews: 900 },
      { path: '/second', pageviews: 800 },
      { path: '/third', pageviews: 700 },
      { path: '/fourth', pageviews: 600 },
      { path: '/fifth', pageviews: 500 },
      { path: '/sixth', pageviews: 400 },
      { path: '/quiet-a', pageviews: 3 },
      { path: '/quiet-b', pageviews: 2 },
      { path: '/quiet-c', pageviews: 1 }
    ];

    const chosen = choosePaths(pages);

    expect(chosen).toContain('/');
    for (const p of ['/popular', '/second', '/third', '/fourth', '/fifth']) {
      expect(chosen).toContain(p);
    }
    for (const p of ['/quiet-a', '/quiet-b', '/quiet-c']) {
      expect(chosen).toContain(p);
    }
    expect(chosen).not.toContain('/sixth');
    // Deduplicated: the homepage must not appear twice if it is also a top page.
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  test('cost is an exact integer in micro-dollars', () => {
    // 2500 input, 2800 output at $0.435/$0.87 per million.
    expect(computeCostMicros(2500, 2800)).toBe(Math.round(2500 * 0.435 + 2800 * 0.87));
    expect(Number.isInteger(computeCostMicros(1234, 5678))).toBe(true);
    expect(computeCostMicros(0, 0)).toBe(0);
  });

  test('the JSON schema obeys the provider\'s strict-mode rules', () => {
    // These rules are not guessable and the rejection only surfaces at request time, so they are
    // asserted here rather than discovered by spending a call.
    const walk = (node: any, path: string) => {
      if (!node || typeof node !== 'object') return;

      for (const forbidden of ['minLength', 'maxLength', 'minItems', 'maxItems']) {
        expect(node[forbidden], `${path} must not use ${forbidden}`).toBeUndefined();
      }

      if (node.type === 'object') {
        expect(node.additionalProperties, `${path} must set additionalProperties:false`).toBe(
          false
        );
        const props = Object.keys(node.properties ?? {});
        // Nothing may be optional: every property must be required.
        expect(new Set(node.required ?? []), `${path} must require every property`).toEqual(
          new Set(props)
        );
        for (const key of props) walk(node.properties[key], `${path}.${key}`);
      }

      if (node.type === 'array') walk(node.items, `${path}[]`);
    };

    walk(analysisJsonSchema, 'root');
  });

  test('the validator rejects a response missing a required field', () => {
    const valid = {
      summary: 'A summary.',
      overallAssessment: 'healthy',
      recommendations: [
        {
          title: 'Do the thing',
          category: 'content',
          priority: 'high',
          finding: 'Something is true.',
          evidence: '1,427 visitors in the last 30 days',
          action: 'Change this.',
          affectedPaths: ['/pricing']
        }
      ],
      dataGaps: []
    };

    expect(analysisSchema.safeParse(valid).success).toBe(true);

    // affectedPaths absent rather than empty — the exact failure the "nothing optional" rule
    // exists to prevent.
    const { affectedPaths, ...withoutPaths } = valid.recommendations[0];
    expect(
      analysisSchema.safeParse({ ...valid, recommendations: [withoutPaths] }).success
    ).toBe(false);

    // An invented enum member.
    expect(
      analysisSchema.safeParse({ ...valid, overallAssessment: 'excellent' }).success
    ).toBe(false);

    // Empty evidence: a recommendation with nothing to check is not acceptable.
    expect(
      analysisSchema.safeParse({
        ...valid,
        recommendations: [{ ...valid.recommendations[0], evidence: '' }]
      }).success
    ).toBe(false);
  });
});
