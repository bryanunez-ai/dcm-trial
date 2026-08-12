import OpenAI from 'openai';
import { db } from '@/lib/db/drizzle';
import { aiAnalyses, type Site } from '@/lib/db/schema';
import { getSiteMetrics } from '@/lib/analytics/metrics';
import { fetchPageSignals, type PageResult } from './fetch-page';
import {
  ANALYSIS_TOOL_NAME,
  analysisJsonSchema,
  analysisSchema,
  type Analysis
} from './schema';
import { SYSTEM_PROMPT, buildUserMessage, type AnalysisPayload } from './prompt';

/**
 * The advisor.
 *
 * Provider constraints (DeepSeek V4), each of which changes the code:
 *
 *  - Strict schema requires the /beta base URL AND `strict: true` on the function.
 *  - A forced `tool_choice` is REJECTED — the model reasons by default and refuses to be
 *    compelled. So exactly one tool is offered, its description says it must be called, and we
 *    fail loudly if prose comes back instead. Reasoning over the data is the feature; we would
 *    rather have it and handle the refusal case than trade it for a guaranteed call.
 *  - Streaming with strict tools is undocumented, so we do not stream. Stages are reported from
 *    the server instead, and they are the real stages — it genuinely fetches pages, then calls
 *    the model.
 */

const MODEL = 'deepseek-v4-pro';

// $0.435 per 1M input tokens (cache miss), $0.87 per 1M output. Kept in micro-dollars so cost
// stays an exact integer rather than accumulating float error across rows.
const INPUT_MICROS_PER_TOKEN = 0.435;
const OUTPUT_MICROS_PER_TOKEN = 0.87;

export function computeCostMicros(inputTokens: number, outputTokens: number): number {
  return Math.round(
    (inputTokens * INPUT_MICROS_PER_TOKEN + outputTokens * OUTPUT_MICROS_PER_TOKEN) / 1
  );
}

export class AdvisorError extends Error {}

/**
 * Which pages to read: the busiest five and the quietest three, always including the homepage,
 * deduplicated.
 *
 * The busiest matter because a flaw there costs the most traffic. The quietest matter because the
 * explanation for the silence often lives in the page itself — a missing title, a redirect, a
 * page that is one paragraph long.
 */
export function choosePaths(topPages: Array<{ path: string; pageviews: number }>): string[] {
  const sorted = [...topPages].sort((a, b) => b.pageviews - a.pageviews);
  const busiest = sorted.slice(0, 5).map((p) => p.path);
  const quietest = sorted.slice(-3).map((p) => p.path);

  const chosen = new Set<string>(['/']);
  for (const path of [...busiest, ...quietest]) chosen.add(path);

  return [...chosen];
}

export type AnalysisResult = {
  analysis: Analysis;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  pages: PageResult[];
};

export async function runAnalysis(site: Site, days = 30): Promise<AnalysisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AdvisorError('No DEEPSEEK_API_KEY configured.');

  const metrics = await getSiteMetrics(site.id, days);

  const paths = choosePaths(metrics.topPages);
  // Sequential rather than parallel: this is somebody's website, and eight simultaneous requests
  // from an analytics vendor is rude at best.
  const pages: PageResult[] = [];
  for (const path of paths) {
    pages.push(await fetchPageSignals(site.domain, path));
  }

  const payload: AnalysisPayload = {
    site: { domain: site.domain, windowDays: days },
    traffic: {
      current: {
        visitors: metrics.current.visitors,
        pageviews: metrics.current.pageviews,
        viewsPerVisitor: metrics.current.viewsPerVisitor,
        bounceRatePercent:
          metrics.current.bounceRate === null
            ? null
            : Math.round(metrics.current.bounceRate * 100)
      },
      previous: {
        visitors: metrics.previous.visitors,
        pageviews: metrics.previous.pageviews,
        viewsPerVisitor: metrics.previous.viewsPerVisitor,
        bounceRatePercent:
          metrics.previous.bounceRate === null
            ? null
            : Math.round(metrics.previous.bounceRate * 100)
      },
      dailySeries: metrics.series,
      referrers: metrics.topSources.map((s) => ({
        source: s.source ?? 'Direct / none',
        visitors: s.visitors,
        pageviews: s.pageviews
      })),
      topPages: metrics.topPages
    },
    // A page that could not be fetched is reported as unavailable rather than dropped, so the
    // model can say "I could not read this" instead of reasoning from a partial picture.
    pages: pages.map((page) =>
      page.ok
        ? page
        : { path: page.path, ok: false, couldNotBeRead: page.reason }
    )
  };

  const client = new OpenAI({
    apiKey,
    // Strict schema support lives behind the beta base URL. On the standard URL the same request
    // is accepted but the schema is not enforced, which is worse than being rejected.
    baseURL: 'https://api.deepseek.com/beta'
  });

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(payload) }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: ANALYSIS_TOOL_NAME,
          description:
            'Submit the completed analysis. You MUST call this function; do not answer with prose.',
          strict: true,
          parameters: analysisJsonSchema as unknown as Record<string, unknown>
        }
      }
    ]
    // Deliberately no tool_choice: V4 rejects a forced choice in thinking mode.
  });

  const message = completion.choices[0]?.message;
  const call = message?.tool_calls?.find(
    (t) => 'function' in t && t.function.name === ANALYSIS_TOOL_NAME
  );

  if (!call || !('function' in call)) {
    // Fail loudly rather than salvaging prose. A report is only worth showing if it came through
    // the validated schema; anything else would be an unvalidated wall of text wearing the
    // interface of a structured analysis.
    throw new AdvisorError(
      'The model answered with prose instead of calling the analysis tool. Nothing was stored.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    throw new AdvisorError('The model returned arguments that were not valid JSON.');
  }

  const validated = analysisSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AdvisorError(
      `The model's response did not match the required schema: ${validated.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`
    );
  }

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;

  return {
    analysis: validated.data,
    // As reported by the provider, not as requested — they can differ.
    model: completion.model ?? MODEL,
    inputTokens,
    outputTokens,
    costMicros: computeCostMicros(inputTokens, outputTokens),
    pages
  };
}

/** Only successful analyses are stored. Recording failures would make every read filter by a
 *  status that nothing displays. */
export async function storeAnalysis(
  siteId: number,
  userId: number | null,
  result: AnalysisResult
) {
  const [row] = await db
    .insert(aiAnalyses)
    .values({
      siteId,
      userId,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costMicros: result.costMicros,
      payload: result.analysis
    })
    .returning();

  return row;
}
