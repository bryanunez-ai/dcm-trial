import type { PageRow, SourceRow } from '@/lib/analytics/metrics';

const numberFormat = new Intl.NumberFormat('en-US');

function Table({
  title,
  columnLabel,
  rows,
  empty
}: {
  title: string;
  columnLabel: string;
  rows: Array<{ label: string; visitors: number; pageviews: number }>;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">Visitors</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.label}
              className="relative flex items-center justify-between gap-4 border-b border-border/60 px-4 py-2.5 last:border-b-0"
            >
              {/* A proportional bar behind the label, so the shape of the distribution is
                  readable without reading every number. */}
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 rounded bg-accent"
                style={{ width: `${(row.visitors / max) * 97}%` }}
              />
              <span className="relative truncate text-sm" title={row.label}>
                {row.label}
              </span>
              <span className="relative shrink-0 text-sm tabular-nums">
                {numberFormat.format(row.visitors)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {numberFormat.format(row.pageviews)} {columnLabel}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TopSources({ rows }: { rows: SourceRow[] }) {
  return (
    <Table
      title="Top sources"
      columnLabel="views"
      empty="No traffic in this period."
      rows={rows.map((r) => ({
        // A null referrer is not "unknown" — it means the visitor arrived without one, by typing
        // the address, using a bookmark, or following a link that stripped it.
        label: r.source ?? 'Direct / none',
        visitors: r.visitors,
        pageviews: r.pageviews
      }))}
    />
  );
}

export function TopPages({ rows }: { rows: PageRow[] }) {
  return (
    <Table
      title="Top pages"
      columnLabel="views"
      empty="No pageviews in this period."
      rows={rows.map((r) => ({
        label: r.path,
        visitors: r.visitors,
        pageviews: r.pageviews
      }))}
    />
  );
}
