/**
 * Warms the dev server's routes before any spec runs.
 *
 * Next compiles a route on its first request, and the dashboard pulls in a charting library, so a
 * cold route can take several seconds to answer. That latency belongs to the dev server, not to
 * the product, and without this it surfaces as an arbitrary early spec timing out while later
 * ones pass — the most misleading kind of flake.
 *
 * Skipped when pointed at a deployed URL, where routes are already built.
 */
const ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/dashboard',
  '/dashboard/sites',
  '/dashboard/sites/new',
  '/nova.js'
];

export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;

  const base = 'http://localhost:3000';

  await Promise.all(
    ROUTES.map((route) =>
      fetch(`${base}${route}`, { redirect: 'manual' }).catch(() => {
        // A route that redirects or refuses is still compiled by the attempt, which is the point.
      })
    )
  );
}
