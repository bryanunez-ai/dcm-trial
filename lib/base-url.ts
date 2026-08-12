/**
 * The origin this deployment is reachable at.
 *
 * Resolved in priority order, because getting it wrong is not cosmetic — this value is baked into
 * the install snippet handed to every customer, so a wrong value means every snippet points at
 * the wrong host and no traffic is ever collected.
 *
 *  1. `BASE_URL`, when set to something usable. Always wins, and is what a custom domain uses.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel injects automatically. This is the project's
 *     stable production domain, so the app knows where it lives without anyone having to deploy
 *     once, read the URL off the dashboard, paste it back in and redeploy.
 *  3. localhost, for development.
 *
 * Deliberately NOT `VERCEL_URL`: that is the per-deployment URL, unique to every build, so a
 * snippet generated from it would break the moment anything else shipped.
 *
 * Every candidate is VALIDATED rather than trusted. An unusable value falls through to the next
 * source instead of propagating. This is not defensive programming for its own sake: a deploy of
 * this project failed with `TypeError: Invalid URL … input: 'none'` because the environment
 * variable had been filled in with the word "none". That single bad string reached
 * `new URL()` in the root layout's `metadataBase`, which failed page-data collection for every
 * route in the app and took the whole build down. A misconfigured env var should degrade to a
 * wrong-but-working default, never to a broken deployment.
 */
function usableOrigin(candidate: string | undefined | null): string | null {
  if (!candidate) return null;

  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  try {
    // Accept a bare host ("example.com") as well as a full origin.
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    // A hostname with no dot is only meaningful for local development. This is what rejects
    // "none", "todo", "changeme" and every other placeholder that would otherwise parse.
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLocal && !url.hostname.includes('.')) return null;

    return url.origin;
  } catch {
    return null;
  }
}

export function getBaseUrl(): string {
  return (
    usableOrigin(process.env.BASE_URL) ??
    usableOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    'http://localhost:3000'
  );
}
