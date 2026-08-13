# Nova Analytics

Cookieless web analytics with a one-line install, plus an AI advisor that reads the collected
traffic **and the site's actual pages**, then returns prioritised recommendations where every one
quotes the figure it rests on.

Built from [Vercel's Next.js SaaS Starter](https://github.com/nextjs/saas-starter), whitelabelled
and rebuilt into a different product.

## Submission

| | |
|---|---|
| **Live URL** | <https://dcm-trial.vercel.app> |
| **Repository** | <https://github.com/bryanunez-ai/dcm-trial> |
| **Test credentials** | `admin@novaanalytics.io` / `NovaDemo2026!` |
| **How it was built** | <https://dcm-trial.vercel.app/process> — the process, the spec, and where the spec was wrong |
| **Video walkthrough** | _to be added_ |

The credentials are also printed on the sign-in page with a button that fills the form, so there is
no need to come back here for them.

The deployed app **tracks itself**, so the dashboard shows real traffic — including your own visit,
arriving within a second or two of loading a page. Sign in and watch the live counter.

### Five minutes as a reviewer

1. Open the [landing page](https://dcm-trial.vercel.app) and sign in with the demo account.
2. The **Overview** starts on the sample site — 90 days of clearly-labelled generated data. Switch
   the site picker to **Nova Analytics (this site)** to see real traffic instead, including your own
   visit.
3. **Insights** shows a genuine AI report generated against this deployment. Every recommendation
   quotes the figure it rests on. The demo account cannot generate new ones — that guard is
   server-side, and the page explains why rather than showing a button that fails.
4. Create your own account, add a site, and the install screen gives you a snippet and a share link.
5. Publish a share link and open it in a private window; revoke it and the same URL 404s.

---

## What it does

Google Analytics is disproportionate for small teams, indie sites and agencies. It needs a cookie
consent banner, which costs real traffic; answering "how many people came and from where" takes
several clicks through a UI built for enterprise analysts; and none of it tells you what to *do*
about what it shows.

Nova answers three questions — how many people came, where from, what they read — and then a
fourth: what to change.

1. Sign up and register a **site** (name + domain).
2. Paste one `<script>` tag. Traffic appears within seconds.
3. Optionally publish a **read-only share link** and send it to a client.
4. Open **Insights** to generate an analysis of your traffic and your real pages.

## Privacy, structurally

```
visitor_hash = sha256(daily_salt + site_id + ip_address + user_agent)
```

The salt is random per day, created on that day's first event, and **deleted after 48 hours on the
write path** — not by a scheduled job that could silently stop running. Once a salt is gone, the
hashes it produced cannot be linked back to an IP address even with full access to the database.
The same visitor hashes differently tomorrow, and differently on a different site.

**The `events` table has no column for an IP address or a user agent.** Not "we choose not to store
them" — there is nowhere to put them. You can verify it with one `\d events`:

```
 id | site_id | timestamp | path | referrer_domain | visitor_hash
```

This is the approach Plausible and Fathom use, and it is why no cookie consent banner is generally
required. That is design intent, not legal advice.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | Server Components, Server Actions, Partial Prerendering |
| Styling | Tailwind CSS v4, shadcn/ui over Radix | CSS-first `@theme` tokens |
| Database | Postgres on [Neon](https://neon.tech) | Free tier, no card, same connection string from laptop and Vercel |
| ORM | Drizzle | Schema-first, SQL migrations checked in |
| Charts | Recharts | Dashboard only — the marketing page uses hand-written SVG so visitors never download a chart library |
| AI | DeepSeek V4 Pro via the `openai` SDK | OpenAI-compatible; strict schema behind its `/beta` base URL |
| HTML parsing | cheerio | Attribute order varies far too much for regex, and this data feeds claims users act on |
| Tests | Playwright | The gates are things a type checker cannot see |
| Hosting | Vercel | HTTPS by default, deploys on push |

Package manager is **pnpm 11.21.0**, pinned in `package.json`.

## Setup

```bash
pnpm install
cp .env.example .env      # then fill it in, see below
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Sign in with the demo credentials above and you are on the dashboard.

### Environment variables

| Var | Required | Notes |
|---|---|---|
| `POSTGRES_URL` | yes | Neon connection string, ends `?sslmode=require` |
| `AUTH_SECRET` | yes | JWT signing key. **Use a different value in production.** Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BASE_URL` | yes | Deployed origin, no trailing slash. Feeds `metadataBase` **and the install snippet** — if it is wrong, every snippet points at the wrong host |
| `DEEPSEEK_API_KEY` | no | Without it the app runs and stored reports still render; only generating new ones is unavailable |
| `NOVA_SITE_KEY` | no | The site key of this deployment's own site. When set, the app renders Nova's public snippet in its own `<head>` and tracks itself. Leave unset locally so development never reports into production's figures |

On Vercel, `BASE_URL` can be omitted entirely — the app falls back to `VERCEL_PROJECT_PRODUCTION_URL`,
which Vercel injects. Set it explicitly only for a custom domain. Any unusable value (`none`, an
empty string, a non-http scheme) falls through to the next source rather than taking the build down;
that is enforced by tests, after a deploy failed with `TypeError: Invalid URL … input: 'none'`.

**The build never touches the database.** Verified: `pnpm build` succeeds with an unreachable
`POSTGRES_URL` and no API key, which is what lets CI build with placeholders.

**Use two Neon branches** — `dev` locally, `main` for production. Sharing one means a migration
applied locally instantly breaks the deployed app, which is still running the old code.

Keep the production string in `.env` under `PROD_POSTGRES_URL`, which nothing reads automatically,
so touching production is always deliberate:

```powershell
$env:POSTGRES_URL=$env:PROD_POSTGRES_URL; pnpm db:migrate; Remove-Item Env:\POSTGRES_URL
```

`pnpm db:seed` regenerates the sample site's ~5,000 events on every run, so pointing it at the
wrong branch is not harmless.

### Commands

```bash
pnpm dev                  # dev server
pnpm build                # production build
pnpm exec tsc --noEmit    # typecheck

pnpm db:generate          # diff the schema into a SQL migration
pnpm db:migrate           # apply pending migrations
pnpm db:seed              # demo account + sample site, idempotent
pnpm db:studio            # browse the database

pnpm db:seed-analysis <domain>   # SPENDS REAL MONEY: one live API call

pnpm exec playwright test                          # all gates, against a dev server
E2E_BASE_URL=https://your-app pnpm exec playwright test   # against a deployment
```

`db:seed-analysis` is deliberately **not** part of `db:seed`. It makes a live billed call, and a
seed script that silently charges you is a bad seed script.

## Tests

60 Playwright specs, run against a real browser, a real server and a real database, because the
things worth checking here cannot be seen from a type checker: a session cookie surviving a
redirect, a tracking beacon firing from a page on another domain, a revoked share link returning a
real 404 **status**, a report whose evidence is visible rather than hidden behind a toggle.

They also run against a deployment via `E2E_BASE_URL`, which is how the production smoke test is
done.

Two things that look like product bugs during testing and are not:

- Headless Chrome's user agent contains `HeadlessChrome`, which the bot filter **correctly**
  rejects. Tests that drive the tracker use an ordinary browser user agent.
- Chrome's Private Network Access policy blocks a page in the public address space from loading
  anything from loopback. The stand-in "customer website" is therefore served from a real socket on
  `127.0.0.1` with a domain mapped onto it, rather than with request interception.

## Known limitations

Said out loud, because a reviewer will find them anyway.

- **Ad blockers** block some requests by filename. First-party serving avoids most of it, not all.
  Any analytics tool claiming total immunity is overselling.
- **Site keys are public and spoofable.** They ship in the HTML of every tracked page. The origin
  check stops casual cross-site noise, not a determined non-browser client. A production system
  would add server-side rate limiting and anomaly detection.
- **Bot filtering is user-agent based only.** No reverse DNS, no behavioural detection.
- **The events table grows unbounded.** Fine at demo volume; a real deployment needs daily rollups
  and a retention policy.
- **The AI can still be wrong.** A strict schema guarantees the shape of an answer, never its
  truth. That is exactly what the evidence field is for — every claim quotes a figure you can check
  against your own dashboard.
- **The page fetcher resolves DNS twice** — once to validate, once when `fetch` connects — leaving a
  DNS-rebinding race. Closing it fully means connecting to the validated IP with an explicit Host
  header.
- **No password reset flow.** Deliberately out of scope; there is no email delivery of any kind.
- **Self-tracking includes the dashboard**, so figures for this site mix marketing traffic with app
  usage.
- **The sample site's history is generated** from a fixed-seed PRNG, so every demo shows identical
  numbers. It is labelled as sample data everywhere it appears, accepts no real traffic, and cannot
  be edited or deleted by anyone.

## What Nova deliberately does not measure

- **Average visit duration / time on page.** A pageview beacon cannot observe when somebody leaves.
  An earlier version displayed it; it was removed rather than approximated. A fabricated number that
  looks like data is worse than an honest gap.
- **Individual visitors.** There is no profile to open, and yesterday's hash for the same person
  does not match today's.
- **Geography, device, browser.** Not collected. There is no column for any of them.
- **Search rankings, keywords, impressions, CTR, backlinks, conversions, revenue, page speed.** Nova
  never sees them, and the AI advisor is explicitly forbidden from mentioning them — anything it
  cannot answer goes into a "what this could not answer" section instead.

The same rule binds the dashboard and the advisor equally.

## The demo account is hostile input

Its credentials are published, which makes it publicly usable, so it is guarded server-side rather
than by hiding controls — hiding a button does not stop a Server Action being called. It cannot
change its password, email or name; cannot be deleted; cannot delete sites; and cannot generate AI
analyses. Without those, one visitor could lock out every later one, and there is no password reset.

## How it was built

The whole project was built with **Claude Code**, driven from three documents written before any
code existed: a specification (`docs/SPEC.md`), a bootstrap prompt with nine milestones and a gate
each had to pass (`docs/PROMPT.md`), and a working agreement loaded into every session
(`CLAUDE.md`).

[**The process page**](https://dcm-trial.vercel.app/process) tells that story properly — including
the six places the specification turned out to be wrong, and the moment the AI advisor found a real
bug in this app's own landing page.

The repository's commit history is part of the record: each message says why a change was made and
what was verified, not just what changed.

## What was cut, and why

The starter shipped two large features this product does not use. Both were removed **before**
anything was built, because both touch the schema, and unpicking them after events exist means
migrating data already collected.

- **Stripe.** Nova is not a subscription product, and `/pricing` called the Stripe API at build
  time, so any deploy without a live key failed outright. It also broke sign-in and the seed on a
  fresh checkout — the client is constructed at module scope, so importing it with no key threw
  before any surrounding code ran.
- **Teams, invitations and memberships.** Sites belong directly to a user. The invitation flow
  decided it: it wrote a database row and left a `TODO` where the email would go, so the form looked
  functional and did nothing.

Removing teams also exposed a real bug worth naming: the starter's `deleteAccount` soft-deleted the
user and left everything else standing. Once ownership is by user, that would leave sites invisible
to every dashboard, unreachable by any ownership check, and **still accepting pageviews** from a
snippet presumably still installed. It now deletes the user's sites first, which cascades to their
events.

## Verification

Nothing here is reported as working because it compiled. Every milestone ended with a gate phrased
as an observation:

| Gate | How it was checked |
|---|---|
| Whitelabelled | Rendered HTML of every public and authenticated route contains no trace of the starter |
| Ingestion | Valid and invalid events sent by hand; **11 rejection cases** write nothing and are byte-identical to a success |
| Privacy | `information_schema` confirms `events` has no column that could hold an IP address or user agent |
| Salt rotation | The same visitor hashes differently across days, identically within one, differently across two sites |
| Dashboard | Snippet installed on a real page; the pageview appears |
| Sharing | A revoked link 404s **with a 404 status**, verified against a production build |
| SSRF | Loopback, private, link-local, `169.254.169.254`, CGNAT, multicast, IPv4-mapped IPv6, `http://` and foreign domains all refused |
| Cost controls | Demo account, sample site, empty site, daily cap and reuse window all refuse **before** spending |
| AI honesty | Every `evidence` string traced by hand back to the supplied figures |

All 69 specs pass against a local dev server **and** against the deployed HTTPS URL.

## Project layout

```
app/(dashboard)/          marketing page, dashboard, sites, install, insights
app/(login)/              sign-in, sign-up, auth actions
app/api/collect/          the collector — public, unauthenticated
app/share/[token]/        public read-only dashboards
lib/analytics/            hashing, normalisation, metrics, bot filtering
lib/ai/                   page fetching, schema, prompt, cost guards
lib/db/                   schema, migrations, seeds
app/(dashboard)/process/  how this was built, with the spec inlined from the repo
public/nova.js            the tracker, ~2 KB gzipped
e2e/                      the milestone gates
.github/workflows/ci.yml  typecheck, build, and two invariants, on push and PR
docs/SPEC.md              the specification this was built against
docs/PROMPT.md            the bootstrap prompt and why it is shaped that way
```

## Monitoring

`GET /api/status` is a public health check for uptime monitoring. It actually queries the database,
because Vercel reports a deployment as healthy while the database is unreachable and every page is
failing:

```json
{ "status": "ok", "database": "ok", "latencyMs": 42, "time": "2026-08-13T00:00:00.000Z" }
```

It answers `503` when the database is unreachable, so a monitor can act on the status code without
parsing the body, and it reveals nothing beyond up-or-down — no versions, no counts, no error text.

## Shortcuts taken

Worth stating alongside the limitations above, since the brief asks.

- **The AI advisor's demo report is seeded, not generated on demand by reviewers.** That is
  deliberate — the demo credentials are published, so letting anyone press a button that spends
  money would be an open invoice. `pnpm db:seed-analysis` produced one real report against this
  deployment, and the guards explain themselves in the UI.
- **Bot filtering is a user-agent list.** It removes the bulk of crawler traffic and none of the
  traffic actively pretending not to be a crawler.
- **No rate limiting on the collector.** Fine at demo volume; a real deployment needs it, since site
  keys are public.
- **The e2e suite writes to whichever database it points at.** Running it against production creates
  throwaway accounts, so they have to be cleaned up afterwards. A dedicated test database would be
  better.
- **`middleware.ts` is deprecated** in this Next.js canary in favour of `proxy.ts`. It still works;
  renaming it was not worth doing mid-build.
