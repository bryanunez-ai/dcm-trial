import { createHash, randomBytes } from 'node:crypto';
import { lt, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { visitorSalts } from '@/lib/db/schema';

/**
 * The privacy core.
 *
 *   visitor_hash = sha256(daily_salt + site_id + ip_address + user_agent)
 *
 * The salt is random per day and deleted after 48 hours. Once it is gone, the hashes it produced
 * cannot be linked back to an IP address even with full access to the database — the input is
 * unrecoverable, not merely unstored. The same visitor also hashes differently tomorrow, so
 * behaviour cannot be correlated across days.
 *
 * This is the approach Plausible and Fathom use, and it is why no cookie consent banner is
 * required under the common reading of GDPR/ePrivacy. That is design intent, not legal advice.
 */

/** The UTC day key. UTC rather than server-local so the rotation boundary does not move with the
 *  deployment region, and so two instances never disagree about which day it is. */
export function currentSaltDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Get the salt for a day, creating it lazily on that day's first event.
 *
 * Concurrency matters here and is easy to get wrong. Two simultaneous first-events of the day
 * must end up with the same salt, or one visitor hashes two different ways and is counted twice.
 * A read-then-insert has a race between the read and the insert; instead we insert with
 * ON CONFLICT DO NOTHING and then read back, so whichever row won is the one everybody uses.
 */
export async function getDailySalt(day: string = currentSaltDay()): Promise<string> {
  const candidate = randomBytes(32).toString('hex');

  await db
    .insert(visitorSalts)
    .values({ day, salt: candidate })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(visitorSalts)
    .where(eq(visitorSalts.day, day))
    .limit(1);

  // The select cannot miss: either our insert landed, or somebody else's did.
  return row?.salt ?? candidate;
}

/**
 * Delete salts older than two days.
 *
 * Deliberately on the write path rather than in a scheduled job. A cron that silently stops
 * running leaves the salts — and therefore the ability to re-derive who a hash belonged to —
 * sitting in the database indefinitely, and nothing would alert anyone. Here, the guarantee holds
 * exactly as long as the product is being used at all.
 */
export async function purgeExpiredSalts(day: string = currentSaltDay()): Promise<void> {
  const cutoff = new Date(`${day}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 2);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  await db.delete(visitorSalts).where(lt(visitorSalts.day, cutoffDay));
}

/**
 * The one-way hash standing in for a visitor, for one site, for one day.
 *
 * site_id is part of the input so the same person browsing two tracked sites produces two
 * unrelated hashes — one operator cannot correlate their visitors with another's.
 */
export function computeVisitorHash(input: {
  salt: string;
  siteId: number;
  ip: string;
  userAgent: string;
}): string {
  return createHash('sha256')
    .update(`${input.salt}:${input.siteId}:${input.ip}:${input.userAgent}`)
    .digest('hex');
}

/**
 * The client IP as seen behind Vercel's proxy.
 *
 * This value is used to compute the hash and is never stored — there is no column it could go in.
 * The leftmost x-forwarded-for entry is the original client; the rest are proxies.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Convenience for the collector: resolve today's salt and rotate old ones out in one call. */
export async function resolveDailySalt(): Promise<string> {
  const day = currentSaltDay();
  const salt = await getDailySalt(day);
  await purgeExpiredSalts(day);
  return salt;
}
