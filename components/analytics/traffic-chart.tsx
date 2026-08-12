'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { SeriesPoint } from '@/lib/analytics/metrics';

/**
 * The daily series. Recharts lives here and nowhere near the marketing page — a visitor reading
 * the landing page should not download a charting library to look at a picture.
 *
 * The series arrives gap-filled from SQL, so days with no traffic are flat zeros rather than
 * missing points, and the line's shape tells the truth about quiet days.
 */
export function TrafficChart({ series }: { series: SeriesPoint[] }) {
  const formatDay = (day: string) => {
    // The day is a plain YYYY-MM-DD string, parsed as UTC to match how it was grouped.
    const d = new Date(`${day}T00:00:00Z`);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="nova-visitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            labelFormatter={(label) =>
              typeof label === 'string' ? formatDay(label) : ''
            }
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              color: 'var(--popover-foreground)'
            }}
          />
          <Area
            type="monotone"
            dataKey="visitors"
            name="Visitors"
            stroke="var(--brand)"
            strokeWidth={2}
            fill="url(#nova-visitors)"
            // No entrance animation. Recharts reveals an area by expanding a clip rect, so for
            // the first ~1.5s the chart is partly or entirely blank — and any re-render, such as
            // a resize, restarts it. On a dashboard someone opens repeatedly, that reads as
            // "the chart is broken" rather than as polish, and it briefly hides the data the
            // page exists to show.
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="pageviews"
            name="Pageviews"
            stroke="var(--brand-accent)"
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="4 3"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
