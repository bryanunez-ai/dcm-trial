import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { events, sites } from '@/lib/db/schema';
import { isBotUserAgent } from '@/lib/analytics/bots';
import {
  hostFromHeader,
  normalizePath,
  normalizeReferrer
} from '@/lib/analytics/normalize';
import {
  clientIpFrom,
  computeVisitorHash,
  resolveDailySalt
} from '@/lib/analytics/visitor';

// node:crypto is required for the visitor hash, so this cannot run on the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2048;

/**
 * Every response from this endpoint is an identical empty 202, whatever happened.
 *
 * A collector that answers differently for a valid key, an unknown key and a rejected origin is an
 * oracle: anyone can enumerate which site keys exist, and therefore who the customers are. So
 * there is exactly one response object and one way out of the handler.
 *
 * Failures are swallowed on purpose. Losing a pageview is strictly preferable to returning an
 * error to a beacon firing from somebody else's page.
 */
function accepted(): Response {
  return new Response(null, {
    status: 202,
    headers: {
      // The tracker sends a text/plain blob to stay a CORS simple request, so no preflight is
      // ever issued. These let the browser accept the response from any tracked origin.
      'access-control-allow-origin': '*',
      'cache-control': 'no-store'
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    await collect(request);
  } catch {
    // Deliberately silent: see above.
  }
  return accepted();
}

/**
 * The tracker never issues a preflight — it posts a text/plain blob, which is a CORS simple
 * request. This exists only for the fetch(keepalive) fallback in exotic cases.
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    }
  });
}

/**
 * The validation order matters and is the order in the spec: cheapest and most abusive rejections
 * first, database access only once the request looks real, and the write last.
 */
async function collect(request: Request): Promise<void> {
  // 1. Reject bodies over ~2 KB, or empty.
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return;

  const raw = await request.text();
  if (!raw || raw.length === 0) return;
  // content-length can lie or be absent; the decoded body is the authority.
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return;

  // 2. Parse JSON; reject malformed.
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  const { siteKey, path, referrer } = body as Record<string, unknown>;
  if (typeof siteKey !== 'string' || siteKey.length === 0 || siteKey.length > 32) {
    return;
  }
  if (typeof path !== 'string') return;

  // 3. Reject known bot user agents.
  const userAgent = request.headers.get('user-agent');
  if (isBotUserAgent(userAgent)) return;

  // 4. Look up the site by site_key; reject unknown.
  const [site] = await db
    .select({
      id: sites.id,
      domain: sites.domain,
      isSample: sites.isSample
    })
    .from(sites)
    .where(eq(sites.siteKey, siteKey))
    .limit(1);

  if (!site) return;

  // 5. Reject the sample site. Its history is generated from a fixed seed so that every demo,
  //    screenshot and walkthrough shows identical numbers; real traffic would corrupt that.
  if (site.isSample) return;

  // 6. Origin check. The site key is public — it ships in the HTML of every tracked page — so what
  //    actually protects a site from cross-site noise is that the request has to come from its own
  //    registered domain.
  const origin =
    hostFromHeader(request.headers.get('origin')) ??
    hostFromHeader(request.headers.get('referer'));
  if (!origin || origin !== site.domain) return;

  // 7. Resolve the day's salt and compute the visitor hash. The IP and user agent are inputs here
  //    and are never stored; there is no column that could hold either.
  const salt = await resolveDailySalt();
  const visitorHash = computeVisitorHash({
    salt,
    siteId: site.id,
    ip: clientIpFrom(request.headers),
    userAgent: userAgent ?? ''
  });

  // 8. Normalise the path — query string and fragment stripped, capped at the column width.
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return;

  // 9. Reduce the referrer to a bare domain; drop self-referrals to null.
  const referrerDomain = normalizeReferrer(
    typeof referrer === 'string' ? referrer : null,
    site.domain
  );

  // 10. Insert.
  await db.insert(events).values({
    siteId: site.id,
    path: normalizedPath,
    referrerDomain,
    visitorHash
  });
}
