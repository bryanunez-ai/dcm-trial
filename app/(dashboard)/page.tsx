import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Interim marketing page.
 *
 * The starter's version sold the starter — "Build Your SaaS Faster Than Ever", a Stripe
 * integration section, and an animated terminal widget showing its own install commands. All of
 * it is gone, along with terminal.tsx, which this page was the only importer of.
 *
 * The full landing page — features, how it works, FAQ, footer — is the next milestone. What is
 * here now says only what the product actually does.
 */
// Static marketing content with a Suspense-streamed header above it — exactly what PPR is for.
export const experimental_ppr = true;

export default function HomePage() {
  return (
    <main>
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Web analytics without the
              <span className="block text-brand">cookie banner</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground sm:text-xl">
              One line of script, no cookies, and nothing that can identify a
              visitor. Nova answers how many people came, where from and what
              they read — then an AI advisor reads your traffic and your actual
              pages and tells you what to change.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-full text-base">
                <Link href="/sign-up">
                  Start for free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full text-base"
              >
                <Link href="/sign-in">View the demo dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
