import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as cheerio from 'cheerio';
import { normalizeDomain } from '@/lib/analytics/normalize';

/**
 * Fetching the customer's own pages — the security surface of the whole advisor.
 *
 * The URL is built from a domain the user typed into a form. Without checks, "my site" could be
 * the cloud metadata endpoint, an internal admin panel, or a database on the private network, and
 * whatever came back would be handed to a language model and rendered into a report. Every
 * request is therefore constrained on scheme, host, resolved address, redirects, time, size and
 * content type, and the address check is repeated at every redirect hop rather than only on the
 * first URL.
 *
 * Residual risk, documented rather than hidden: DNS is resolved once here for validation and
 * again by fetch when it connects, so a hostile resolver could answer differently the second
 * time. Closing that fully means connecting to the validated IP directly with an explicit Host
 * header, which is a larger change than this build warrants — it is listed as a known limitation.
 */

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 2;

export type PageSignals = {
  path: string;
  url: string;
  ok: true;
  title: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  hasOgImage: boolean;
  h1s: string[];
  h2Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  /** Empty string when the page was not redirected. */
  redirectedTo: string;
};

export type PageFailure = {
  path: string;
  url: string;
  ok: false;
  reason: string;
};

export type PageResult = PageSignals | PageFailure;

/**
 * True when an IP address is one nobody outside the network should be able to reach through us.
 *
 * Covers loopback, private ranges, link-local (including the cloud metadata address
 * 169.254.169.254), carrier-grade NAT, unique-local IPv6, multicast, and the unspecified address.
 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // Not an address we can reason about: refuse.

  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;

    if (a === 0) return true; // 0.0.0.0/8, "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 protocol assignments
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  // IPv6
  const addr = ip.toLowerCase().split('%')[0];
  if (addr === '::' || addr === '::1') return true; // unspecified, loopback
  if (addr.startsWith('fe80')) return true; // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique-local
  if (addr.startsWith('ff')) return true; // multicast

  // IPv4-mapped IPv6 (::ffff:127.0.0.1) must be judged on the embedded address.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedAddress(mapped[1]);

  return false;
}

/**
 * Validate a single URL before it is requested. Called for the initial URL and again for every
 * redirect target — a first hop that passes says nothing about where it points.
 */
export async function assertUrlIsSafe(
  rawUrl: string,
  expectedDomain: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'only https is allowed' };
  }

  const host = normalizeDomain(url.hostname);
  if (!host || host !== expectedDomain) {
    // A redirect off the registered domain is refused rather than followed: the advisor may only
    // read the site it was asked about.
    return { ok: false, reason: `host is not ${expectedDomain}` };
  }

  // A literal IP in the hostname never matches a registered domain, but check anyway so the
  // ordering of these guards is not load-bearing.
  if (isIP(url.hostname) && isBlockedAddress(url.hostname)) {
    return { ok: false, reason: 'address is not publicly routable' };
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return { ok: false, reason: 'domain does not resolve' };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: 'domain does not resolve' };
  }

  // ANY blocked answer refuses the request. A hostname resolving to both a public and a private
  // address is exactly the shape of a DNS-rebinding attempt.
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      return { ok: false, reason: 'address is not publicly routable' };
    }
  }

  return { ok: true };
}

/** Read at most MAX_BYTES from the response, so a huge body cannot exhaust memory. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  await reader.cancel().catch(() => {});

  const buffer = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const room = buffer.length - offset;
    if (room <= 0) break;
    buffer.set(chunk.subarray(0, Math.min(room, chunk.byteLength)), offset);
    offset += Math.min(room, chunk.byteLength);
  }

  return new TextDecoder('utf-8').decode(buffer);
}

export function extractSignals(
  html: string,
  pageUrl: string,
  siteDomain: string
): Omit<PageSignals, 'path' | 'url' | 'ok' | 'redirectedTo'> {
  // A real parser, not a regex. Attribute order and quoting vary far too much for a regex to be
  // reliable, and this data feeds claims a user will act on.
  const $ = cheerio.load(html);

  const text = (() => {
    const clone = cheerio.load(html);
    clone('script, style, noscript, svg, template').remove();
    return clone('body').text().replace(/\s+/g, ' ').trim();
  })();

  const h1s = $('h1')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);

  let internalLinks = 0;
  let externalLinks = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const resolved = new URL(href, pageUrl);
      if (normalizeDomain(resolved.hostname) === siteDomain) internalLinks++;
      else externalLinks++;
    } catch {
      // An unparseable href is not a link we can classify; ignore rather than guess.
    }
  });

  const images = $('img');

  return {
    title: $('title').first().text().trim(),
    metaDescription: $('meta[name="description"]').attr('content')?.trim() ?? '',
    canonical: $('link[rel="canonical"]').attr('href')?.trim() ?? '',
    robots: $('meta[name="robots"]').attr('content')?.trim() ?? '',
    ogTitle: $('meta[property="og:title"]').attr('content')?.trim() ?? '',
    ogDescription:
      $('meta[property="og:description"]').attr('content')?.trim() ?? '',
    hasOgImage: Boolean($('meta[property="og:image"]').attr('content')?.trim()),
    h1s,
    h2Count: $('h2').length,
    wordCount: text ? text.split(/\s+/).length : 0,
    imageCount: images.length,
    imagesMissingAlt: images.filter((_, el) => !$(el).attr('alt')?.trim()).length,
    internalLinks,
    externalLinks
  };
}

/**
 * Fetch one page and extract its on-page signals.
 *
 * Never throws: a page that cannot be read comes back as a failure with a reason, so the model
 * can be told "this page could not be read" instead of reasoning from a partial picture and
 * quietly describing a page nobody looked at.
 */
export async function fetchPageSignals(
  siteDomain: string,
  path: string
): Promise<PageResult> {
  const startUrl = `https://${siteDomain}${path}`;
  let currentUrl = startUrl;
  let redirectedTo = '';

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = await assertUrlIsSafe(currentUrl, siteDomain);
    if (!verdict.ok) {
      return { path, url: currentUrl, ok: false, reason: verdict.reason };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Followed by hand so every hop is re-validated.
        signal: controller.signal,
        headers: {
          accept: 'text/html',
          'user-agent': 'NovaAnalytics-Advisor/1.0 (+https://novaanalytics.io)'
        }
      });
    } catch (error) {
      clearTimeout(timer);
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'timed out after 5s'
          : 'request failed';
      return { path, url: currentUrl, ok: false, reason };
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { path, url: currentUrl, ok: false, reason: 'redirect without a location' };
      }
      if (hop === MAX_REDIRECTS) {
        return { path, url: currentUrl, ok: false, reason: 'too many redirects' };
      }
      currentUrl = new URL(location, currentUrl).href;
      // Recorded, because a page that redirected was not read: its signals belong to wherever it
      // landed. Omitting this is what once let the advisor describe authenticated routes using
      // the sign-in page's title.
      redirectedTo = currentUrl;
      continue;
    }

    if (!response.ok) {
      return { path, url: currentUrl, ok: false, reason: `responded ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return {
        path,
        url: currentUrl,
        ok: false,
        reason: `not html (${contentType.split(';')[0] || 'unknown'})`
      };
    }

    const html = await readCapped(response);

    return {
      path,
      url: currentUrl,
      ok: true,
      redirectedTo: redirectedTo && redirectedTo !== startUrl ? redirectedTo : '',
      ...extractSignals(html, currentUrl, siteDomain)
    };
  }

  return { path, url: currentUrl, ok: false, reason: 'too many redirects' };
}
