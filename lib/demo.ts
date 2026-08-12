/**
 * The demo account.
 *
 * These credentials are published on the sign-in page so reviewers can get in without signing up.
 * That makes this account publicly usable by strangers, which is why it is a shared constant
 * rather than three copies: the seed writes it, the sign-in panel displays it, and the
 * server-side guards compare against it. Three literals would drift, and a guard comparing
 * against a stale address is a guard that silently stops guarding.
 *
 * The account is deliberately hostile input. Guards enforced server-side (SPEC §10):
 * it cannot change its password, email or name, cannot be deleted, and cannot generate AI
 * analyses. Hiding a button does not stop a Server Action being called.
 */

export const DEMO_EMAIL = 'admin@novaanalytics.io';

/** Published on the sign-in page. Not a secret, and must never protect anything that matters. */
export const DEMO_PASSWORD = 'NovaDemo2026!';

export const DEMO_NAME = 'Nova Demo';

/** True when the account is the shared demo one. Case-insensitive: emails are stored lowercase,
 *  but a sign-up form is not obliged to send them that way. */
export function isDemoAccount(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase() === DEMO_EMAIL;
}
