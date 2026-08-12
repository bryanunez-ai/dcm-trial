import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { percentChange, type Headline } from '@/lib/analytics/metrics';

const numberFormat = new Intl.NumberFormat('en-US');

function Delta({
  current,
  previous,
  invert = false
}: {
  current: number;
  previous: number;
  /** For bounce rate, down is good. */
  invert?: boolean;
}) {
  const change = percentChange(current, previous);

  if (change === null) {
    // "Up 100%" from zero is an artefact of dividing by zero, not a fact about the site.
    return (
      <span className="text-xs text-muted-foreground">no prior data</span>
    );
  }

  const rounded = Math.round(change * 10) / 10;
  const flat = Math.abs(rounded) < 0.1;
  const good = invert ? rounded < 0 : rounded > 0;
  const Icon = flat ? Minus : rounded > 0 ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        flat
          ? 'text-muted-foreground'
          : good
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-amber-600 dark:text-amber-400'
      )}
    >
      <Icon className="size-3" aria-hidden />
      {flat ? 'no change' : `${Math.abs(rounded)}%`}
    </span>
  );
}

function Card({
  label,
  value,
  hint,
  delta
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {delta}
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

export function MetricCards({
  current,
  previous,
  days
}: {
  current: Headline;
  previous: Headline;
  days: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Visitors"
        value={numberFormat.format(current.visitors)}
        delta={
          <Delta current={current.visitors} previous={previous.visitors} />
        }
        hint={`vs previous ${days} days`}
      />
      <Card
        label="Pageviews"
        value={numberFormat.format(current.pageviews)}
        delta={
          <Delta current={current.pageviews} previous={previous.pageviews} />
        }
      />
      <Card
        label="Views per visitor"
        // Null, not zero: with no visitors there is nothing to divide, and "0.0" would read as a
        // measurement that was never taken.
        value={
          current.viewsPerVisitor === null
            ? '—'
            : current.viewsPerVisitor.toFixed(1)
        }
      />
      <Card
        label="Bounce rate"
        value={
          current.bounceRate === null
            ? '—'
            : `${Math.round(current.bounceRate * 100)}%`
        }
        hint="exactly one pageview"
        delta={
          current.bounceRate !== null && previous.bounceRate !== null ? (
            <Delta
              current={Math.round(current.bounceRate * 100)}
              previous={Math.round(previous.bounceRate * 100)}
              invert
            />
          ) : undefined
        }
      />
    </div>
  );
}
