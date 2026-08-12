import { and, eq } from 'drizzle-orm';
import { db, client } from '../../lib/db/drizzle';
import { events, sites } from '../../lib/db/schema';
import { generateSiteKey } from '../../lib/analytics/keys';

/**
 * Test fixtures that talk to the same database the app talks to.
 *
 * These deliberately use the ORM rather than raw SQL, because the timestamps written by the app
 * and read back here must go through the same driver and the same parsing — the raw postgres
 * driver and Drizzle disagree about whether `timestamp without time zone` is local or UTC, and a
 * test that reads through the other path proves nothing about what the app sees.
 */

export async function createTestSite(options: {
  domain: string;
  name?: string;
  isSample?: boolean;
  userId?: number | null;
}) {
  const [site] = await db
    .insert(sites)
    .values({
      name: options.name ?? `Test ${options.domain}`,
      domain: options.domain,
      siteKey: generateSiteKey(),
      isSample: options.isSample ?? false,
      userId: options.userId ?? null
    })
    .returning();

  return site;
}

export async function deleteTestSite(siteId: number) {
  // Events cascade.
  await db.delete(sites).where(eq(sites.id, siteId));
}

export async function eventsForSite(siteId: number) {
  return db.select().from(events).where(eq(events.siteId, siteId));
}

export async function countEventsForSite(siteId: number) {
  return (await eventsForSite(siteId)).length;
}

export async function eventsForSitePath(siteId: number, path: string) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.siteId, siteId), eq(events.path, path)));
}

/** Column names actually present on a table, straight from information_schema. */
export async function columnsOf(table: string): Promise<string[]> {
  const rows = await client<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position`;
  return rows.map((r) => r.column_name);
}

/**
 * Deliberately not exported as a per-spec teardown.
 *
 * All specs share one worker process and therefore one postgres client singleton, so a spec that
 * closed the connection in its own afterAll broke every spec that ran after it — the symptom was
 * a salt test that passed alone and failed in the suite. The connection is closed once, by the
 * global teardown, after every spec has finished.
 */
export async function closeDbOnce() {
  await client.end({ timeout: 5 });
}
