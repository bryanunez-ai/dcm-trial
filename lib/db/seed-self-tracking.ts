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
 * Registered against whatever BASE_URL points at, so the live dashboard shows real traffic —
 * including the reviewer's own visit, arriving while they watch. That demonstrates far more than
 * generated numbers can, and it is the site the seeded AI report is generated against.
 *
 * **Deliberately unowned** (`user_id` null), exactly like the sample site. That one nullable
 * column does the work of a permissions system: every signed-in account can read it, so it shows
 * up in everybody's site switcher, and no ownership check can ever match it, so nobody can rename
 * or delete it — not even the demo account that seeded it.
 *
 * It was previously owned by the demo account and protected by a rule saying "the demo account
 * cannot delete sites". That rule was too broad: it also stopped the demo account deleting sites
 * a visitor had added themselves, which left them stuck in the dashboard with a button that
 * refused. Structure is a better guard than a condition — there is now nothing to special-case.
 *
 * Skipped for localhost: the tracker refuses to report from localhost by design, so a site
 * registered for it could never receive anything and would sit in the dashboard as a permanently
 * empty row — a feature that looks functional and does nothing.
 */
export async function seedSelfTrackingSite(): Promise<SelfTrackingResult> {
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
    // Release ownership if this row predates the change above. Re-running the seed is how an
    // existing deployment picks the fix up.
    if (existing.userId !== null) {
      await db.update(sites).set({ userId: null }).where(eq(sites.id, existing.id));
    }
    return { skipped: false, siteId: existing.id, domain, created: false };
  }

  const [site] = await db
    .insert(sites)
    .values({
      userId: null,
      name: 'Nova Analytics (this site)',
      domain,
      siteKey: generateSiteKey()
    })
    .returning();

  return { skipped: false, siteId: site.id, domain, created: true };
}
