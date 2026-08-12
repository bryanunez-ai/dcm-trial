import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { sites } from './schema';
import { generateSiteKey } from '@/lib/analytics/keys';
import { normalizeDomain } from '@/lib/analytics/normalize';
import { getBaseUrl } from '@/lib/base-url';

export type SelfTrackingResult =
  | { skipped: true; reason: string }
  | { skipped: false; siteId: number; domain: string; created: boolean };

/**
 * The self-tracking site: Nova measuring its own deployment.
 *
 * Registered against whatever BASE_URL points at and owned by the demo account, so the live
 * dashboard shows real traffic — including the reviewer's own visit, arriving while they watch.
 * That demonstrates far more than generated numbers can, and it is the site the seeded AI report
 * is generated against.
 *
 * Skipped for localhost: the tracker refuses to report from localhost by design, so a site
 * registered for it could never receive anything and would sit in the dashboard as a permanently
 * empty row — a feature that looks functional and does nothing.
 */
export async function seedSelfTrackingSite(
  ownerId: number
): Promise<SelfTrackingResult> {
  const baseUrl = getBaseUrl();
  const domain = normalizeDomain(baseUrl);
  if (!domain) {
    return { skipped: true, reason: `not a usable origin (${baseUrl})` };
  }

  if (domain === 'localhost' || domain === '127.0.0.1' || domain.endsWith('.local')) {
    return {
      skipped: true,
      reason: `${domain} — the tracker never reports from localhost, so this site could never receive an event`
    };
  }

  const [existing] = await db
    .select()
    .from(sites)
    .where(eq(sites.domain, domain))
    .limit(1);

  if (existing) {
    // Re-assert ownership in case the row predates the demo account being seeded.
    if (existing.userId !== ownerId) {
      await db.update(sites).set({ userId: ownerId }).where(eq(sites.id, existing.id));
    }
    return { skipped: false, siteId: existing.id, domain, created: false };
  }

  const [site] = await db
    .insert(sites)
    .values({
      userId: ownerId,
      name: 'Nova Analytics (this site)',
      domain,
      siteKey: generateSiteKey()
    })
    .returning();

  return { skipped: false, siteId: site.id, domain, created: true };
}
