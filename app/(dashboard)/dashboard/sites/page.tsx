import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/db/queries';
import { eventCountsForSites, getOwnedSites } from '@/lib/sites/queries';
import { DeleteSiteButton } from './delete-site-button';

export const dynamic = 'force-dynamic';

const numberFormat = new Intl.NumberFormat('en-US');

export default async function SitesPage() {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  // Only owned sites. The sample site is readable on the Overview but is not listed here,
  // because everything on this screen is an action the account cannot take against it.
  const sites = await getOwnedSites(user.id);
  const counts = await eventCountsForSites(sites.map((s) => s.id));

  return (
    <section className="flex-1 space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg lg:text-2xl font-medium">Your sites</h1>
        <Button asChild size="sm" className="rounded-full">
          <Link href="/dashboard/sites/new">
            <Plus className="size-4" />
            Add site
          </Link>
        </Button>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">No sites yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Register a domain and Nova generates the snippet for it.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link href="/dashboard/sites/new">
              <Plus className="size-4" />
              Add your first site
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sites.map((site) => (
            <li
              key={site.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{site.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {site.domain} ·{' '}
                  {numberFormat.format(counts.get(site.id) ?? 0)} pageviews
                  all time
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={`/dashboard?site=${site.id}`}>
                    <BarChart3 className="size-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={`/dashboard/sites/${site.id}/install`}>
                    <Settings2 className="size-4" />
                    Install
                  </Link>
                </Button>
                <DeleteSiteButton siteId={site.id} domain={site.domain} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
