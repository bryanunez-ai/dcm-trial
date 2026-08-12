import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NovaLogo } from '@/components/nova-logo';
import { getSiteByShareToken } from '@/lib/sites/queries';
import { getLiveVisitors, getSiteMetrics } from '@/lib/analytics/metrics';
import { MetricCards } from '@/components/analytics/metric-cards';
import { TrafficChart } from '@/components/analytics/traffic-chart';
import { TopPages, TopSources } from '@/components/analytics/breakdown';

/**
 * A public, read-only dashboard.
 *
 * Three properties this route must hold:
 *
 *  1. **It must not opt into PPR.** Under blanket PPR a route emits a static shell — and a 200 —
 *     before its dynamic part runs, so a later notFound() cannot change the status code. A
 *     revoked link would answer 200 with a not-found page in the body, which is the opposite of
 *     the guarantee that revoking a share link kills it. PPR is incremental in next.config.ts and
 *     this route deliberately does not opt in.
 *  2. **It must select only aggregate columns.** getSiteByShareToken returns a narrowed type that
 *     has no site key and no owner in it at all, so nothing sensitive can reach the HTML of a page
 *     anyone with the URL can read.
 *  3. **It must not be indexed.** A share link handed to one client should not end up in a search
 *     result.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const site = await getSiteByShareToken(token);

  return {
    title: site ? `${site.name} — traffic` : 'Not found',
    robots: { index: false, follow: false, nocache: true }
  };
}

export default async function SharePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { token } = await params;
  const site = await getSiteByShareToken(token);

  // An unknown token and a revoked one are the same answer, and the same answer a page that never
  // existed would give.
  if (!site) notFound();

  const { days: rawDays } = await searchParams;
  const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;

  const [metrics, live] = await Promise.all([
    getSiteMetrics(site.id, days),
    getLiveVisitors(site.id)
  ]);

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{site.name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {site.domain} · last {days} days
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Read-only view
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-brand-accent opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-accent" />
            </span>
            <strong className="font-semibold tabular-nums">{live}</strong>
            {live === 1 ? 'visitor' : 'visitors'} in the last 5 minutes
          </span>

          <div className="flex gap-1.5">
            {[7, 30, 90].map((w) => (
              <Link
                key={w}
                href={`/share/${token}?days=${w}`}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  w === days
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {w} days
              </Link>
            ))}
          </div>
        </div>

        {site.isSample && (
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Sample data.</strong>{' '}
            Generated from a fixed seed for demonstration.
          </p>
        )}

        <MetricCards
          current={metrics.current}
          previous={metrics.previous}
          days={days}
        />

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Visitors and pageviews</h2>
          {metrics.hasData ? (
            <TrafficChart series={metrics.series} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No traffic recorded in this window yet.
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TopSources rows={metrics.topSources} />
          <TopPages rows={metrics.topPages} />
        </div>

        <p className="text-xs text-muted-foreground">
          Nova does not measure time on page or visit duration — a pageview
          beacon cannot observe when someone leaves, so no such figure is shown.
        </p>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center">
            <NovaLogo markClassName="size-5" />
          </Link>
          <span className="text-xs text-muted-foreground">
            Cookieless analytics
          </span>
        </div>
      </footer>
    </div>
  );
}
