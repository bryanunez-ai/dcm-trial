'use client';

import { useRouter } from 'next/navigation';
import type { Site } from '@/lib/db/schema';

/**
 * A plain <select>. It is one control with one job, it is keyboard and screen-reader correct with
 * no work, and on a phone it opens the native picker — which is better than anything a custom
 * dropdown would give here.
 *
 * The selected id arrives as a prop from the server page rather than being read from the query
 * string in this component, which is what keeps the surrounding page in the prerendered shell.
 */
export function SiteSwitcher({
  sites,
  selectedId,
  days
}: {
  sites: Site[];
  selectedId: number;
  days: number;
}) {
  const router = useRouter();

  if (sites.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Site</span>
      <select
        value={selectedId}
        onChange={(e) =>
          router.push(`/dashboard?site=${e.target.value}&days=${days}`)
        }
        className="h-8 rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
            {site.isSample ? ' (sample)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
