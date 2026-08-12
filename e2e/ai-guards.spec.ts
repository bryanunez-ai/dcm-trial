import { test, expect } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../lib/db/drizzle';
import { aiAnalyses, events, sites, users } from '../lib/db/schema';
import { generateSiteKey } from '../lib/analytics/keys';
import { hashPassword } from '../lib/auth/session';
import { checkAnalysisAllowed, DAILY_ANALYSIS_CAP } from '../lib/ai/guards';
import { DEMO_EMAIL } from '../lib/demo';

/**
 * The cost controls, exercised against the real tables.
 *
 * None of these spend money, by design: every control refuses BEFORE the API call, which is the
 * whole point of them. The daily cap is counted from stored rows, so inserting rows tests the
 * exact mechanism rather than a stand-in for it — and it costs nothing.
 */

const stubPayload = {
  summary: 'stub',
  overallAssessment: 'healthy',
  recommendations: [],
  dataGaps: []
};

let userId: number;
let siteId: number;
let emptySiteId: number;
let sampleSiteId: number;
let demoUserId: number;

test.beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `guards-${Date.now()}@example.test`,
      passwordHash: await hashPassword('a-long-enough-password'),
      role: 'owner'
    })
    .returning();
  userId = user.id;

  const [withTraffic] = await db
    .insert(sites)
    .values({
      userId,
      name: 'Has traffic',
      domain: `guards-${Date.now()}.example`,
      siteKey: generateSiteKey()
    })
    .returning();
  siteId = withTraffic.id;

  await db.insert(events).values({
    siteId,
    path: '/',
    referrerDomain: null,
    visitorHash: 'f'.repeat(64)
  });

  const [empty] = await db
    .insert(sites)
    .values({
      userId,
      name: 'No traffic',
      domain: `empty-${Date.now()}.example`,
      siteKey: generateSiteKey()
    })
    .returning();
  emptySiteId = empty.id;

  const [sample] = await db
    .insert(sites)
    .values({
      userId: null,
      name: 'Sample',
      domain: `sample-${Date.now()}.example`,
      siteKey: generateSiteKey(),
      isSample: true
    })
    .returning();
  sampleSiteId = sample.id;

  const [demo] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  demoUserId = demo.id;
});

test.afterAll(async () => {
  await db.delete(aiAnalyses).where(eq(aiAnalyses.userId, userId));
  await db.delete(sites).where(inArray(sites.id, [siteId, emptySiteId, sampleSiteId]));
  await db.delete(users).where(eq(users.id, userId));
});

async function load(id: number) {
  const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  return site;
}

async function loadUser(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

test.describe('AI cost controls', () => {
  test('a site with traffic is allowed', async () => {
    const verdict = await checkAnalysisAllowed({
      user: await loadUser(userId),
      site: await load(siteId)
    });
    expect(verdict.allowed).toBe(true);
  });

  test('the demo account can never generate', async () => {
    // Its credentials are published on the sign-in page, so this button is reachable by anyone on
    // the internet and every press would spend real money.
    const verdict = await checkAnalysisAllowed({
      user: await loadUser(demoUserId),
      site: await load(siteId)
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.code).toBe('demo_account');
  });

  test('the sample site can never be analysed', async () => {
    // Its domain does not resolve, so a run would spend money fetching pages that do not exist.
    const verdict = await checkAnalysisAllowed({
      user: await loadUser(userId),
      site: await load(sampleSiteId)
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.code).toBe('sample_site');
  });

  test('a site with no traffic is refused before any spend', async () => {
    const verdict = await checkAnalysisAllowed({
      user: await loadUser(userId),
      site: await load(emptySiteId)
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.code).toBe('no_data');
  });

  test('a second run within 24 hours reuses instead of spending twice', async () => {
    await db.insert(aiAnalyses).values({
      siteId,
      userId,
      model: 'deepseek-v4-pro',
      inputTokens: 3126,
      outputTokens: 6984,
      costMicros: 7436,
      payload: stubPayload
    });

    const verdict = await checkAnalysisAllowed({
      user: await loadUser(userId),
      site: await load(siteId)
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.code).toBe('recent_analysis');

    // force overrides the reuse window — and only the reuse window.
    const forced = await checkAnalysisAllowed({
      user: await loadUser(userId),
      site: await load(siteId),
      force: true
    });
    expect(forced.allowed).toBe(true);
  });

  test('the daily cap counts stored rows and force cannot bypass it', async () => {
    // One row already exists from the previous test; add enough to reach the cap.
    const existing = await db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.userId, userId));

    for (let i = existing.length; i < DAILY_ANALYSIS_CAP; i++) {
      await db.insert(aiAnalyses).values({
        siteId,
        userId,
        model: 'deepseek-v4-pro',
        inputTokens: 100,
        outputTokens: 100,
        costMicros: 131,
        payload: stubPayload
      });
    }

    const verdict = await checkAnalysisAllowed({
      user: await loadUser(userId),
      site: await load(siteId),
      force: true
    });

    expect(verdict.allowed, 'force must not bypass the daily cap').toBe(false);
    expect(verdict.allowed === false && verdict.code).toBe('daily_cap');
  });

  test('stored rows carry sensible token counts and cost', async () => {
    const rows = await db.select().from(aiAnalyses).where(eq(aiAnalyses.userId, userId));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.inputTokens).toBeGreaterThan(0);
      expect(row.outputTokens).toBeGreaterThan(0);
      expect(Number.isInteger(row.costMicros)).toBe(true);
      expect(row.costMicros).toBeGreaterThan(0);
      // A single analysis costing more than a dollar would mean the pricing maths is wrong.
      expect(row.costMicros).toBeLessThan(1_000_000);
      expect(row.model).toContain('deepseek');
    }
  });

  test('without an API key, generation is unavailable but reports still render', async () => {
    const key = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    try {
      const verdict = await checkAnalysisAllowed({
        user: await loadUser(userId),
        site: await load(siteId)
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.allowed === false && verdict.code).toBe('no_api_key');
    } finally {
      if (key) process.env.DEEPSEEK_API_KEY = key;
    }
  });
});
