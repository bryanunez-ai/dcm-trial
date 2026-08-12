import { closeDbOnce } from './helpers/db';

/**
 * Closes the shared postgres connection once, after every spec has run.
 *
 * Specs must not do this themselves: they all share a single worker process and therefore a
 * single client, so the first spec to close it breaks every spec scheduled after it.
 */
export default async function globalTeardown() {
  await closeDbOnce();
}
