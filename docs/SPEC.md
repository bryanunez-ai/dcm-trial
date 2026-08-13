# Nova Analytics — Full Specification

## Context

This project is a trial test required to become part of a company as part of the recuitment process. Below you'll find the original description of the trial. After that, you'll find the SPEC that was designed from the trial description. The result of this project should meet the requirements of the trial.

---

## Original Trial Description

### Objective

You will take an existing open-source project hosted on GitHub, rebrand it under a different company identity (whitelabel), build a professional landing page with working authentication, and deploy the entire solution to a live, publicly accessible environment.

This assignment must be completed using Claude Code, Anthropic’s command-line tool for agentic coding. Claude Code lets you delegate coding tasks to Claude directly from your terminal. We want to evaluate not just the final product, but how effectively you can leverage AI-assisted development to ship working software.

### The Scenario

A fictional client, Nova Analytics, wants to offer a data-dashboard product to their customers. They have identified an open-source dashboard repository on GitHub that meets most of their functional requirements. Your task is to:
* Fork the repository to your own GitHub account.
* Rebrand the project with Nova Analytics’ identity (logo, color palette, company name).- Create a landing page that introduces the product and includes a functional login/signup flow.
* Deploy the full solution so it is accessible via a public URL.
* Record a short video walkthrough of the finished project.


### Detailed Requirements

#### Repository & Version Control

* Fork a public GitHub repository of your choice (e.g., an open-source dashboard, CMS, or analytics tool).
* All work must be committed to your fork with clear, descriptive commit messages.
* Include a README.md explaining setup steps, the tech stack you chose, and any environment variables required.


#### Whitelabeling

* Replace all original branding: logo, favicon, application name, and footer credits with Nova Analytics branding.
* Apply a cohesive color scheme consistent with the Nova Analytics identity. You may define the brand palette yourself — creativity is encouraged.
* Ensure no references to the original product name remain anywhere in the visible UI.
* Sample data or placeholder content should reflect Nova Analytics (e.g., “Nova Analytics Dashboard,” sample user “admin@novaanalytics.io”).


#### Landing Page

* Build a responsive landing page that serves as the public-facing entry point.
* Include at minimum: a hero section, a features/benefits overview, and a clear call-to-action leading to login or signup.
* The page must be visually polished and mobile-friendly.
* Login and signup forms must be functional. Authentication can use any method you prefer: JWT, session-based, OAuth, or a managed service such as Firebase, Supabase, or Auth0.
* After successful login, redirect the user into the whitelabeled dashboard.


#### Deployment

* The solution must be live and accessible via a public URL at the time of review.
* Acceptable hosting includes (but is not limited to): Vercel, Netlify, Railway, Render, AWS, DigitalOcean, a personal VPS, or any other provider.
* HTTPS must be enabled.
* The deployment should be stable enough to demo without downtime during the review window.


#### Video Walkthrough

* Record a short video (5–10 minutes) walking through your finished project.
* Demonstrate the landing page, the login/signup flow, and the whitelabeled dashboard in action.
* Briefly explain the key technical decisions you made (architecture, auth approach, deployment strategy).
* Upload the video to a shareable platform (YouTube unlisted, Loom, Google Drive, etc.) and include the link in your submission.


#### Submission

When you are finished, please provide the following:

* A link to your forked GitHub repository. Make sure it is public or that you have granted access to the reviewing team.
* The live deployment URL where we can see the landing page and log in.
* A set of test credentials (if applicable) so reviewers can log in and explore the dashboard without creating an account.
* The link to your video walkthrough.
* Any notes on known limitations, shortcuts taken, or things you would improve given more time.
* Please answer and submit a Behavioral Questionnaire.

https://t90131937112.p.clickup-attachments.com/t90131937112/600eeab8-eed0-48ac-8487-32be893357b2/Behavioral%20%26%20Work%20Style%20Questionnaire.pdf


#### Extra Credit

The following are not required, but will earn you additional points in the Bonus / Initiative category:

* Share your development process — include the Claude Code conversation logs, terminal history, or screenshots showing how you iterated on the project with AI assistance.
* Share the prompts you used with Claude Code. We are interested in how you break down problems, give context, and guide the model toward the result you want.
* Set up a CI/CD pipeline (GitHub Actions, etc.) so the project deploys automatically on push.
* Add meaningful tests (unit, integration, or end-to-end).
* Use a custom domain instead of the default hosting subdomain.
* Integrate basic analytics or monitoring (e.g., Plausible, PostHog, or a health-check endpoint).


### Important Notes

This is a practical evaluation, not a trick question. We value working software over perfection. If you run into blockers, document them in your README and explain what you would have done differently with more time.

---

## 1. What it is

**Nova Analytics is cookieless web analytics with a one-line install, plus an AI advisor that reads the
collected data *and the site's actual pages* and returns prioritized, evidence-backed recommendations.**

### The problem

Google Analytics is disproportionate for small teams, indie sites and agencies:

- it requires a **cookie consent banner**, which costs real traffic and adds legal surface;
- **GA4 is hard to read** — answering "how many people came and from where" takes several clicks through a
  reporting UI built for enterprise analysts;
- data is **sampled and delayed**;
- there is **no clean way to show a client their numbers** without granting access to your account;
- and none of it tells you *what to do* about what it shows.

Most site owners need three answers — how many people came, where from, what they read — and then a fourth:
what to change.

### The real-world flow

