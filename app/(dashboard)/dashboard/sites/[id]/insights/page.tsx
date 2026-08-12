import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/db/queries';
import { getReadableSite } from '@/lib/sites/queries';
import { db } from '@/lib/db/drizzle';
import { aiAnalyses } from '@/lib/db/schema';
import { checkAnalysisAllowed } from '@/lib/ai/guards';
import { analysisSchema } from '@/lib/ai/schema';
import { AnalysisReport } from '@/components/analytics/analysis-report';
import { GenerateButton } from './generate-button';

export const metadata: Metadata = { title: 'Insights' };
export const dynamic = 'force-dynamic';

export default async function InsightsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  // Readable, not owned: the sample site's seeded report should be visible to everyone, even
  // though nobody can generate against it.
  const site = await getReadableSite(Number(id), user.id);
  if (!site) notFound();

  const reports = await db
    .select()
    .from(aiAnalyses)
    .where(eq(aiAnalyses.siteId, site.id))
    .orderBy(desc(aiAnalyses.createdAt))
    .limit(10);

  const [latest, ...history] = reports;
  const verdict = await checkAnalysisAllowed({ user, site });

  // The stored payload is validated on the way out as well as on the way in. A row written by an
  // older schema should degrade to "cannot render" rather than crashing the page.
  const parsed = latest ? analysisSchema.safeParse(latest.payload) : null;

  return (
    <section className="flex-1 space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-medium lg:text-2xl">Insights</h1>
          <p className="text-sm text-muted-foreground">
            {site.domain} · recommendations from your traffic and your actual
            pages
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href={`/dashboard?site=${site.id}`}>Back to dashboard</Link>
        </Button>
      </div>

      {verdict.allowed ? (
        <GenerateButton siteId={site.id} hasExisting={Boolean(latest)} />
      ) : (
        // Explain which of the reasons applies rather than showing a control that fails.
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm">{verdict.message}</p>
          {verdict.code === 'recent_analysis' && (
            <div className="mt-3">
              <GenerateButton siteId={site.id} hasExisting force />
            </div>
          )}
        </div>
      )}

      {!latest && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">No analysis yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            An analysis reads your traffic for the last 30 days and fetches your
            busiest and quietest pages, then returns prioritised changes — each
            one quoting the figure it rests on.
          </p>
        </div>
      )}

      {latest && parsed?.success && (
        <AnalysisReport
          analysis={parsed.data}
          meta={{
            createdAt: new Date(latest.createdAt),
            model: latest.model,
            costMicros: latest.costMicros
          }}
        />
      )}

      {latest && parsed && !parsed.success && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          This stored report cannot be displayed — it does not match the current
          report format. Generating a new one will replace it.
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
            Earlier reports
          </h2>
          <ul>
            {history.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0"
              >
                <span>
                  {new Date(report.createdAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {report.model} · {report.inputTokens.toLocaleString()} in /{' '}
                  {report.outputTokens.toLocaleString()} out · $
                  {(report.costMicros / 1_000_000).toFixed(4)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
