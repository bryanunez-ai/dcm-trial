import { ChevronDown } from 'lucide-react';

/**
 * Native <details>/<summary> rather than a JS accordion: it is keyboard accessible and
 * screen-reader correct for free, it works before hydration, and it costs no client JS on a page
 * whose entire point is being light.
 */
const FAQS = [
  {
    q: 'Do I really not need a cookie consent banner?',
    a: 'Nova sets no cookies and stores nothing that identifies a visitor. Each visitor becomes a one-way hash of a daily rotating salt, and that salt is deleted after 48 hours — after which the hash cannot be linked back to anyone, even with full access to the database. This is the same approach Plausible and Fathom take, and it is why a consent banner is generally not required. That is our design intent, not legal advice: your regulator and your lawyer get the final word.'
  },
  {
    q: 'What does Nova store about my visitors?',
    a: 'A timestamp, the path, the referring domain, and the daily visitor hash. That is the whole row. There is no column in the database that could hold an IP address or a user agent — not a policy we could quietly change, but a structural fact you can verify in the schema.'
  },
  {
    q: 'Why is there no average visit duration?',
    a: 'Because a pageview beacon cannot measure it. Working it out would mean guessing at when someone left, and a plausible-looking number is worse than an honest gap. The same rule applies to the AI advisor: every recommendation quotes the figure it rests on, so you can check it.'
  },
  {
    q: 'What does the AI advisor actually read?',
    a: 'Two things, both real: your traffic for the last 30 days, and your actual pages — it fetches the five busiest and three quietest and reads their titles, meta descriptions, headings, word counts and image alt text. Crossing the two is the point. "This page takes 18% of your traffic and has no meta description" is not something traffic data or a page checker could tell you alone.'
  },
  {
    q: 'Will ad blockers stop it?',
    a: 'Some will. The script is served first-party from your own domain, which avoids most blocklists, but not all of them. Any analytics tool that claims total immunity is overselling.'
  },
  {
    q: 'Can I show a client their numbers without giving them an account?',
    a: 'Yes. Publish a read-only share link for a site and send it. It renders the dashboard with no sign-in, exposes only aggregate figures, and is never indexed. Revoking it destroys the token permanently, so the old URL stops working for good rather than being merely hidden.'
  }
];

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
      {FAQS.map(({ q, a }) => (
        <details key={q} className="group px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium [&::-webkit-details-marker]:hidden">
            {q}
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
            />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {a}
          </p>
        </details>
      ))}
    </div>
  );
}
