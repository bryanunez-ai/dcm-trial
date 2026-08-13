import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/db/queries';
import { getVisibleSites } from '@/lib/sites/queries';
import { getLiveVisitors, getSiteMetrics } from '@/lib/analytics/metrics';
import { LiveCounter } from '@/components/analytics/live-counter';
import { MetricCards } from '@/components/analytics/metric-cards';
import { TrafficChart } from '@/components/analytics/traffic-chart';
import { TopPages, TopSources } from '@/components/analytics/breakdown';
import { SiteSwitcher } from './site-switcher';

export const dynamic = 'force-dynamic';

const WINDOWS = [7, 30, 90];

/**
 * Search params are read here, in the server component, and passed down as props.
 *
 * Reading them with useSearchParams inside a client component would opt the subtree out of the
 * prerendered shell under PPR, and anything below it would ship as an empty shell until
 * hydration.
 */
export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ site?: string; days?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  const params = await searchParams;
  const sites = await getVisibleSites(user.id);

  if (sites.length === 0) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium mb-6">Overview</h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">No sites yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add a site and paste one script tag into it. Traffic shows up here
            within seconds — there is nothing to display until then, so nothing
            is displayed.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link href="/dashboard/sites/new">
              <Plus className="size-4" />
              Add your first site
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const requestedId = Number(params.site);
  const selected =
    sites.find((s) => s.id === requestedId) ?? sites[0];

  const days = WINDOWS.includes(Number(params.days)) ? Number(params.days) : 30;

  const [metrics, live] = await Promise.all([
    getSiteMetrics(selected.id, days),
    getLiveVisitors(selected.id)
  ]);

  return (
    <section className="flex-1 space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg lg:text-2xl font-medium">Overview</h1>
          <p className="truncate text-sm text-muted-foreground">
            {selected.domain}
            {selected.isSample ? ' · sample data' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SiteSwitcher sites={sites} selectedId={selected.id} days={days} />
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={`/dashboard/sites/${selected.id}/insights`}>
              <Sparkles className="size-4" />
              Insights
            </Link>
          </Button>
          {/* Only for sites this account owns. The install screen requires ownership, so offering
              it for the shared sample and self-tracking sites would be a button that 404s. */}
          {selected.userId === user.id && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`/dashboard/sites/${selected.id}/install`}>
                <Settings2 className="size-4" />
                Install
              </Link>
            </Button>
          )}
        </div>
      </div>

      {selected.isSample && (
        <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Sample data.</strong>{' '}
          This site is generated from a fixed seed so every demo shows the same
          numbers. It accepts no real traffic and cannot be edited or deleted.
        </p>
      )}

      {!selected.isSample && selected.userId === null && (
        <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">
            Nova measuring itself.
          </strong>{' '}
          Real traffic on this deployment, including your visit. It is shared
          with every account and belongs to none, so nobody can edit or delete
          it.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <LiveCounter siteId={selected.id} initial={live} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {WINDOWS.map((w) => (
          <Button
            key={w}
            asChild
            size="sm"
            variant={w === days ? 'secondary' : 'ghost'}
            className="rounded-full"
          >
            <Link href={`/dashboard?site=${selected.id}&days=${w}`}>
              {w} days
            </Link>
          </Button>
        ))}
      </div>

      <MetricCards
        current={metrics.current}
        previous={metrics.previous}
        days={days}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Visitors and pageviews
        </h2>
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
        Nova does not measure time on page or visit duration — a pageview beacon
        cannot observe when someone leaves, so no such figure is shown.
      </p>
    </section>
  );
}
