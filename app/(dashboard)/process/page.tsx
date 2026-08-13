import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NovaMark } from '@/components/nova-logo';

export const metadata: Metadata = {
  title: 'How this was built',
  description:
    'The process behind Nova Analytics: planning before prompting, a specification the build was held to, milestone gates, and the places the specification turned out to be wrong.',
  alternates: { canonical: '/process' }
};

/**
 * Static content behind a header that reads the session, which is exactly what PPR is for.
 * Without opting in, the whole page — including two inlined documents — would be re-rendered per
 * request just because the header needs to know whether anyone is signed in.
 */
export const experimental_ppr = true;

/**
 * The specification and the bootstrap prompt are read from the repository at build time and
 * inlined, rather than being retyped into this page.
 *
 * Two documents that disagree are worse than one, and a page claiming to show "the spec" while
 * showing a stale copy of it would be exactly the kind of plausible-looking falsehood this
 * project is built to avoid. Reading the real files means they cannot drift.
 */
function readDoc(name: string): string {
  try {
    return readFileSync(join(process.cwd(), 'docs', name), 'utf8');
  } catch {
    return `${name} could not be read at build time.`;
  }
}

const SPEC = readDoc('SPEC.md');
const PROMPT = readDoc('PROMPT.md');

function Section({
  id,
  eyebrow,
  title,
  children
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-12 sm:py-16">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Doc({ name, body }: { name: string; body: string }) {
  const lines = body.split('\n').length;
  const kb = Math.round(Buffer.byteLength(body, 'utf8') / 1024);

  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <FileText className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="font-medium text-foreground">{name}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {lines} lines · {kb} KB · click to read
        </span>
      </summary>
      {/* Wrapped rather than scrolled sideways: this is prose, and a document you have to drag
          horizontally to read is a document nobody reads. */}
      <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words border-t border-border px-5 py-4 text-xs leading-relaxed">
        <code className="font-mono">{body}</code>
      </pre>
    </details>
  );
}

