import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BarChart3,
  Code2,
  EyeOff,
  Gauge,
  Radio,
  Share2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NovaMark } from '@/components/nova-logo';
import { DashboardPreview } from '@/components/marketing/dashboard-preview';
import { Faq } from '@/components/marketing/faq';

export const metadata: Metadata = {
  alternates: { canonical: '/' }
};

// Static marketing content with the Suspense-streamed header above it — exactly what PPR is for.
export const experimental_ppr = true;

const FEATURES = [
  {
    icon: EyeOff,
    title: 'Cookieless by construction',
    body: 'No cookies, no fingerprints, no cross-day tracking. Visitors are a daily hash whose salt is destroyed after 48 hours, so yesterday cannot be linked to today.'
  },
  {
    icon: Code2,
    title: 'One line to install',
    body: 'A single script tag, about 2 KB over the wire. It handles single-page apps, skips localhost, honours Do Not Track, and never throws an error into your page.'
  },
  {
    icon: BarChart3,
    title: 'The numbers you actually check',
    body: 'Visitors, pageviews, views per visitor, bounce rate, top sources and top pages. Compared against the previous period, on one screen, with no report builder.'
  },
  {
    icon: Radio,
    title: 'Live visitor count',
    body: 'How many people are reading right now, updated as they arrive. The most satisfying number in analytics, and the fastest way to know a deploy went out.'
  },
  {
    icon: Share2,
    title: 'Read-only share links',
    body: 'Send a client their dashboard without creating them an account. Aggregates only, never indexed, and revoking the link kills it permanently.'
  },
  {
    icon: Sparkles,
    title: 'An advisor that reads your pages',
    body: 'Prioritised recommendations drawn from your traffic and your real page markup — each one quoting the exact figure it rests on, so you can check it.'
  }
];

const STEPS = [
  {
    step: '01',
    title: 'Add your site',
    body: 'Register a name and a domain. Nova generates a site key and the snippet to go with it.'
  },
  {
    step: '02',
    title: 'Paste one script tag',
    body: 'Drop it in your <head>. Traffic starts appearing within seconds — no verification step, no waiting 24 hours for a first report.'
  },
  {
    step: '03',
    title: 'Read it, then act on it',
    body: 'Watch the live count, share a read-only link with your client, and run the advisor when you want to know what to change.'
  }
];

export default function HomePage() {
  return (
    <>
      <main className="flex-1">
        {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_100%_at_50%_100%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <NovaMark className="size-3.5 text-brand" />
              Privacy-first analytics with an AI advisor
            </span>

            {/*
              The {' '} is load-bearing. A <span className="block"> breaks the line visually, but
              the element's TEXT content is still concatenated — without it this heading reads
              "Web analytics without thecookie banner" to a screen reader and to a search engine,
              while looking perfectly correct on screen. Nova's own AI advisor caught this on the
              deployed site, which is a fair advertisement for the feature.
            */}
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Web analytics without the{' '}
              <span className="block text-brand">cookie banner</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              One line of script. No cookies, and nothing stored that could
              identify a visitor. Nova answers how many people came, where from
              and what they read — then reads your actual pages and tells you
              what to change.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full rounded-full text-base sm:w-auto">
                <Link href="/sign-up">
                  Start for free
                  <ArrowRight className="ml-1 size-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full rounded-full text-base sm:w-auto"
              >
                <Link href="/sign-in">View the demo dashboard</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              No credit card, because there is nothing to pay for.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-4xl lg:mt-16">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Running in about a minute
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              There is no tag manager, no data layer and no property
              configuration. There is a script tag.
            </p>
          </div>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(({ step, title, body }) => (
              <li
                key={step}
                className="hover-lift rounded-2xl border border-border bg-card p-6"
              >
                <span className="text-sm font-semibold tabular-nums text-brand">
                  {step}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
              The whole installation
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm">
              <code className="font-mono text-foreground">
                {'<script defer src="https://your-nova-app/nova.js" data-site="YOUR_SITE_KEY"></script>'}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need, and deliberately nothing else
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Most site owners need three answers — how many came, where from,
              what they read — and then a fourth: what to change.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="hover-lift rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we don't measure */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                What Nova will not tell you
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                A pageview beacon can measure some things and not others. Where
                the data runs out, so do we — an honest gap beats a
                plausible-looking number, and that rule binds the AI advisor
                exactly as tightly as it binds the dashboard.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                If a figure appears anywhere in Nova, something measured it.
              </p>
            </div>

            <ul className="space-y-4">
              {[
                [
                  'Average visit duration',
                  'A pageview beacon cannot see when someone leaves. We removed this rather than approximate it.'
                ],
                [
                  'Individual visitors',
                  'There is no profile to open. Yesterday’s hash and today’s hash for the same person do not match, by design.'
                ],
                [
                  'Search rankings and keywords',
                  'Nova never sees them, so the advisor is forbidden from mentioning them — no impressions, no CTR, no domain authority.'
                ],
                [
                  'Where a visitor is, or what device they used',
                  'Not collected. There is no country column and no user-agent column.'
                ]
              ].map(([title, body]) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <Gauge className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Questions worth asking
          </h2>
          <Faq />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See your traffic in the next five minutes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            Create an account, add a site, paste one tag. Or sign in to the demo
            account and look around first.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full rounded-full text-base sm:w-auto">
              <Link href="/sign-up">
                Create your account
                <ArrowRight className="ml-1 size-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-full text-base sm:w-auto"
            >
              <Link href="/sign-in">Open the demo</Link>
            </Button>
          </div>
        </div>
      </section>

      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <span className="flex items-center gap-2">
              <NovaMark className="size-5 text-brand" />
              <span className="font-semibold tracking-tight">
                Nova Analytics
              </span>
            </span>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Cookieless web analytics with a one-line install, and an advisor
              that shows its evidence.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link
              href="/sign-in"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Create an account
            </Link>
          </nav>
        </div>

        <div className="border-t border-border">
          <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
            © {new Date().getFullYear()} Nova Analytics. Built on Next.js and
            Postgres.
          </p>
        </div>
      </footer>
    </>
  );
}
