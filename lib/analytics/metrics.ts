import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

/**
 * Every metric Nova reports, and deliberately no others.
 *
 * What is absent matters as much as what is here. There is no average visit duration and no time
 * on page: a pageview beacon cannot observe when somebody left, so any such number would be
 * invented. There is no geography and no device breakdown, because nothing collected could
 * support them. An honest gap beats a plausible-looking figure.
 *
 * All date arithmetic happens in SQL rather than in JavaScript. The raw postgres driver and the
 * ORM disagree about whether `timestamp without time zone` is local or UTC, so a boundary
 * computed as a JS Date and sent back down can silently shift the window by hours. Days are
 * carried in and out as YYYY-MM-DD strings, which cannot drift.
 */

export type Headline = {
  visitors: number;
  pageviews: number;
  viewsPerVisitor: number | null;
  bounceRate: number | null;
};

export type SeriesPoint = { day: string; visitors: number; pageviews: number };
export type SourceRow = { source: string | null; visitors: number; pageviews: number };
export type PageRow = { path: string; visitors: number; pageviews: number };

export type SiteMetrics = {
  days: number;
  current: Headline;
  previous: Headline;
  series: SeriesPoint[];
  topSources: SourceRow[];
  topPages: PageRow[];
  hasData: boolean;
};

/** Window boundaries as SQL expressions: the `days` days ending today, and the `days` before it. */
function windows(days: number) {
  return {
    currentStart: sql`(current_date - make_interval(days => ${days - 1}))`,
    currentEnd: sql`(current_date + interval '1 day')`,
    previousStart: sql`(current_date - make_interval(days => ${days * 2 - 1}))`,
    previousEnd: sql`(current_date - make_interval(days => ${days - 1}))`
  };
}

async function headline(
  siteId: number,
  start: ReturnType<typeof sql>,
  end: ReturnType<typeof sql>
): Promise<Headline> {
  const rows = (await db.execute(sql`
    with per_visitor as (
      select visitor_hash, count(*)::int as views
      from events
      where site_id = ${siteId}
        and timestamp >= ${start}
        and timestamp < ${end}
      group by visitor_hash
    )
    select
      (select count(*)::int from per_visitor) as visitors,
      (select coalesce(sum(views), 0)::int from per_visitor) as pageviews,
      -- Bounce is defined here as a visitor whose entire window contains exactly one pageview.
      -- Not "left within N seconds", which we cannot see.
      (select count(*)::int from per_visitor where views = 1) as single_view_visitors
  `)) as unknown as Array<{
    visitors: number;
    pageviews: number;
    single_view_visitors: number;
  }>;

  const row = rows[0] ?? { visitors: 0, pageviews: 0, single_view_visitors: 0 };
  const visitors = Number(row.visitors ?? 0);
  const pageviews = Number(row.pageviews ?? 0);
  const singles = Number(row.single_view_visitors ?? 0);

  return {
    visitors,
    pageviews,
    // Null rather than 0 when there is nothing to divide: a rate of "0%" reads as a measurement,
    // and no measurement was taken.
    viewsPerVisitor: visitors > 0 ? pageviews / visitors : null,
    bounceRate: visitors > 0 ? singles / visitors : null
  };
}

export async function getSiteMetrics(
  siteId: number,
  days = 30
): Promise<SiteMetrics> {
  const w = windows(days);

  const [current, previous, series, topSources, topPages] = await Promise.all([
    headline(siteId, w.currentStart, w.currentEnd),
    headline(siteId, w.previousStart, w.previousEnd),

    // Gap-filled: generate_series produces every day in the window, so a day with no traffic
    // renders as a flat zero rather than being skipped and distorting the shape of the line.
    db.execute(sql`
      select
        to_char(d, 'YYYY-MM-DD') as day,
        count(distinct e.visitor_hash)::int as visitors,
        count(e.id)::int as pageviews
      from generate_series(${w.currentStart}, ${w.currentEnd} - interval '1 day', interval '1 day') as d
      left join events e
        on e.site_id = ${siteId}
       and e.timestamp >= d
       and e.timestamp < d + interval '1 day'
      group by d
      order by d
    `) as unknown as Promise<SeriesPoint[]>,

    db.execute(sql`
      select
        referrer_domain as source,
        count(distinct visitor_hash)::int as visitors,
        count(*)::int as pageviews
      from events
      where site_id = ${siteId}
        and timestamp >= ${w.currentStart}
        and timestamp < ${w.currentEnd}
      group by referrer_domain
      order by visitors desc, pageviews desc
      limit 8
    `) as unknown as Promise<SourceRow[]>,

    db.execute(sql`
      select
        path,
        count(distinct visitor_hash)::int as visitors,
        count(*)::int as pageviews
      from events
      where site_id = ${siteId}
        and timestamp >= ${w.currentStart}
        and timestamp < ${w.currentEnd}
      group by path
      order by pageviews desc, visitors desc
      limit 8
    `) as unknown as Promise<PageRow[]>
  ]);

  return {
    days,
    current,
    previous,
    series: series.map((p) => ({
      day: p.day,
      visitors: Number(p.visitors),
      pageviews: Number(p.pageviews)
    })),
    topSources: topSources.map((s) => ({
      source: s.source,
      visitors: Number(s.visitors),
      pageviews: Number(s.pageviews)
    })),
    topPages: topPages.map((p) => ({
      path: p.path,
      visitors: Number(p.visitors),
      pageviews: Number(p.pageviews)
    })),
    hasData: current.pageviews > 0 || previous.pageviews > 0
  };
}

/**
 * Distinct visitors in the last five minutes.
 *
 * Kept separate from the window metrics because it is polled far more often and must stay cheap.
 */
export async function getLiveVisitors(siteId: number): Promise<number> {
  const rows = (await db.execute(sql`
    select count(distinct visitor_hash)::int as live
    from events
    where site_id = ${siteId}
      and timestamp >= now() - interval '5 minutes'
  `)) as unknown as Array<{ live: number }>;

  return Number(rows[0]?.live ?? 0);
}

/**
 * Percentage change between two periods.
 *
 * Returns null when the previous period had nothing — "up 100%" from zero is not a fact about the
 * site, it is an artefact of dividing by zero, and the UI says "no prior data" instead.
 */
export function percentChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