export default function ProcessPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <header className="py-14 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <NovaMark className="size-3.5 text-brand" />
            Behind the build
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            How this was built
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Nova Analytics was built with Claude Code, from a specification
            written before any code existed. This page is about the process —
            how the work was planned, how it was checked, and the places the
            plan turned out to be wrong — rather than about the stack.
          </p>
        </header>

        <Section eyebrow="Step 0" title="Three documents before a single prompt">
          <p>
            The project did not start in an editor. It started in a planning
            conversation with Claude, used to turn a vague idea into decisions:
            what the product is, what it deliberately is not, and what the
            architecture has to look like as a result. That conversation
            produced three files, and those three files did most of the work
            later.
          </p>
          <ul className="space-y-3">
            <li>
              <strong className="text-foreground">CLAUDE.md</strong> — the
              working agreement. Loaded into every session automatically:
              product rules, commands, and a running list of traps that had
              already cost time.
            </li>
            <li>
              <strong className="text-foreground">SPEC.md</strong> — the
              specification, and the source of truth. Schema, privacy design,
              the exact metrics allowed, the AI provider&rsquo;s constraints,
              and a verification checklist.
            </li>
            <li>
              <strong className="text-foreground">PROMPT.md</strong> — the
              bootstrap prompt: what to build, in what order, with a gate each
              milestone had to pass before the next began.
            </li>
          </ul>

          <figure className="!mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <Image
              src="/process/0-md-files.png"
              alt="Three markdown files open side by side in VS Code: CLAUDE.md, SPEC.md and PROMPT.md"
              width={1919}
              height={1079}
              className="w-full"
            />
            <figcaption className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              The three documents the build was driven from.
            </figcaption>
          </figure>

          <p>
            The brief asked for a whitelabelled dashboard with sample data. That
            felt like the wrong target. A dashboard full of invented numbers
            proves the CSS works and nothing else, so the goal became a product
            that measures something real: a tracking script, a collector, a
            privacy design worth defending, and an AI advisor that reads the
            traffic it collected alongside the site&rsquo;s actual pages.
          </p>
        </Section>

        <Section eyebrow="Step 1" title="Plan mode first, then build">
          <p>
            The bootstrap prompt went into Claude Code in{' '}
            <strong className="text-foreground">plan mode</strong> — so the
            first output was a plan, not code. That turned out to matter more
            than expected: the plan came back having checked the specification
            against the actual repository, and it caught places where the spec
            described a repository that did not exist.
          </p>

          <figure className="!mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <Image
              src="/process/2-plan-after-spec.png"
              alt="Claude Code in plan mode, showing the generated build plan next to the bootstrap prompt"
              width={1919}
              height={1079}
              className="w-full"
            />
            <figcaption className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              The plan produced from the spec, before any code was written.
            </figcaption>
          </figure>

          <p>
            The prompt also demanded five answers before any code:{' '}
            <em>payments, auth, database, sample data, and which AI provider
            pays for the demo.</em> Each one changes the architecture, and each
            one is far cheaper to answer at the start than to discover at
            milestone four.
          </p>
        </Section>

        <Section eyebrow="Step 2" title="A milestone, a gate, a check-in">
          <p>
            After that the loop was simple. Nine milestones, each ending in a
            gate that had to be demonstrated rather than asserted — and the gates
            were deliberately things a type checker cannot see:
          </p>
          <ul className="space-y-2">
            <li>
              — grep the rendered HTML for the original product&rsquo;s name;
              zero hits
            </li>
            <li>— send valid and invalid events by hand; only valid ones stored</li>
            <li>— install the snippet on a real page and watch the pageview arrive</li>
            <li>— open the share link in a private window; a revoked one must 404</li>
            <li>
              — generate a real analysis and trace every recommendation&rsquo;s
              evidence back to the supplied data
            </li>
          </ul>
          <p>
            Each milestone ended with a report of what was checked, and only
            then did the next one start. The working rule throughout was
            &ldquo;verify, don&rsquo;t assume&rdquo;: it compiles is not
            evidence that it works. That produced 68 browser-driven tests
            against a real server and a real database, and it is why several
            defects were found before a reviewer could find them.
          </p>
        </Section>

        <Section eyebrow="Step 3" title="Decisions worth explaining">
          <p>
            <strong className="text-foreground">
              Neon rather than Supabase.
            </strong>{' '}
            The starter already ships bcrypt password hashing and JWT sessions,
            so a managed auth provider would have meant deleting working code to
            replace it with a vendor, plus a second user store to reconcile with
            the tables sites and activity logs already reference by foreign key.
            Neon supplies Postgres and nothing else, which is exactly what was
            missing. Two branches — one for local, one for production — so a
            migration applied on a laptop cannot break the deployed app.
          </p>
          <p>
            <strong className="text-foreground">Stripe and teams removed.</strong>{' '}
            Both were cut before anything was built, because both touch the
            schema and unpicking them after events exist means migrating data
            already collected. The invitation flow settled the argument: it
            wrote a row and left a TODO where the email would go, so the form
            looked functional and did nothing.
          </p>
          <p>
            <strong className="text-foreground">
              Nothing that cannot be measured is displayed.
            </strong>{' '}
            There is no average visit duration anywhere in Nova, because a
            pageview beacon cannot see when somebody leaves. The same rule binds
            the AI advisor, which is forbidden from mentioning rankings,
            keywords, conversions or page speed, and routes anything it cannot
            answer into a &ldquo;what this could not answer&rdquo; section.
          </p>
        </Section>

        <Section eyebrow="What actually happened" title="The specification was wrong six times">
          <p>
            The most useful thing about writing the spec first was finding out
            where it was wrong. Every correction below came from the code
            disagreeing with the document, and in every case the code was right.
            The spec was updated rather than worked around.
          </p>
          <ul className="space-y-3">
            <li>
              <strong className="text-foreground">
                The pnpm allowlist keys are different shapes.
              </strong>{' '}
              The spec said declare both as lists. In reality pnpm 11&rsquo;s{' '}
              <code>allowBuilds</code> is a map of package to boolean, and each
              version silently rewrites the other&rsquo;s format on every
              install.
            </li>
            <li>
              <strong className="text-foreground">
                Stripe broke sign-in, not just the deploy.
              </strong>{' '}
              The spec said the payments code blocks deployment. It also blocked
              sign-in and the database seed on a fresh checkout, because the
              Stripe client is constructed at module scope — so importing it
              with no key threw before any of the surrounding code ran. The
              symptom was silent: the form submitted and nothing happened.
            </li>
            <li>
              <strong className="text-foreground">The tracker is 2 KB, not 1.5 KB.</strong>{' '}
              Measured rather than assumed, and the marketing copy was corrected
              to match. A number nobody measured is exactly what this product
              exists to refuse.
            </li>
            <li>
              <strong className="text-foreground">
                An analysis costs 2.5× more output than estimated.
              </strong>{' '}
              The spec guessed ~2.8K output tokens; a real run used ~7K, because
              the model reasons before answering and that reasoning is billed as
              output. Still under a cent.
            </li>
            <li>
              <strong className="text-foreground">
                &ldquo;Identical numbers everywhere&rdquo; is only true within a
                day.
              </strong>{' '}
              The sample site uses a fixed random seed, but its window always
              ends today — so a different set of days lands on a weekend and the
              totals shift. Caught when the same seed produced 5,097 events
              locally and 5,001 in production forty minutes later, either side of
              midnight UTC.
            </li>
            <li>
              <strong className="text-foreground">
                Two browser behaviours that look like bugs and are not.
              </strong>{' '}
              Headless Chrome is rejected by the bot filter, correctly, because
              its user agent says so. And Chrome refuses to let a public page
              load anything from localhost, which broke the tracking tests until
              the stand-in customer site was served from a real socket.
            </li>
          </ul>
        </Section>

        <Section eyebrow="The payoff" title="The advisor found a bug in its own landing page">
          <p>
            Once deployed, Nova was pointed at itself. The first real analysis
            returned six recommendations, and one of them was this:
          </p>
          <blockquote className="rounded-lg border-l-2 border-brand bg-muted/50 p-4 text-sm">
            <p className="font-medium text-foreground">
              Evidence: h1s contains &ldquo;Web analytics without thecookie
              banner&rdquo;.
            </p>
          </blockquote>
          <p>
            The homepage headline splits across two elements so the second half
            starts on its own line. It looks perfect. But the heading&rsquo;s
            text content had no space in it, so screen readers and search
            engines read &ldquo;thecookie&rdquo;. Every existing test passed,
            because they checked the heading was <em>visible</em>, not what it{' '}
            <em>said</em>.
          </p>
          <p>
            It also flagged two pages with no top-level heading, three pages
            sharing one meta description, and no social preview tags. All four
            were real, all four are fixed, and the regression test now asserts on
            the text rather than the pixels. Two of its six recommendations were
            deliberately not acted on — the site genuinely had one visitor
            because it had just launched, and the dashboard pages{' '}
            <em>&ldquo;could not be assessed because they redirect to
            sign-in&rdquo;</em>, which is the advisor correctly refusing to
            describe pages it never read.
          </p>
        </Section>

        <Section eyebrow="Reflection" title="What AI-assisted development actually needed">
          <p>
            Working this way can be difficult, and the difficulty is rarely the
            code. When a project is planned properly — architecture, scope and
            technical detail decided up front — the model&rsquo;s speed becomes
            usable rather than merely impressive. Without that, it produces a
            great deal of plausible work in the wrong direction.
          </p>
          <p>
            A solid plan is also cheaper. Fewer tokens are spent rediscovering
            decisions, re-reading files and undoing work, which means the same
            usage limits go considerably further. The specification paid for
            itself several times over, and the moments it was wrong were
            themselves worth the exercise, because they were found early and
            written down.
          </p>
          <p>
            The other thing that mattered was insisting on evidence. Gates
            phrased as observations — install the snippet, open a private
            window, check the status code — catch things that &ldquo;it
            compiles&rdquo; never will. Looking at screenshots caught a
            decorative animation that was hiding entire sections of a page while
            every assertion passed.
          </p>
          <p>
            <strong className="text-foreground">With more time</strong>, this
            would become a complete SaaS: a payment gateway, scheduled reports,
            automatic email summaries, per-referrer page breakdowns, daily
            rollups so the events table stops growing forever, and server-side
            rate limiting on the collector.
          </p>
        </Section>

        <Section id="documents" eyebrow="Read them" title="The documents this was built from">
          <p>
            Both are inlined from the repository at build time, so what is shown
            here is what the build actually used — not a copy that has quietly
            drifted out of date.
          </p>
          <div className="!mt-6 space-y-3">
            <Doc name="docs/SPEC.md — the specification" body={SPEC} />
            <Doc name="docs/PROMPT.md — the bootstrap prompt" body={PROMPT} />
          </div>
          <p className="!mt-6">
            There is also a{' '}
            <a
              href="https://drive.google.com/file/d/1jGXqnu45-D3zWDAjfW7_EMoTy-FG4EI0/view?usp=sharing"
              className="text-brand underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              video walkthrough
            </a>
            , and the full history — including every commit message explaining
            why a change was made and what was verified — is on{' '}
            <a
              href="https://github.com/bryanunez-ai/dcm-trial"
              className="text-brand underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </Section>

        <section className="border-t border-border py-12 text-center sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            See the product itself
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            The deployed app tracks its own traffic, so the dashboard shows real
            numbers — including your visit.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
              <Link href="/sign-in">
                Open the demo
                <ArrowRight className="ml-1 size-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-full sm:w-auto"
            >
              <Link href="/">Back to the homepage</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <NovaMark className="size-5 text-brand" />
            <span className="ml-2 font-semibold tracking-tight">
              Nova Analytics
            </span>
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Nova Analytics. Built on Next.js and
            Postgres.
          </p>
        </div>
      </footer>
    </>
  );
}
