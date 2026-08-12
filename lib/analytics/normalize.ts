/**
 * Normalisation shared by the collector, site registration and the AI page fetcher.
 *
 * These are pure functions with no database or request access on purpose: the origin check and
 * the SSRF host check must compare domains the *same* way, and the only reliable way to guarantee
 * that is for both to call the same function.
 */

/**
 * Reduce a hostname or URL to a bare comparable domain: lowercase, no scheme, no port, no
 * trailing dot, no leading `www.`, no path.
 *
 * Returns null when there is nothing usable, so callers must handle the empty case explicitly
 * rather than comparing against a silently-empty string.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;

  let value = input.trim().toLowerCase();
  if (!value) return null;

  // Accept a full URL, a bare host, or a host:port.
  if (value.includes('://')) {
    try {
      value = new URL(value).hostname;
    } catch {
      return null;
    }
  } else {
    // Strip anything after the authority, e.g. example.com/path?x=1
    value = value.split('/')[0];
    // Strip credentials if someone pasted them.
    const at = value.lastIndexOf('@');
    if (at !== -1) value = value.slice(at + 1);
    // Strip the port, but leave bracketed IPv6 literals intact.
    if (!value.startsWith('[')) {
      const colon = value.indexOf(':');
      if (colon !== -1) value = value.slice(0, colon);
    }
  }

  value = value.replace(/\.$/, '');
  if (value.startsWith('www.')) value = value.slice(4);

  if (!value) return null;
  // A domain must contain something other than dots, and fit the column.
  if (value.length > 253) return null;
  if (!/^[a-z0-9.\-_[\]:]+$/.test(value)) return null;

  return value;
}

/**
 * The host of a request's Origin or Referer header, normalised for comparison against a site's
 * registered domain.
 */
export function hostFromHeader(value: string | null | undefined): string | null {
  if (!value) return null;
  // Origin is a serialised origin ("https://example.com"); Referer is a full URL. Both parse.
  return normalizeDomain(value);
}

/**
 * Strip a path down to what is worth reporting: no query string, no fragment.
 *
 * Those are dropped because they carry no reporting value here and are a common accidental source
 * of personal data — session tokens, password reset links and email addresses all routinely end up
 * in query parameters, and the honest way to not store them is to never keep them at all.
 */
export function normalizePath(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;

  let value = input.trim();
  if (!value) return null;

  // Accept a full URL and reduce it to its pathname.
  if (value.includes('://')) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  value = value.split('?')[0].split('#')[0];

  if (!value.startsWith('/')) value = `/${value}`;

  // Collapse a trailing slash so /about and /about/ are one page, but keep the root as "/".
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);

  // Cap at the column width rather than letting the insert fail.
  if (value.length > 255) value = value.slice(0, 255);

  return value;
}

/**
 * Reduce a referrer to a bare domain, dropping self-referrals.
 *
 * Only the domain is kept: the full referring URL can carry the same personal data a query string
 * can, and "where did they come from" is answered by the domain alone.
 */
export function normalizeReferrer(
  referrer: string | null | undefined,
  siteDomain: string
): string | null {
  const domain = normalizeDomain(referrer);
  if (!domain) return null;
  if (domain === siteDomain) return null;
  return domain;
}
