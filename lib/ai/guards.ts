import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { aiAnalyses, events, type Site, type User } from '@/lib/db/schema';
import { isDemoAccount } from '@/lib/demo';

/**
 * Server-side cost controls.
 *
 * The demo credentials are published on the sign-in page, so this button is reachable by anyone
 * on the internet, and every press spends real money. Every control below is enforced here, in
 * the action path — hiding a control in the UI does not stop the Server Action being called, and
 * an unguarded button that calls a paid API is an open invoice.
 */

export const DAILY_ANALYSIS_CAP = 3;
export const REUSE_WINDOW_HOURS = 24;

export type GuardRefusal = {
  allowed: false;
  /** Which of the reasons applies, so the UI can explain rather than show a control that fails. */
  code:
    | 'no_api_key'
    | 'demo_account'
    | 'sample_site'
    | 'no_data'
    | 'daily_cap'
    | 'recent_analysis';
  message: string;
};

export type GuardApproval = { allowed: true };

export function hasApiKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function countAnalysesToday(userId: number): Promise<number> {
  // Counted from the stored rows themselves, not from a separate counter. A counter can drift
  // from what was actually spent — these rows ARE the record of spending.
  const rows = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiAnalyses)
    .where(
      and(
        eq(aiAnalyses.userId, userId),
        gte(aiAnalyses.createdAt, sql`now() - interval '24 hours'`)
      )
    )) as Array<{ n: number }>;

  return Number(rows[0]?.n ?? 0);
}

export async function getLatestAnalysis(siteId: number) {
  const [row] = await db
    .select()
    .from(aiAnalyses)
    .where(eq(aiAnalyses.siteId, siteId))
    .orderBy(desc(aiAnalyses.createdAt))
    .limit(1);

  return row ?? null;
}

async function siteHasEvents(siteId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.siteId, siteId))
    .limit(1);

  return Boolean(row);
}

/**
 * The full gate, in the order that spends the least before refusing.
 *
 * `force` skips only the reuse window — never the cap, never the demo guard.
 */
export async function checkAnalysisAllowed(options: {
  user: User;
  site: Site;
  force?: boolean;
}): Promise<GuardApproval | GuardRefusal> {
  const { user, site, force = false } = options;

  if (!hasApiKey()) {
    return {
      allowed: false,
      code: 'no_api_key',
      message:
        'Generating new analyses is unavailable because no AI provider key is configured. Stored reports still render.'
    };
  }

  if (isDemoAccount(user.email)) {
    return {
      allowed: false,
      code: 'demo_account',
      message:
        'The demo account cannot generate analyses — its credentials are published, so this would be an open invoice. The stored report below was generated for real and is what a report looks like.'
    };
  }

  if (site.isSample) {
    return {
      allowed: false,
      code: 'sample_site',
      message:
        'The sample site cannot be analysed. Its domain does not resolve, so a run would spend money fetching pages that do not exist and produce nothing.'
    };
  }

  if (!(await siteHasEvents(site.id))) {
    return {
      allowed: false,
      code: 'no_data',
      message:
        'This site has no traffic yet. There is nothing to analyse, so nothing is spent trying.'
    };
  }

  const used = await countAnalysesToday(user.id);
  if (used >= DAILY_ANALYSIS_CAP) {
    return {
      allowed: false,
      code: 'daily_cap',
      message: `You have used all ${DAILY_ANALYSIS_CAP} analyses for today. The limit resets 24 hours after each run.`
    };
  }

  if (!force) {
    const latest = await getLatestAnalysis(site.id);
    if (latest) {
      const ageMs = Date.now() - new Date(latest.createdAt).getTime();
      if (ageMs < REUSE_WINDOW_HOURS * 60 * 60 * 1000) {
        return {
          allowed: false,
          code: 'recent_analysis',
          message: `This site was analysed within the last ${REUSE_WINDOW_HOURS} hours. The existing report is shown below — a double-click should not cost twice.`
        };
      }
    }
  }

  return { allowed: true };
}
