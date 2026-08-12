# Nova Analytics

Cookieless web analytics with a one-line install, plus an AI advisor that reads the collected
traffic *and the site's actual pages*, then returns prioritized, evidence-backed recommendations.

Built from Vercel's Next.js SaaS Starter. Next.js 15 (App Router) · React 19 · TypeScript ·
Postgres on Neon with Drizzle · Tailwind v4 · deployed on Vercel.

## Documents

Read these on demand. Do **not** `@import` them here — imports load eagerly, and everything in
this file is already loaded into every session.

| File | Read it when |
|---|---|
| `docs/SPEC.md` | The specification. Read the relevant section before touching the schema, ingestion, visitor hashing, or the AI advisor. |
| `docs/PROMPT.md` | Build order and the gate each milestone must pass. Read when continuing the build. |

## Commands

```bash
pnpm install
pnpm dev
pnpm build                # must pass before any deploy
pnpm exec tsc --noEmit

pnpm db:generate          # diff schema into a migration
pnpm db:migrate
pnpm db:seed              # demo account, sample site, self-tracking site — idempotent
pnpm db:studio
pnpm db:seed-analysis     # SPENDS REAL MONEY: one live API call. Never in db:seed.
```

The starter ships `db:setup`. Delete it — it requires the Stripe CLI and Docker, and Stripe is
being removed anyway.

## Product rules — these are not style preferences

- **Never display a metric the data cannot support.** No average visit duration: pageview beacons
  cannot measure it. An honest gap beats a plausible-looking number. Applies to the dashboard and
  to the AI advisor equally.
- **Anything that spends money needs a server-side guard.** The demo credentials are published on
  the sign-in page, so treat that account as hostile input. Hiding a button does not stop the
  Server Action being called.
- **Cut decorative features.** A form that sends nothing, a button with no effect — remove it
  rather than ship it, and say when you spot one. Two features were cut this way already.
- **The collector answers an identical empty `202` to everything.** Distinguishable responses turn
  it into an oracle for enumerating customers.
- **`events` has no column for an IP address or a user agent.** Not "we choose not to store them" —
  there is nowhere to put them. Keep it that way.

## Traps that already cost time here

- **Never gate content on a scroll-driven animation.** A `.reveal` using `animation-timeline: view()`
  with `opacity: 0` left whole sections rendering as blank space — and every assertion still
  passed. The un-animated state must be the visible one. Screenshots are part of a UI gate.
- **`<footer>` inside `<section>` is not `contentinfo`.** The starter's route-group layout wrapped
  children in `<section>`; it must be a `<div>` or the page footer stops being a landmark.
- **curl cannot drive a Server Action** — it needs a `Next-Action` id from the build manifest and
  still fails on a hand-built multipart body. Use the browser for sign-in/sign-up; curl is right
  for `/api/collect`.
- **Clear `.next` before believing a `tsc` error** about a module you deliberately deleted; stale
  generated route types linger and `tsconfig` includes them.
- **A module-scope client constructor breaks importers before their code runs.**
  `lib/payments/stripe.ts` built the Stripe client at module scope, so an undefined key threw during
  *import* — taking out `signIn` (via `app/(login)/actions.ts`) and `pnpm db:seed` on a fresh
  checkout. Symptom: the form submits and nothing happens. Removed, but the shape recurs: construct
  third-party clients lazily inside the function that uses them.

- **`drizzle-kit generate` hangs** when one diff both drops and adds tables — it asks interactively
  whether something was renamed. Split into two migrations: one that only drops, one that only
  creates.
- **A column whose meaning changes needs a hand-written backfill** inside the migration, before the
  drops. Generating the diff is not enough.
- **`DROP TABLE ... CASCADE`** already removes dependent constraints, so Drizzle's follow-up
  `DROP CONSTRAINT` fails. Add `IF EXISTS`.
- **pnpm 10 and 11 read different build-allowlist keys, in different shapes.** pnpm 11's
  `allowBuilds` is a **map** of package → boolean; pnpm 10's `onlyBuiltDependencies` is a **list**.
  Written as parallel lists, neither survives an install unmangled. `packageManager` is pinned in
  `package.json`, which is the real fix. On pnpm 11 an ignored build script is a hard error.
- **`useSearchParams` in a client component that renders a form** silently ships an empty shell
  under PPR. Read search params in the server page and pass them as props.
- **Global PPR breaks `notFound()` status codes** — the static shell sends a 200 first. Use
  `ppr: 'incremental'` and opt in per route.
- **DeepSeek V4 rejects a forced `tool_choice`** because it reasons by default, and strict schemas
  forbid optional properties and length keywords. Hand-write the JSON Schema.
- **A page fetcher that follows redirects must record where it landed**, or the advisor describes
  one page using another page's content.
- **Timestamps differ between the raw Postgres driver and the ORM** — one parses `timestamp` as
  local, the other as UTC. Test through the path the app actually uses.
- **Local and production sharing one Neon database** means a local migration instantly breaks the
  deployed app. Use two branches.

## How to work

- **Verify against the running app and the real database**, not against the fact that it compiles.
  When reporting something done, say what you checked.
- **Commit small, with the reasoning in the message** — why, not just what, plus what was verified.
- **Ask before directional decisions**; make routine judgment calls and mention them.
- **Flag a concern once, then proceed** if overruled.
- Verify in production too. Several defects in this build appeared only after deploying.
