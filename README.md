# Nova Analytics

Cookieless web analytics with a one-line install, plus an AI advisor that reads the collected
traffic **and the site's actual pages**, then returns prioritised recommendations where every one
quotes the figure it rests on.

Built from [Vercel's Next.js SaaS Starter](https://github.com/nextjs/saas-starter), whitelabelled
and rebuilt into a different product.

- **Live:** <https://dcm-trial.vercel.app>
- **Demo credentials:** `admin@novaanalytics.io` / `NovaDemo2026!` (also shown on the sign-in page,
  with a button that fills the form)

The deployed app tracks itself, so the dashboard shows real traffic — including your own visit,
arriving within a second or two of loading a page.

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

## Project layout

```
app/(dashboard)/          marketing page, dashboard, sites, install, insights
app/(login)/              sign-in, sign-up, auth actions
app/api/collect/          the collector — public, unauthenticated
app/share/[token]/        public read-only dashboards
lib/analytics/            hashing, normalisation, metrics, bot filtering
lib/ai/                   page fetching, schema, prompt, cost guards
lib/db/                   schema, migrations, seeds
public/nova.js            the tracker, ~2 KB gzipped
e2e/                      the milestone gates
docs/SPEC.md              the specification this was built against
```
