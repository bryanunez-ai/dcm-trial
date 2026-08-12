'use client';

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('unavailable');
  return res.json() as Promise<{ live: number }>;
};

/**
 * Visitors in the last five minutes, refreshed while the tab is open.
 *
 * The initial value is rendered on the server and handed in as fallbackData, so the number is
 * correct on first paint rather than flashing a zero or a spinner — the count is the first thing
 * anyone looks at.
 *
 * If the request fails, the last good number stays on screen rather than being replaced by an
 * error: a momentarily stale count is closer to the truth than no count, and this is not a figure
 * anyone acts on irreversibly.
 */
export function LiveCounter({
  siteId,
  initial
}: {
  siteId: number;
  initial: number;
}) {
  const { data } = useSWR(`/api/sites/${siteId}/live`, fetcher, {
    fallbackData: { live: initial },
    refreshInterval: 15_000,
    keepPreviousData: true,
    revalidateOnFocus: true
  });

  const live = data?.live ?? initial;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-brand-accent opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-brand-accent" />
      </span>
      <strong className="font-semibold tabular-nums">{live}</strong>
      <span className="text-muted-foreground">
        {live === 1 ? 'visitor' : 'visitors'} in the last 5 minutes
      </span>
    </span>
  );
}
