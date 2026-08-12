/**
 * An illustration of the dashboard, drawn by hand in SVG.
 *
 * Two reasons it is not a real chart component: the marketing page should not make every visitor
 * download Recharts, and this is a picture of the product rather than a reading of anyone's data.
 *
 * The numbers below are fixed and fictional, and the illustration says so on its face — it is
 * labelled as an example. Showing invented figures as though they were measured is the failure
 * mode this whole product is built against, and a marketing page is not exempt.
 */

const SERIES = [
  18, 24, 21, 30, 27, 35, 41, 38, 46, 44, 52, 49, 58, 63, 57, 66, 72, 68, 78,
  74, 83, 88, 81, 92, 97, 90, 101, 108, 104, 112
];

const W = 720;
const H = 220;
const PAD = 8;

function buildPath() {
  const max = Math.max(...SERIES);
  const min = 0;
  const stepX = (W - PAD * 2) / (SERIES.length - 1);

  const points = SERIES.map((value, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((value - min) / (max - min)) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const area = `${line} L${(W - PAD).toFixed(1)},${H} L${PAD},${H} Z`;

  return { line, area };
}

export function DashboardPreview() {
  const { line, area } = buildPath();

  return (
    <figure className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-brand-accent opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-accent" />
          </span>
          <span className="text-sm font-medium">12 visitors right now</span>
        </div>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          ['Visitors', '4,182'],
          ['Pageviews', '9,507'],
          ['Views / visitor', '2.3'],
          ['Bounce rate', '48%']
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-2 pb-2 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Example traffic chart showing visitors trending upward over thirty days"
        >
          <defs>
            <linearGradient id="nova-area" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--brand)"
                stopOpacity="0.28"
              />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={area} fill="url(#nova-area)" />
          <path
            d={line}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <figcaption className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">
        Example dashboard. These figures are illustrative, not measured.
      </figcaption>
    </figure>
  );
}
