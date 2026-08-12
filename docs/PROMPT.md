# The bootstrap prompt

Paste the block below into a fresh Claude Code session opened in an empty directory, with `docs/SPEC.md`
alongside it. It is written to be used as-is.

The notes after it explain why it is shaped the way it is — read those if you plan to adapt it.

---

## The prompt

````text
I'm building a product called Nova Analytics, starting from Vercel's Next.js SaaS Starter
(https://github.com/nextjs/saas-starter). The full specification is in docs/SPEC.md — read it completely
before writing any code. It is the source of truth; where this prompt and the spec disagree, the spec wins.

## What we're building

Cookieless web analytics with a one-line install, plus an AI advisor that turns the collected data into
prioritized recommendations. The starter gives us auth, a dashboard shell and a database layer; everything
that makes it Nova we build.

## Before you write anything

Ask me about these five things in your first response. Don't guess — each one changes the architecture:

1. Payments. The starter ships Stripe. Do we keep it, or strip it out?
2. Auth. The starter has bcrypt + JWT sessions. Keep, or replace with a managed service?
3. Database. Which Postgres, and do local and production share one?
4. Sample data. Do we seed generated data so a new account sees a populated dashboard, and if so how do we
   label it?
5. AI provider and model for the advisor, plus who pays for it during the demo.

## How I want you to work

**Verify, don't assume.** After each milestone, check it against the running app and the real database —
HTTP calls to actual routes, real queries against real rows. "It compiles" is not evidence that it works.
When you report something as done, say what you checked.

**Never fabricate a metric.** If the collected data cannot support a number, don't display it. Prefer an
honest gap to a plausible-looking figure. This applies to the dashboard and to the AI advisor equally.

**Cut decorative features.** If a feature looks functional but does nothing — a form that sends nothing, a
button with no effect — remove it rather than ship it. Tell me when you spot one.

**Commit small, and put the reasoning in the message.** I want to read why a change was made, not just what
changed. Include what you verified.

**Ask before directional decisions.** Architecture, scope, anything that would be expensive to reverse.
Don't ask about routine judgment calls — make them and tell me.

**Flag concerns once, then proceed.** If I overrule you, do it my way and move on.

## Milestones

Work in this order. Each ends with the stated gate; don't start the next until it passes.

1. **Run locally.** Install, database, migrations, seed, dev server.
   Gate: sign in with the seeded account and reach the dashboard.

2. **Whitelabel.** Remove the starter's branding completely — logo, favicon, colours, metadata, copy,
   sample data. Also strip whatever we decided to cut in question 1.
   Gate: grep the source and the rendered HTML for the original product's name; zero hits.

3. **Landing page.** Hero, features, how it works, FAQ, CTA, footer. Responsive.
   Gate: renders correctly at 375, 768 and 1280 pixels wide.

4. **Ingestion.** The tracking script, the collection endpoint, the privacy hashing with rotating salts.
   This is the heart of the product — see SPEC.md §4 and §6.
   Gate: send valid and invalid events by hand; only the valid ones are stored, every response is identical,
   and the events table has no column that could hold an IP address.

5. **Sites and dashboard.** Create, list and delete sites; the install screen with the snippet; the
   dashboard reading real events.
   Gate: install the snippet on a real page, load it, watch the pageview arrive.

6. **Sharing and live counter.** Public read-only dashboards, visitors-in-the-last-5-minutes.
   Gate: the share link renders in a private window; an unknown token 404s.

7. **AI advisor.** Page fetching with SSRF guards, the strict output schema, cost controls, the Insights UI.
   See SPEC.md §7 — the provider constraints there are load-bearing.
   Gate: a real analysis against a real site, with every recommendation's evidence traceable to the supplied
   data.

8. **Deploy.** Public HTTPS URL, environment variables, production smoke test.
   Gate: the whole flow works against the deployed URL, not just locally.

9. **Documentation.** README with setup, stack, environment variables, test credentials and honest
   limitations.

## Traps this build actually hit

Not hypothetical — every one of these cost time the first time round.

- **`drizzle-kit generate` prompts interactively** when one diff both drops and adds tables, asking whether a
  table or column was renamed. In a non-interactive session it hangs. Split the change into two migrations —
  one that only drops, one that only creates — so the diff is unambiguous.
- **A migration that changes a column's meaning needs a data step.** Generating the schema diff is not
  enough: write the backfill by hand into the migration, before the drops.
- **`DROP TABLE ... CASCADE` already removes dependent constraints**, so the explicit `DROP CONSTRAINT`
  statements drizzle emits afterwards fail. Add `IF EXISTS`.
- **pnpm 10 and 11 read different keys** for the build-scripts allowlist (`onlyBuiltDependencies` vs
  `allowBuilds`). Declare both, or CI blocks postinstall scripts and fails the install.
- **`useSearchParams` in a client component silently empties a server-rendered form** under Partial
  Prerendering. Read search params in the server page component and pass them as props.
- **DeepSeek V4 rejects a forced `tool_choice`** because it reasons by default. Offer one tool, require it in
  the description, and fail loudly if the model answers with prose.
- **Strict output schemas forbid optional properties** and length keywords. Nothing optional; hand-write the
  JSON Schema rather than generating it.
- **A page fetcher that follows redirects must record where it landed.** Otherwise the advisor describes one
  page using another page's content.
- **Timestamps read through the raw Postgres driver differ from those read through the ORM** — one parses
  `timestamp without time zone` as local, the other as UTC. Test through the path the app actually uses.

## Constraints

- Everything is committed to a public repository.
- The deployed app must stay up and usable by strangers, so anything that spends money needs server-side
  limits.
- Test credentials will be published, so treat that account as hostile input.
````

---

## Why the prompt is shaped this way

**It asks questions before it builds.** The five questions at the top are the ones this build actually
stopped for. Every one of them changed the architecture, and answering them at the start is much cheaper
than discovering them at milestone four.

**It states the working agreement, not just the task.** "Verify, don't assume" and "never fabricate a
metric" did more for the quality of the result than any amount of feature detail. The most valuable
correction in the whole build was a human noticing that a beautiful dashboard was full of invented numbers —
that instruction exists so the next run catches it earlier.

**The gates are the mechanism.** A milestone without a gate is a milestone that gets reported as done
because it compiles. Each gate names a specific, checkable observation, and several of them require going
outside the code — install the snippet on a real page, open the share link in a private window.

**The traps section is the highest-value part.** It is the compressed cost of the first build. Each line is
an hour someone already spent, and none of them are guessable from the documentation.

**It says test credentials are hostile input.** Publishing working credentials is required by the brief and
is genuinely useful, but it makes the demo account an open door. Saying so up front produces server-side
guards instead of hidden buttons.

### What to change if you adapt it

- **The provider constraints are specific to DeepSeek V4** as of this build. Different provider, different
  §7 — verify the current documentation rather than trusting the table.
- **The milestone order assumes ingestion comes before the dashboard.** That is deliberate: building the
  dashboard first is how you end up with invented data. Keep the order even if the product differs.
- **Deploy at milestone 8 is late** if the URL needs to be live sooner. Deploying a half-finished version
  early and iterating on top is a reasonable variation — it guarantees a working link exists.