1. Sign up, create a **site** (name + domain).
2. Copy the generated snippet — one `<script>` tag — and paste it into the site.
3. Traffic appears within seconds; a live counter shows who is on the site right now.
4. Optionally publish a **read-only share link** and send it to a client.
5. Open **Insights** and generate an analysis. The advisor reads the traffic and fetches the site's pages,
   then returns 3–6 prioritized changes, each quoting the figure it rests on.

An agency managing ten client sites registers each one, installs the snippet, sends ten share links, and runs
an advisor pass on each before a monthly review.

### Non-goals

State these up front — a rebuilder will otherwise infer scope that was deliberately cut.

- No goals, conversions or funnels.
- No geographic or device breakdown.
- No session or time-on-page measurement (see §6).
- **No teams, roles or invitations** (see §2).
- **No payments or subscription tiers** (see §2).
- No email delivery of any kind.
- No password reset.

---

## 2. Starting point: the fork, and what to strip

Build from **[Vercel's Next.js SaaS Starter](https://github.com/nextjs/saas-starter)**. It is chosen for what
it already solves — bcrypt auth, JWT sessions, route middleware, Drizzle wiring, a dashboard shell and
activity logging — which leaves the budget for the product itself.

It also ships two large features Nova does not use. **Remove both before building anything**, not after: they
touch the schema, and unpicking them later means migrating data you have already started collecting.

### 2.1 Remove Stripe entirely

The starter ships checkout, a webhook and a customer portal. Three reasons it goes:

1. Nova is not a subscription product.
2. **It blocks deployment.** `/pricing` calls the Stripe API *at build time*, so any build without a valid
   `STRIPE_SECRET_KEY` fails outright.
3. **It blocks sign-in, and the seed, on a fresh checkout** — which happens before any deploy.
   `lib/payments/stripe.ts` constructs `new Stripe(process.env.STRIPE_SECRET_KEY!)` **at module scope**,
   and that throws `Neither apiKey nor config.authenticator provided` on an undefined key. Two modules
   import it transitively:

   - `app/(login)/actions.ts` imports `createCheckoutSession`, so *every Server Action on the sign-in
     page* — including `signIn` itself — throws during module evaluation before its body runs. The form
     submits and nothing happens.
   - `lib/db/seed.ts` imported it to create Stripe products, so `pnpm db:seed` died during import,
     before writing a single row.

   **Consequence for the build order:** the "run locally" milestone cannot reach its own gate on the
   pristine starter. Pull two pieces of this section forward into it — the `stripe` import and the
   `redirect=checkout` branches in `app/(login)/actions.ts`, and the Stripe half of `lib/db/seed.ts`.
   Both are on this milestone's path anyway. The alternative, a placeholder `STRIPE_SECRET_KEY` that
   satisfies the constructor, works but leaves a fake credential in `.env` to be removed later.

Delete:

| Path | What it was |
|---|---|
| `app/(dashboard)/pricing/` | Pricing page — the build-time API call lives here |
| `app/api/stripe/checkout/` | Post-checkout session handler |
| `app/api/stripe/webhook/` | Subscription webhook |
| `lib/payments/` | Stripe client, checkout and customer-portal helpers |
| `lib/db/setup.ts` | Interactive setup script; requires the Stripe CLI and Docker |

Then unpick the references, which are easy to miss:

- The **`ManageSubscription` card** on the dashboard, and its `customerPortalAction` import.
- The **"Pricing" link** in the header — repoint it at `/sign-in`.
- The **`redirect=checkout` branches** in `signIn` and `signUp`, and the `priceId` hidden input and query
  param in the login form.
- **`withTeam()`** in `lib/auth/middleware.ts` — it exists only for the payments actions and becomes dead
  code.
- The **`stripe` dependency**, the `db:setup` script, and `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from
  `.env.example`.
- The `stripe_*` columns on `teams` — which disappear anyway when teams go.

### 2.2 Remove team management

The starter is team-centric: `teams`, `team_members` and `invitations`, with everything scoped through a
team. Nova never used any of it, and the invitation flow **sent no email**, which made the entire surface
decorative — a form that looks functional and does nothing.

Sites belong directly to a user instead. This is both honest about what the product does and materially less
code.

**Where the team UI actually lives.** There is **no `app/(dashboard)/dashboard/team/` directory** in the
starter. The Team Settings screen *is* `app/(dashboard)/dashboard/page.tsx` — the route that becomes Nova's
Overview. It holds the subscription card, the member list and the invite form, and it imports four things
this milestone removes:

```
import { customerPortalAction } from '@/lib/payments/actions';              // §2.1 deletes lib/payments/
import { TeamDataWithMembers, User } from '@/lib/db/schema';                 // type removed below
import { removeTeamMember, inviteTeamMember } from '@/app/(login)/actions';  // actions removed below
```

So that file is **replaced, not deleted**. Leaving it in place fails the build on dead imports; deleting it
outright leaves `/dashboard` 404-ing, and the session middleware redirects there after every sign-in. Replace
it with a minimal authenticated placeholder now, and build the real Overview on top of it once events exist.

Delete: `app/api/team/`, `getTeamForUser`, `getUserWithTeam`, `TeamDataWithMembers`, and the invite /
remove-member Server Actions.

Simplify:

- `signUp` stops creating a team and a membership row.
- The `SWRConfig` fallback in the root layout drops `/api/team`.
- The dashboard sidebar loses its Team entry.
- Ownership checks scope by `userId` instead of `teamId`.
- Remove the now-unreachable `ActivityType` members: `CREATE_TEAM`, `REMOVE_TEAM_MEMBER`,
  `INVITE_TEAM_MEMBER`, `ACCEPT_INVITATION` — and their icon and label mappings on the activity page.

**Fix the bug this exposes.** The starter's `deleteAccount` removes the team membership and soft-deletes the
user, but leaves the user's sites behind. Once ownership is by `userId`, those sites are owned by an account
nobody can sign in as: invisible in every dashboard, unreachable by any ownership check, and still accepting
pageviews from a snippet that is presumably still installed. `deleteAccount` must delete the user's sites
first, which cascades to their events.

### 2.3 One ordering trap

`app/(dashboard)/terminal.tsx` — the starter's animated install-commands widget — is imported and rendered by
its landing page:

```
app/(dashboard)/page.tsx:3   import { Terminal } from './terminal';
app/(dashboard)/page.tsx:38  <Terminal />
```

**Delete it together with the landing page that uses it, not before.** Removing it while that page still
imports it breaks the build, which in turn blocks any gate that needs the app running.

The same rule applies generally: when removing a starter file, grep for its imports first. The two cases that
bite are this one and `dashboard/page.tsx` above.

### 2.4 What to keep

Auth (bcrypt + JWT in an httpOnly cookie), the session middleware, the activity log, the Drizzle setup, the
shadcn/ui component set, and the dashboard layout shell.

---

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | Server Components, Server Actions, Partial Prerendering |
| Styling | Tailwind CSS v4, shadcn/ui over Radix | CSS-first `@theme` tokens |
| Database | Postgres — **Neon** free tier | See §4 |
| ORM | Drizzle | Schema-first, SQL migrations checked in |
| Charts | Recharts | Dashboard only; the marketing page uses hand-written SVG so visitors never download a chart library |
| AI | DeepSeek V4 Pro via the `openai` SDK | OpenAI-compatible API; see §8 |
| HTML parsing | cheerio | On-page signal extraction — attribute order varies too much for regex |
| Hosting | Vercel | HTTPS by default, deploys on push |

Package manager: pnpm. Declare the build-scripts allowlist in `pnpm-workspace.yaml` under **both** keys —
but they are **not the same shape**, and writing them as parallel lists does not work:

| pnpm | Key | Shape |
|---|---|---|
| 11 | `allowBuilds` | a **map** of package → boolean |
| 10 | `onlyBuiltDependencies` | a **list** of package names |

Given `allowBuilds` as a list, pnpm 11 rewrites the file into a map and asks for each entry to be set
`true` or `false`. pnpm 10, which does not know the key, rewrites the same list into a `'0'`/`'1'`/`'2'`
map on every install. Either way the file does not survive an install unmangled until both keys are in
their own correct shape.

On **pnpm 11 a blocked postinstall is a hard install error** — `ERR_PNPM_IGNORED_BUILDS`, exit 1. pnpm 10
only prints a warning and continues, which is worse: the install "succeeds" without the native binding
`@tailwindcss/oxide` needs to compile any CSS at all.

**Pin `packageManager` in `package.json`.** That is the actual fix; the dual-key declaration only papers
over the underlying problem, which is local and CI running different majors. pnpm 11 is currently `latest`
on npm, so CI and Vercel default to 11 even when the lockfile was written by 10.

---

## 4. Database

### 4.1 Neon setup

Neon is a serverless Postgres with a free tier that needs no card. It is the pragmatic choice when Docker is
not available locally, because the same connection string works from a laptop and from Vercel.

1. Create a project at [neon.tech](https://neon.tech). Any region; matching your Vercel region shaves a few
   milliseconds off each query and nothing else at this scale.
2. **Do not enable Neon Auth.** It is a separate managed auth product that syncs users into a `neon_auth`
   schema. Nova has its own `users` table; running both means two user stores and an awkward explanation.
3. Copy the connection string — it ends in `?sslmode=require` — into `POSTGRES_URL`.
4. Connect with the `postgres` driver plus `drizzle-orm/postgres-js`. The client connects lazily, which is
   what allows CI to build with a placeholder URL (see §11).

**Consider two Neon branches**, `main` for production and `dev` for local. Sharing one database between
local and production means a migration applied locally instantly breaks the deployed app, which still runs
the old code. That happens, and it is avoidable.

### 4.2 Migration workflow

```
pnpm db:generate   # diff the schema into a SQL migration
pnpm db:migrate    # apply pending migrations
pnpm db:seed       # demo account, sample site, self-tracking site
pnpm db:studio     # browse
```

Three traps, all encountered for real:

- **`drizzle-kit generate` prompts interactively** when a single diff both drops and adds tables — it asks
  whether a table or column was renamed. In a non-interactive session it hangs forever. **Split the change
  into two migrations**: one that only drops, one that only creates. The diff is then unambiguous.
- **A column whose meaning changes needs a data step.** Generating the diff is not enough. When `sites.teamId`
  became `sites.userId`, the migration had to backfill ownership from team membership *before* the team
  tables were dropped — hand-written into the migration file.
- **`DROP TABLE ... CASCADE` already removes dependent constraints**, so the explicit `DROP CONSTRAINT`
  statements Drizzle emits afterwards fail with "constraint does not exist". Add `IF EXISTS`.

### 4.3 Schema

Six tables. Every column exists for a stated reason.

#### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `serial` PK | |
| `name` | `varchar(100)` | nullable |
| `email` | `varchar(255)` | **unique**, not null |
| `password_hash` | `text` | not null, bcrypt |
| `role` | `varchar(20)` | not null, default `'member'` |
| `created_at` / `updated_at` | `timestamp` | not null, default now |
| `deleted_at` | `timestamp` | nullable — deletion is soft |

On soft delete, suffix the email with `-{id}-deleted` so the address can be reused by a future signup without
violating the unique constraint.

#### `sites`

| Column | Type | Notes |
|---|---|---|
| `id` | `serial` PK | |
| `user_id` | `integer` → `users.id` | **nullable** — see below |
| `name` | `varchar(100)` | not null; shown only to the owner |
| `domain` | `varchar(253)` | not null; normalised (lowercase, no port, no leading `www.`) |
| `site_key` | `varchar(32)` | not null, **unique** — public, ships in the snippet |
| `share_token` | `varchar(32)` | **unique**, nullable — null means sharing is off |
| `is_sample` | `boolean` | not null, default false |
| `created_at` | `timestamp` | not null, default now |

Index: `(user_id)`.

- **`user_id` is nullable on purpose.** The seeded sample site has no owner, which makes it readable by every
  signed-in account — so a reviewer's fresh signup is not greeted by an empty dashboard — while guaranteeing
  no ownership check can ever match it, so nobody can edit or delete it. One nullable column replaces a
  permissions system.
- **`site_key` is public by design.** It ships in the HTML of every tracked page. What protects a site is the
  origin check in the collector, not the secrecy of this value.
- **`share_token` is cleared, not flagged, when sharing is disabled**, so a leaked URL dies permanently and
  re-enabling mints a new one.

#### `events`

| Column | Type | Notes |
|---|---|---|
| `id` | `serial` PK | |
| `site_id` | `integer` → `sites.id` **on delete cascade** | not null |
| `timestamp` | `timestamp` | not null, default now |
| `path` | `varchar(255)` | not null; query string and fragment stripped |
| `referrer_domain` | `varchar(253)` | nullable — null means direct or stripped |
| `visitor_hash` | `varchar(64)` | not null; sha256 hex |

Indexes: `(site_id, timestamp)` and `(site_id, visitor_hash)` — every dashboard query filters on both.

**There is no column for an IP address or a user agent.** Not "we choose not to store them" — there is
nowhere to put them. The privacy design is structural rather than procedural, and that is the point. A
reviewer can verify it with one `\d events`.

#### `visitor_salts`

| Column | Type | Notes |
|---|---|---|
| `day` | `date` PK | one row per day |
| `salt` | `varchar(64)` | not null, random hex |

See §5. Rows older than two days are deleted **on the write path**, not by a scheduled job.

#### `activity_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | `serial` PK | |
| `user_id` | `integer` → `users.id` | nullable |
| `action` | `text` | not null; an `ActivityType` value |
| `timestamp` | `timestamp` | not null, default now |
| `ip_address` | `varchar(45)` | nullable |

`ActivityType`: `SIGN_UP`, `SIGN_IN`, `SIGN_OUT`, `UPDATE_PASSWORD`, `UPDATE_ACCOUNT`, `DELETE_ACCOUNT`,
`CREATE_SITE`, `DELETE_SITE`, `ENABLE_SHARING`, `DISABLE_SHARING`.

#### `ai_analyses`

| Column | Type | Notes |
|---|---|---|
| `id` | `serial` PK | |
| `site_id` | `integer` → `sites.id` **on delete cascade** | not null |
| `user_id` | `integer` → `users.id` | nullable — who paid for it |
| `created_at` | `timestamp` | not null, default now |
| `model` | `varchar(64)` | as reported by the provider |
| `input_tokens` / `output_tokens` | `integer` | not null, from the response's usage |
| `cost_micros` | `integer` | not null; millionths of a dollar, so cost stays an exact integer |
| `payload` | `jsonb` | not null; the validated analysis object |

Indexes: `(site_id, created_at)` and `(user_id, created_at)` — the first drives "latest report", the second
drives the daily cap.

**Only successful analyses are stored.** Recording failures would make every read filter by a status that
nothing displays.

### 4.4 Seeding

`pnpm db:seed` is idempotent and creates:

1. The **demo account** (`admin@novaanalytics.io`), whose credentials are published so reviewers can sign in
   without registering. The starter seeds `test@test.com` / `admin123` plus a team and a membership row —
   replace all of it.

   Put the email and password in **one module** (`lib/demo-credentials.ts`) imported by both the seed and the
   sign-in page. They are published, so they are not a secret; what matters is that the two cannot drift
   apart and start disagreeing about the password a reviewer was told to use.

   Make this step idempotent for the user, or a second `db:seed` fails on the unique email constraint.
2. The **sample site** — `user_id` null, `is_sample` true — with ~90 days of generated events from a
   **fixed-seed PRNG**, so local, production, screenshots and the walkthrough video all show identical
   numbers. Regenerate on each run so the window always ends today.

   **Identical within a UTC day, not across one.** These two requirements are in tension: a window that
   always ends *today* cannot also produce the same totals *every* day, because a different set of days
   falls on a weekend and the generator makes weekends quieter. Observed for real — the same seed
   produced 5,097 events locally and 5,001 in production forty minutes later, because the UTC date
   rolled over in between. Nothing is wrong when that happens. If a demo and a screenshot must match
   exactly, take them on the same UTC day, or pin the window's end date instead of using "today".
3. The **self-tracking site**, registered against the deployed domain, so the live dashboard shows real
   traffic including the reviewer's own visit.

   **Unowned, exactly like the sample site** — `user_id` null. It was originally owned by the demo
   account and protected by a rule saying "the demo account cannot delete sites", and that rule turned
   out to be too broad in practice: it also blocked a visitor deleting a site *they* had added, leaving
   it stuck in the dashboard behind a button that always refused. Making the site unowned protects it
   structurally instead — every account can read it, no ownership check can ever match it — and removes
   the special case entirely. Prefer structure over a condition wherever a permission can be expressed
   as one.

`pnpm db:seed-analysis` is **deliberately separate** — see §8.9.

---

## 5. Privacy design

The core engineering decision, and the thing most worth getting right.

```
visitor_hash = sha256(daily_salt + site_id + ip_address + user_agent)
```

- The salt is **random per day**, created lazily on the first event of that day.
- It is **deleted after 48 hours**, on the **write path** — not in a scheduled job that could silently stop
  running.
- Once a salt is gone, the hashes it produced **cannot be linked back to an IP address**, even with full
  database access.
- The same visitor gets a **different hash tomorrow**, so behaviour cannot be correlated across days.

This is the approach used by Plausible and Fathom. The practical consequence is that **no cookie consent
banner is required** under the common reading of GDPR/ePrivacy. State that as design intent, not legal
advice.

**Salt creation must tolerate concurrency.** Two simultaneous first-events of the day must end up with the
same salt, or one visitor hashes two different ways. Insert with `ON CONFLICT DO NOTHING`, then re-read.

---

## 6. Metrics

Only what the collected data supports.

| Metric | Derivation |
|---|---|
| Visitors | `count(distinct visitor_hash)` |
| Pageviews | `count(*)` |
| Views per visitor | pageviews ÷ visitors |
| Bounce rate | share of visitors whose window contains **exactly one** pageview |
| Live now | distinct visitor hashes in the last 5 minutes |
| Top sources | `referrer_domain`, grouped; null renders as "Direct / none" |
| Top pages | `path`, grouped by pageviews |

**Average visit duration is deliberately absent.** An earlier version displayed it. Pageview beacons cannot
measure it, so it was removed rather than approximated — a fabricated number that looks like data is worse
than an honest gap. A rebuild that adds it back has misunderstood the product.

Windows are "the N days ending today" (default 30), compared against the immediately preceding N days for
deltas. Fill gaps in the daily series so charts show flat days rather than skipping them.

---

## 7. Ingestion

### 7.1 The tracker (`/nova.js`, served from `public/`)

**Size, measured rather than assumed:** 4.8 KB raw, **2.0 KB gzipped**, comments included. It is served
unminified because the comments explain non-obvious constraints to anyone who inspects it, and 2 KB over
the wire is already below the point where minifying would change a decision. Quote the gzipped figure in
marketing copy — the raw number is not what a visitor downloads, and the 1.5 KB this spec previously
claimed was never measured.

Reads `data-site` from its own `<script>` tag. Posts `{siteKey, path, referrer}`.

- Uses `navigator.sendBeacon` with a **`text/plain` blob**, which qualifies as a CORS *simple request* — the
  browser never issues a preflight. Falls back to `fetch(keepalive)`.
- Handles SPA navigation by patching `history.pushState` / `replaceState` and listening for `popstate`, with
  a guard against duplicate fires for the same path.
- Skips `localhost` and `file:`, honours `navigator.doNotTrack`, and defers while `visibilityState` is
  `prerender`.
- Never throws into the host page.
- The endpoint defaults to `/api/collect` resolved against the script's own `src`, so one snippet works from
  any host.

### 7.2 The collector (`POST /api/collect`)

Public and unauthenticated. The session middleware matcher **must exclude `/api`** so this is reachable
without a cookie. Runs on the Node runtime (it needs `node:crypto`).

Validation order matters:

1. Reject bodies over ~2 KB, or empty.
2. Parse JSON; reject malformed.
3. Reject known bot user agents.
4. Look up the site by `site_key`; reject unknown.
5. **Reject the sample site** — its history is generated and must not be polluted with real traffic.
6. **Origin check**: the `Origin` or `Referer` host must equal the site's registered domain, normalised.
7. Resolve the day's salt; compute the visitor hash.
8. Normalise the path: strip query string and fragment — they carry no reporting value here and are a common
   accidental source of personal data (tokens, emails in redirect params). Cap at the column width.
9. Reduce the referrer to a bare domain; drop self-referrals to null.
10. Insert.

**Every response is an identical empty `202`**, whatever happened. A tracker that answers differently for a
valid key, an invalid key and a rejected origin is an oracle for enumerating customers. Failures are
swallowed on purpose: losing a pageview is preferable to breaking the page it fired from.

---

## 8. The AI advisor

The product's differentiator, and the part with the most ways to get it subtly wrong.

### 8.1 Purpose

Analytics reports what happened. The advisor answers *what to do about it*, without the failure mode SEO
advice is prone to: asserting numbers nobody measured.

### 8.2 Inputs

Two, both real:

1. **Traffic** for the selected site over 30 days — headline metrics with period-over-period deltas, the
   daily series, the referrer breakdown, and top pages.
2. **The pages themselves.** Fetch the **busiest 5** and **quietest 3**, always including `/`, deduplicated.

The busiest matter because a flaw there costs the most traffic; the quietest matter because an explanation
for the silence often lives in the page itself.

Crossing the two is the point. *"`/pricing` takes 18% of your traffic and has no meta description"* cannot be
produced by traffic data alone, nor by an on-page checker that does not know which pages matter.

### 8.3 On-page signals extracted

Per page: `title`, `metaDescription`, `canonical`, `robots`, `ogTitle`, `ogDescription`, `ogImage` (present
or not), `h1s[]`, `h2Count`, `wordCount` (after stripping `script`/`style`/`noscript`/`svg`), `imageCount`,
`imagesMissingAlt`, `internalLinks`, `externalLinks`, and `redirectedTo`.

Use a real HTML parser (cheerio). Attribute order varies too much for regex to be reliable, and this data
feeds claims the user will act on.

### 8.4 Fetching is the security surface

The URL is built from a domain **the user typed**. Without checks, "my site" could be the cloud metadata
endpoint and its response would be handed to a model and rendered back. Constrain every request:

| Guard | Rule |
|---|---|
| Scheme | HTTPS only |
| Host | must equal the site's registered domain, normalised |
| Address | resolve the hostname; reject if **any** answer is loopback, private, link-local (incl. `169.254.169.254`), CGNAT, unique-local or multicast |
| Redirects | max 2, **re-validated at every hop** |
| Timeout | 5s |
| Body | 1 MB cap, read through a capped reader |
| Content type | `text/html` only |

**Record the redirect destination.** A page that redirects was not read — its signals belong to somewhere
else. Omitting this caused the advisor to describe authenticated routes using the sign-in page's title and
make confident recommendations about pages it never saw. The prompt must state plainly that a redirected
page's signals describe the destination.

**A page that fails to fetch is reported to the model as unavailable, not silently dropped**, so it can say
"I could not read this" instead of reasoning from a partial picture.

Residual risk to document rather than hide: DNS is resolved once for validation and again by `fetch`, so a
hostile resolver could answer differently the second time. Closing it fully means connecting to the validated
IP with an explicit Host header.

### 8.5 Output contract

A strict-schema tool call. Two representations — a Zod schema for validating the response, a JSON Schema for
the request — kept adjacent and **hand-written** (see §8.6).

| Field | Type | Meaning |
|---|---|---|
| `summary` | string | Two or three sentences on where the site stands |
| `overallAssessment` | enum | `healthy` \| `needs_attention` \| `critical` |
| `recommendations[]` | array | Ordered most important first; 3–6 entries |
| ↳ `title` | string | A short imperative |
| ↳ `category` | enum | `content` \| `technical_seo` \| `acquisition` \| `engagement` |
| ↳ `priority` | enum | `high` \| `medium` \| `low` |
| ↳ `finding` | string | What the data shows |
| ↳ **`evidence`** | string | **The exact figure or page signal it rests on** |
| ↳ `action` | string | The concrete change to make |
| ↳ `affectedPaths[]` | string[] | Empty array when site-wide — never absent |
| `dataGaps[]` | string[] | Questions the collected data cannot answer |

**`evidence` is the honesty mechanism**, and it must be rendered inline in the UI rather than behind a
toggle. It is the only thing separating this from generic SEO advice, and a claim the reader cannot check is
a claim they should not act on.

### 8.6 Provider constraints (DeepSeek V4)

Verified against its documentation *and* its actual behaviour. Two of these are not guessable.

| Fact | Value |
|---|---|
| Models | `deepseek-v4-pro`, `deepseek-v4-flash` |
| Pricing (Pro) | $0.435 / 1M input (cache miss), $0.87 / 1M output |
| SDK | OpenAI-compatible — the `openai` npm package with a `baseURL` |
| Standard base URL | `https://api.deepseek.com` |
| **Strict schema** | requires `baseURL: https://api.deepseek.com/beta` **and** `strict: true` on the function |
| **Schema rules** | every property in `required`; `additionalProperties: false`; **no** `minLength`/`maxLength`/`minItems`/`maxItems` |
| **Forced `tool_choice`** | **rejected** — *"Thinking mode does not support this tool_choice"* |
| Streaming + strict tools | undocumented |

Four consequences:

1. **Nothing in the schema can be optional.** Model absent values as empty arrays or explicit enum members —
   never a missing key.
2. **Hand-write the JSON Schema.** Generators emit the forbidden keywords by default, and the rejection only
   surfaces at request time.
3. **Do not force the tool call.** V4 reasons by default and rejects a forced `tool_choice`, so the choice is
   between reasoning and a guaranteed call. Reasoning over the data *is* the feature: offer exactly one tool,
   state in its description that it must be called, and fail loudly if the model answers with prose instead.
4. **Do not stream.** Report the real stages instead — the server genuinely fetches pages, then calls the
   model. An honest progress label beats a simulated typewriter over an undocumented code path.

**Measured, not estimated.** A real run against a six-page site: **3,126 input / 6,984 output tokens,
$0.0074** — still under a cent, but output is roughly 2.5× the figure this spec previously guessed,
because the model reasons before calling the tool and that reasoning is billed as output. Budget on the
output side: it is both the larger count and the dearer rate. Model reported back as `deepseek-v4-pro`.

Everything in §8.6 above held in practice: the `/beta` base URL with `strict: true` was accepted, the
hand-written schema passed, and the model called the single offered tool without `tool_choice` being
forced.

### 8.7 System prompt rules

The prompt's main job is preventing invented numbers. It must:

- Enumerate **what the model can see**: pageview and visitor counts, referrer domains, per-page totals, both
  windows, and the on-page signals.
- Enumerate **what it cannot** and must never claim: search rankings, keyword volumes, impressions, CTR,
  backlinks, domain authority, competitors, conversions, revenue, page speed, Core Web Vitals, and any page
  not in the supplied list.
- Require every `evidence` value to quote a figure present in the payload.
- Forbid estimating or interpolating a number.
- Define bounce rate as **exactly one pageview**, and state that time on page is not measured at all.
- Instruct that unreadable and redirected pages must not be described.
- Prefer 3–6 grounded recommendations over a padded list.
- Route anything unanswerable into `dataGaps`.

### 8.8 Cost controls

Non-negotiable when the demo credentials are public — an unguarded button that calls a paid API is an open
invoice. **All of it server-side**: hiding a button does not stop the action being called.

| Control | Value | Why |
|---|---|---|
| Demo account | cannot generate | credentials are published |
| Sample site | cannot be analysed | domain does not resolve; a run would spend money to produce nothing |
| Daily cap | 3 per account, counted from stored rows | a separate counter can drift from what was spent |
| Reuse window | 24 hours per site unless forced | a double-click costs once |
| Empty site | refused before any spend | nothing to analyse |
| Missing API key | degrades gracefully | stored reports still render; only generation is unavailable |

### 8.9 Seeding a demo report

`pnpm db:seed-analysis` generates **one real analysis** for the self-tracking site and stores it.

Keep it **out of `pnpm db:seed`**: it spends real money on a real API call, and a seed script that silently
bills you is a bad seed script. Its output is what the shared demo account shows on the Insights page, so
reviewers read a genuine report — of real traffic, on real pages — without being able to spend anything.

### 8.10 UI

`/dashboard/sites/[id]/insights`:

- Generate button with **staged progress** (fetching → analyzing → prioritizing).
- The stored report: summary, assessment badge, recommendations grouped by priority with the evidence block
  inline, and a "what this could not answer" section.
- History of previous reports with dates, model and cost.
- When generation is unavailable, **explain which of the five reasons applies** rather than showing a control
  that fails.
- A visible note that the report is model-generated and the evidence is there to be checked.

---

## 9. Auth and routing

Email + password, bcrypt hashed. Session is a signed HS256 JWT in an **httpOnly, secure, sameSite=lax**
cookie. Middleware guards `/dashboard/*` and rolls the token forward 24h on GET.

**Do not read search params with `useSearchParams` in a client component that renders a form.** Under PPR
that opts the whole subtree out of the prerendered shell, and the form ships as an empty shell that only
appears after hydration. Read them in the server page component and pass them down as props.

**Enable PPR incrementally, not globally.** With blanket PPR every route emits a static shell — and a 200 —
before its dynamic part runs, so a later `notFound()` cannot change the status. `/share/[token]` returned 200
with the not-found page in the body for revoked tokens, which is the opposite of the guarantee that disabling
a link kills it. Use `ppr: 'incremental'` and opt in per route with `export const experimental_ppr = true`.

| Route | Access |
|---|---|
| `/` | public — marketing |
| `/sign-in`, `/sign-up` | public |
| `/dashboard` | session; Overview with site switcher |
| `/dashboard/sites`, `/sites/new` | session |
| `/dashboard/sites/[id]/install` | session; snippet + share toggle |
| `/dashboard/sites/[id]/insights` | session; AI advisor |
| `/dashboard/general`, `/activity`, `/security` | session |
| `/share/[token]` | **public, read-only**, `noindex`, dynamic |
| `/api/collect` | public, unauthenticated |
| `/api/sites/[id]/live`, `/status` | session |
| `/nova.js` | public static |

The public share page must select **only aggregate columns**, so site keys and account data cannot leak into
it. An unknown or disabled token returns 404 — identical to a page that never existed.

Site APIs return **404, not 401**, for a site the caller cannot see. A 401 confirms the id exists.

### 9.1 Two markup traps in the starter's shell

- **The starter's route-group layout wraps children in `<section>`.** `<footer>` nested inside sectioning
  content does **not** expose the `contentinfo` landmark, so the page footer stops being announced as the
  page footer. That wrapper carries no heading and is a layout shell — make it a `<div>`. The same rule
  applies to `<main>`: the footer must be a sibling of it, not a child.
- **Do not gate content on a scroll-driven animation.** A `.reveal` class using
  `animation-timeline: view()` with an `opacity: 0` starting state left whole sections — a feature grid,
  an install snippet — rendering as blank space. Every assertion still passed, because the elements were
  present and nothing overflowed; only a screenshot showed it. If an entrance animation is used at all,
  the un-animated state must be the **visible** one, so that any failure to run degrades to plain content
  rather than to an empty page. The same reasoning is why `prefers-reduced-motion` must resolve to
  visible.

---

## 10. Demo account hardening

**Publish the credentials at the point of use.** `/sign-in` renders a panel showing the demo email and
password with a button that fills the form in one click. Handing reviewers working credentials is a
requirement; putting them on the screen where they are typed removes a round trip to the README.

That makes the account publicly usable — treat it as hostile input. It needs server-side guards:

- Cannot change its password, email or name; cannot be deleted.
- Cannot generate AI analyses.
- The self-tracking site cannot be deleted by anyone — enforced by giving it no owner rather than by a
  rule about who may delete. **It may still add and delete its own sites**, and must be able to: a
  visitor who registers a site needs to be able to remove it again.

Without these, one visitor can lock out every later one — and there is no password reset.

---

## 11. Environment

| Var | Required | Notes |
|---|---|---|
| `POSTGRES_URL` | yes | Neon connection string, `?sslmode=require` |
| `AUTH_SECRET` | yes | JWT signing key; **a different value in production** |
| `BASE_URL` | yes | Deployed origin; feeds `metadataBase` and the install snippet |
| `DEEPSEEK_API_KEY` | no | Without it the app runs and stored reports render; only generation is unavailable |

**The build must not touch the database.** Every page that reads data is dynamic or streams behind Suspense,
and the Postgres client connects lazily — which is what lets CI build with placeholder credentials and no
secrets.

---

## 12. Verification checklist

Prove each piece; don't assume it.

1. **Build and typecheck** clean; CI gates both on push and PR.
2. **Collector:** send valid and invalid events — wrong origin, unknown key, bot user agent. All return an
   identical `202`; only the valid one is stored. Confirm the path lost its query string and the referrer was
   reduced to a domain.
3. **Privacy, structurally:** inspect `events` — there must be no IP or user-agent column.
4. **Salt rotation:** the same visitor hashes differently on consecutive days; salts older than two days are
   gone.
5. **SSRF:** attempt fetches against `localhost`, `127.0.0.1`, a private IP, `169.254.169.254`, an `http://`
   URL and another domain. All refused.
6. **Isolation:** with two accounts and one site each, account A gets a **404** for B's site id.
7. **Share link:** renders without a session; unknown token 404s **with a 404 status**, not a 200; no site key
   in the HTML.
8. **AI cost controls:** four generations (fourth refused), one as the demo account (refused), two within 24h
   (second reuses). Check the stored rows carry sensible token counts and cost.
9. **Evidence discipline:** generate a report and check every `evidence` string against the real figures. An
   invented number is a prompt bug, not a model quirk.
10. **Teams and Stripe removed** — greps prove absence, which is not the same as working. Both halves:
    - *Absence:* grep for `teamId`, `invitations`, `stripe` — no hits outside migration history;
      `/api/team` and `/pricing` 404; no `teams` / `team_members` / `invitations` table remains and
      `activity_logs` has no `team_id` column.
    - *Still works:* the removal edits `signUp`, `signOut`, `updatePassword`, `updateAccount` and
      `deleteAccount`, so exercise them over real HTTP — sign up a fresh account and reach `/dashboard`,
      sign out, sign back in. And run `pnpm build` **with no Stripe key in the environment**, which is the
      specific failure the removal exists to prevent.
11. **Responsive** at 375 / 768 / 1280.
12. Repeat the walkthrough against the **deployed HTTPS URL**. Several defects in this build appeared only in
    production.

### 12.1 Testing the tracker in a browser

Two obstacles, both of which look like product bugs and are not:

- **Headless Chrome's user agent contains `HeadlessChrome`**, which the bot filter correctly rejects. A
  test that drives the tracker must run in a context with an ordinary browser user agent, or it is
  testing the bot filter instead.
- **Chrome's Private Network Access policy blocks a page in the public address space from loading a
  resource from `loopback`** — the error is *"the request client is not a secure context and the resource
  is in more-private address space `loopback`"*. Playwright's `route.fulfill` triggers this even for
  same-origin subresources, because a synthesised document is not classified as having come from
  loopback. Serve the stand-in customer page from a **real socket on 127.0.0.1** and map a test domain
  onto it with `--host-resolver-rules=MAP your-domain 127.0.0.1`. Do **not** reach for
  `--disable-web-security`: it would also switch off the CORS behaviour the beacon depends on, so the
  test would stop proving the thing it exists to prove.

### 12.2 How to verify, learned the hard way

- **Use a browser, not curl, for anything behind a Server Action.** Sign-in and sign-up are Server Actions,
  and driving one by hand needs a `Next-Action` header carrying a 42-character action id read out of the
  build's `server-reference-manifest.json` — and even with the correct id, a hand-built multipart body is
  rejected by the RSC reply decoder. That tests the wire format, not the product. Drive the real form.
  curl remains the right tool for `/api/collect`, which is a plain route handler.
- **Look at the page, don't only assert on it.** The blank-sections bug above passed every assertion that
  had been written. Screenshots at each breakpoint are part of the gate, not a nicety.
- **Assert the page does not scroll sideways**, rather than that no element is wider than the viewport.
  Wide content *should* scroll inside its own `overflow-x` container — an install snippet, a table — so
  the check must exempt elements whose ancestor scrolls or clips them, or it fails on correct layouts.
- **Clear `.next` before trusting a type error.** Deleting a route leaves stale generated types behind in
  `.next/types/**`, which `tsconfig.json` includes, so `tsc` reports missing modules for files that were
  removed on purpose.
- **An exhaustive `Record<Enum, T>` breaks in both directions.** `iconMap` on the activity page is typed
  that way, so editing `ActivityType` is a type error both for members removed and members added.
- **Pin `turbopack.root`.** Turbopack infers the workspace root from the nearest lockfile and will happily
  select the home directory if a stray `package-lock.json` sits there, making the entire user profile the
  resolution and file-watching root.

---

## 13. Known limitations

Say these out loud; a reviewer will find them anyway.

- **Ad blockers** may block the tracker by filename. First-party serving avoids most of it, not all.
- **Site keys are public and spoofable.** The origin check stops casual cross-site noise, not a determined
  non-browser client. Production systems add server-side rate limiting and anomaly detection.
- **Bot filtering is user-agent based only** — no reverse DNS, no behavioural detection.
- **The events table grows unbounded.** Fine at demo volume; a real deployment needs daily rollups and a
  retention policy.
- **The AI can still be wrong.** A strict schema guarantees the shape of an answer, never its truth. That is
  what the evidence field is for.
- **The page fetcher resolves DNS twice**, leaving a rebinding race.
- **No password reset flow.**
- **Self-tracking includes the dashboard**, so "this site" figures mix marketing traffic with app usage.
- **The sample site's history is generated** from a fixed-seed PRNG, so demos show identical numbers.
