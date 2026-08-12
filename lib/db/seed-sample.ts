import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { events, sites } from './schema';

/**
 * The sample site: ~90 days of generated traffic, from a fixed-seed PRNG.
 *
 * Fixed seed so that local, production, screenshots and the walkthrough video all show identical
 * numbers — a demo where the figures move between takes is a demo that looks broken. Regenerated
 * on every seed run so the window always ends today rather than drifting into the past.
 *
 * The site is owned by nobody (user_id null). That single nullable column does the work of a
 * permissions system: every signed-in account can read it, so a reviewer's fresh signup is not
 * greeted by an empty dashboard, and no ownership check can ever match it, so nobody can edit or
 * delete it. The collector rejects it explicitly, so its generated history can never be polluted
 * with real traffic.
 *
 * These numbers are labelled as sample data everywhere they appear. That labelling is the whole
 * reason generating them is acceptable at all.
 */

export const SAMPLE_DOMAIN = 'demo.novaanalytics.io';
export const SAMPLE_SITE_KEY = 'novasampledemositekey0000000000a';

/** Deterministic PRNG (mulberry32). Same seed, same sequence, on every machine. */
function makeRandom(seed: number) {
  let a = seed >>> 0;
  return function random(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAGES: Array<[path: string, weight: number]> = [
  ['/', 30],
  ['/pricing', 14],
  ['/blog/cookieless-analytics', 12],
  ['/blog/what-we-do-not-measure', 9],
  ['/docs/install', 8],
  ['/features', 7],
  ['/blog/reading-your-referrers', 6],
  ['/about', 5],
  ['/docs/share-links', 5],
  ['/changelog', 4]
];

const SOURCES: Array<[domain: string | null, weight: number]> = [
  [null, 34], // Direct / none
  ['google.com', 22],
  ['news.ycombinator.com', 13],
  ['github.com', 9],
  ['reddit.com', 7],
  ['linkedin.com', 5],
  ['x.com', 4],
  ['duckduckgo.com', 3],
  ['bing.com', 2],
  ['producthunt.com', 1]
];

function weightedPick<T>(items: Array<[T, number]>, random: () => number): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of items) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return items[items.length - 1][0];
}

const DAYS = 90;

export async function seedSampleSite(): Promise<{ siteId: number; events: number }> {
  const [existing] = await db
    .select()
    .from(sites)
    .where(eq(sites.siteKey, SAMPLE_SITE_KEY))
    .limit(1);

  const site =
    existing ??
    (
      await db
        .insert(sites)
        .values({
          userId: null,
          name: 'Nova Sample Site',
          domain: SAMPLE_DOMAIN,
          siteKey: SAMPLE_SITE_KEY,
          isSample: true
        })
        .returning()
    )[0];

  // Regenerate from scratch so the window ends today.
  await db.delete(events).where(eq(events.siteId, site.id));

  const random = makeRandom(20260812);
  const rows: Array<typeof events.$inferInsert> = [];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - dayOffset);

    const dow = day.getUTCDay();
    // Weekends are quieter, and there is a gentle upward trend across the window — the shape a
    // real site would have, rather than uniform noise.
    const weekend = dow === 0 || dow === 6 ? 0.62 : 1;
    const trend = 0.55 + (0.85 * (DAYS - dayOffset)) / DAYS;
    const noise = 0.75 + random() * 0.5;

    const visitorCount = Math.max(
      3,
      Math.round(42 * weekend * trend * noise)
    );

    for (let v = 0; v < visitorCount; v++) {
      // A stable per-visitor identity for the day. Hashed so it looks exactly like a real
      // visitor_hash column value — 64 hex characters — rather than something obviously fake.
      const visitorHash = createHash('sha256')
        .update(`sample:${site.id}:${dayOffset}:${v}`)
        .digest('hex');

      const referrer = weightedPick(SOURCES, random);

      // Most visitors read one page; a minority go deeper. This is what makes the bounce rate a
      // believable number rather than a flat constant.
      const depth =
        random() < 0.58 ? 1 : random() < 0.75 ? 2 : random() < 0.9 ? 3 : 4;

      for (let p = 0; p < depth; p++) {
        const timestamp = new Date(day);
        // Cluster around working hours with a long tail, then minutes apart within a visit.
        const hour = Math.min(
          23,
          Math.max(0, Math.round(9 + (random() - 0.5) * 14))
        );
        timestamp.setUTCHours(
          hour,
          Math.floor(random() * 60),
          Math.floor(random() * 60),
          0
        );
        timestamp.setUTCMinutes(timestamp.getUTCMinutes() + p * 3);

        rows.push({
          siteId: site.id,
          timestamp,
          path: weightedPick(PAGES, random),
          // Only the first pageview of a visit carries a referrer; the rest are internal
          // navigation, which the collector would have stored as null.
          referrerDomain: p === 0 ? referrer : null,
          visitorHash
        });
      }
    }
  }

  // Chunked to stay well under the parameter limit for a single statement.
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(events).values(rows.slice(i, i + 1000));
  }

  return { siteId: site.id, events: rows.length };
}
