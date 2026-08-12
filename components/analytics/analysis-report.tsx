import { Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Analysis, Recommendation } from '@/lib/ai/schema';

const ASSESSMENT_LABEL: Record<Analysis['overallAssessment'], string> = {
  healthy: 'Healthy',
  needs_attention: 'Needs attention',
  critical: 'Critical'
};

const ASSESSMENT_STYLE: Record<Analysis['overallAssessment'], string> = {
  healthy:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  needs_attention:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  critical:
    'border-destructive/30 bg-destructive/10 text-destructive'
};

const PRIORITY_STYLE: Record<Recommendation['priority'], string> = {
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-border bg-muted text-muted-foreground'
};

const CATEGORY_LABEL: Record<Recommendation['category'], string> = {
  content: 'Content',
  technical_seo: 'Technical SEO',
  acquisition: 'Acquisition',
  engagement: 'Engagement'
};

const PRIORITY_ORDER: Recommendation['priority'][] = ['high', 'medium', 'low'];

export function AnalysisReport({
  analysis,
  meta
}: {
  analysis: Analysis;
  meta: { createdAt: Date; model: string; costMicros: number };
}) {
  const grouped = PRIORITY_ORDER.map((priority) => ({
    priority,
    items: analysis.recommendations.filter((r) => r.priority === priority)
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              ASSESSMENT_STYLE[analysis.overallAssessment]
            )}
          >
            {ASSESSMENT_LABEL[analysis.overallAssessment]}
          </span>
          <span className="text-xs text-muted-foreground">
            {meta.createdAt.toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}{' '}
            · {meta.model} · ${(meta.costMicros / 1_000_000).toFixed(4)}
          </span>
        </div>
        <p className="mt-3 leading-relaxed">{analysis.summary}</p>
      </div>

      {grouped.map((group) => (
        <div key={group.priority} className="space-y-3">
          <h3 className="text-sm font-semibold capitalize text-muted-foreground">
            {group.priority} priority
          </h3>

          {group.items.map((rec) => (
            <article
              key={rec.title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h4 className="text-base font-semibold">{rec.title}</h4>
                <div className="flex shrink-0 gap-1.5">
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {CATEGORY_LABEL[rec.category]}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      PRIORITY_STYLE[rec.priority]
                    )}
                  >
                    {rec.priority}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {rec.finding}
              </p>

              {/*
                Evidence is rendered inline, never behind a toggle. It is the only thing
                separating this from generic SEO advice: a claim the reader cannot check is a
                claim they should not act on, and hiding it one click away means nobody checks.
              */}
              <div className="mt-3 flex gap-2 rounded-lg border-l-2 border-brand bg-muted/50 p-3">
                <Quote className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
                <p className="text-sm">
                  <span className="font-medium">Evidence: </span>
                  {rec.evidence}
                </p>
              </div>

              <p className="mt-3 text-sm leading-relaxed">
                <span className="font-medium">Do this: </span>
                {rec.action}
              </p>

              {rec.affectedPaths.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {rec.affectedPaths.map((path) => (
                    <li
                      key={path}
                      className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs text-accent-foreground"
                    >
                      {path}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      ))}

      {analysis.dataGaps.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">What this could not answer</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions the collected data cannot support. Nova would rather leave
            these open than guess at them.
          </p>
          <ul className="mt-3 space-y-2">
            {analysis.dataGaps.map((gap) => (
              <li key={gap} className="text-sm text-muted-foreground">
                — {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This report is generated by a language model. A strict schema guarantees
        the shape of an answer, never its truth — the evidence above is quoted
        from your own data so you can check every claim against the dashboard.
      </p>
    </div>
  );
}
