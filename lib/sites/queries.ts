import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { events, sites, type Site } from '@/lib/db/schema';

/**
 * Site lookup and ownership.
 *
 * The rule everywhere here: a site the caller cannot see is reported as **not found**, never as
 * forbidden. A 401 or 403 confirms the id exists, which turns a sequential id into an oracle for
 * counting and probing other people's sites.
 */

/** Sites the user owns, plus the unowned sample site, which every account can read. */
export async function getVisibleSites(userId: number): Promise<Site[]> {
  return db
    .select()
    .from(sites)
    .where(or(eq(sites.userId, userId), isNull(sites.userId))!)
    .orderBy(desc(sites.isSample), desc(sites.createdAt));
}

/** Only the sites the user actually owns — the ones they may rename, delete or analyse. */
export async function getOwnedSites(userId: number): Promise<Site[]> {
  return db
    .select()
    .from(sites)
    .where(eq(sites.userId, userId))
    .orderBy(desc(sites.createdAt));
}

/**
 * A site the user is allowed to *read*: their own, or the sample site.
 *
 * Returns null rather than throwing, so callers can decide between notFound() and a redirect.
 */
export async function getReadableSite(
  siteId: number,
  userId: number
): Promise<Site | null> {
  if (!Number.isInteger(siteId)) return null;

  const [site] = await db
    .select()
    .from(sites)
    .where(
      and(
        eq(sites.id, siteId),
        or(eq(sites.userId, userId), isNull(sites.userId))
      )
    )
    .limit(1);

  return site ?? null;
}

/**
 * A site the user may *modify*.
 *
 * Note this can never match the sample site: its user_id is null, and null never equals anything
 * in SQL. That is the whole mechanism — the sample site is readable by everyone and editable by
 * nobody, without a permissions table.
 */
export async function getOwnedSite(
  siteId: number,
  userId: number
): Promise<Site | null> {
  if (!Number.isInteger(siteId)) return null;

  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
    .limit(1);

  return site ?? null;
}

export async function getSiteByShareToken(token: string): Promise<Site | null> {
  if (!token) return null;

  const [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.shareToken, token))
    .limit(1);

  return site ?? null;
}

/** Whether a domain is already registered by this user, so the form can say so plainly. */
export async function userHasDomain(
  userId: number,
  domain: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.userId, userId), eq(sites.domain, domain)))
    .limit(1);

  return Boolean(row);
}

/** Pageview totals for a set of sites, for the list screen. */
export async function eventCountsForSites(
  siteIds: number[]
): Promise<Map<number, number>> {
  if (siteIds.length === 0) return new Map();

  const rows = await db
    .select({
      siteId: events.siteId,
      total: sql<number>`count(*)::int`
    })
    .from(events)
    .where(sql`${events.siteId} in ${siteIds}`)
    .groupBy(events.siteId);

  return new Map(rows.map((r) => [r.siteId, r.total]));
}
