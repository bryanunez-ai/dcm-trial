import { test, expect } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../lib/db/drizzle';
import { visitorSalts } from '../lib/db/schema';
import {
  computeVisitorHash,
  currentSaltDay,
  getDailySalt,
  purgeExpiredSalts
} from '../lib/analytics/visitor';

/**
 * The privacy guarantees, tested against the real table rather than described in a comment.
 *
 * These run against the same database the app uses, so they also prove the ON CONFLICT path works
 * on Postgres rather than only in principle.
 */

function dayOffset(days: number): string {
  const d = new Date(`${currentSaltDay()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Far-future days so these fixtures cannot collide with real traffic during the run.
const DAY_A = dayOffset(400);
const DAY_B = dayOffset(401);
// The purge fixture is in the *past*, and the purge below runs as of today rather than as of a
// future day. Purging as of a future day would delete today's real salt as collateral — correct
// behaviour for the function, wrong behaviour for a test to inflict on the database it shares.
const ANCIENT = dayOffset(-5);
const FIXTURE_DAYS = [DAY_A, DAY_B, ANCIENT];

test.afterAll(async () => {
  await db
    .delete(visitorSalts)
    .where(inArray(visitorSalts.day, [...FIXTURE_DAYS, dayOffset(-1)]));
});

test.describe('visitor hashing', () => {
  test('concurrent first-events of a day agree on one salt', async () => {
    // The race this guards: two simultaneous first-events must not each mint their own salt, or
    // the same visitor hashes two different ways and is counted twice. Insert-with-conflict then
    // read back is what makes them agree.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => getDailySalt(DAY_A))
    );

    expect(new Set(results).size, 'all callers see the same salt').toBe(1);

    const rows = await db
      .select()
      .from(visitorSalts)
      .where(eq(visitorSalts.day, DAY_A));
    expect(rows).toHaveLength(1);
    expect(rows[0].salt).toBe(results[0]);
    expect(rows[0].salt).toMatch(/^[0-9a-f]{64}$/);
  });

  test('the same visitor hashes differently on consecutive days', async () => {
    const saltA = await getDailySalt(DAY_A);
    const saltB = await getDailySalt(DAY_B);
    expect(saltA).not.toBe(saltB);

    const visitor = { siteId: 1, ip: '203.0.113.10', userAgent: 'Mozilla/5.0 Test' };

    const today = computeVisitorHash({ salt: saltA, ...visitor });
    const tomorrow = computeVisitorHash({ salt: saltB, ...visitor });

    expect(today).not.toBe(tomorrow);
    // Same day, same person, same site — stable, or nothing could be counted at all.
    expect(computeVisitorHash({ salt: saltA, ...visitor })).toBe(today);
  });

  test('the same visitor on two sites cannot be correlated', async () => {
    const salt = await getDailySalt(DAY_A);
    const visitor = { ip: '203.0.113.10', userAgent: 'Mozilla/5.0 Test' };

    // site_id is part of the hash input precisely so one operator cannot match their visitors
    // against another operator's.
    expect(computeVisitorHash({ salt, siteId: 1, ...visitor })).not.toBe(
      computeVisitorHash({ salt, siteId: 2, ...visitor })
    );
  });

  test('salts older than two days are deleted on the write path', async () => {
    const today = currentSaltDay();
    const yesterday = dayOffset(-1);

    await db
      .insert(visitorSalts)
      .values([
        { day: ANCIENT, salt: 'a'.repeat(64) },
        { day: yesterday, salt: 'b'.repeat(64) }
      ])
      .onConflictDoNothing();

    // Today's salt exists because an event arrived, which is what triggers the purge.
    await getDailySalt(today);

    expect(
      await db.select().from(visitorSalts).where(eq(visitorSalts.day, ANCIENT))
    ).toHaveLength(1);

    await purgeExpiredSalts(today);

    expect(
      await db.select().from(visitorSalts).where(eq(visitorSalts.day, ANCIENT)),
      'a salt older than two days must be gone — once it is, the hashes it produced can never be linked back to an IP address, even with full access to the database'
    ).toHaveLength(0);

    // Yesterday's and today's survive, or day-over-day figures would break.
    expect(
      await db.select().from(visitorSalts).where(eq(visitorSalts.day, yesterday))
    ).toHaveLength(1);
    expect(
      await db.select().from(visitorSalts).where(eq(visitorSalts.day, today))
    ).toHaveLength(1);
  });
});
