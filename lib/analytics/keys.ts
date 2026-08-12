import { randomBytes } from 'node:crypto';

/**
 * Site keys and share tokens.
 *
 * Both are 32 characters of lowercase base32 (Crockford-ish, without the ambiguous letters), which
 * fits the varchar(32) columns exactly and survives being copy-pasted, read aloud, or typed from a
 * screenshot without an l/1 or O/0 mix-up.
 *
 * The two have very different threat models despite looking alike:
 *
 *  - A **site key** is public. It ships in the HTML of every tracked page and is meant to be seen.
 *    It identifies a site; it authorises nothing. The origin check in the collector is what stops
 *    a stranger writing events into somebody else's site.
 *  - A **share token** is a bearer credential. Anyone holding it can read that site's dashboard,
 *    so it is generated from the same CSPRNG and must never be derived from the site key, the id,
 *    or anything else guessable.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomId(length = 32): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateSiteKey(): string {
  return randomId(32);
}

export function generateShareToken(): string {
  return randomId(32);
}
