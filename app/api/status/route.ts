import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check, for uptime monitoring.
 *
 * Public and unauthenticated on purpose: a health check that needs a session cannot be polled by
 * the monitoring service that exists to notice when sessions stop working.
 *
 * It answers a question the platform cannot: Vercel reports the deployment as healthy as long as
 * the process is serving requests, which stays true when the database is unreachable and every
 * page is failing. So this actually queries the database.
 *
 * It deliberately reveals nothing beyond up or down — no version strings, no row counts, no
 * configuration, no error details. A public endpoint should not be a reconnaissance tool, and an
 * error message is exactly the kind of thing that leaks a hostname or a credential.
 */
export async function GET(): Promise<Response> {
  const startedAt = Date.now();

  let database: 'ok' | 'unreachable' = 'ok';

  try {
    // Cheap and side-effect free. Enough to prove the connection works and the pool is not
    // exhausted; not enough to be worth abusing.
    await db.execute(sql`select 1`);
  } catch {
    database = 'unreachable';
  }

  const healthy = database === 'ok';

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      // Useful for spotting a slow database before it becomes an unreachable one.
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString()
    },
    {
      // 503 rather than 200 when degraded, so a monitor sees a failure without having to parse
      // the body — the whole point of a status code.
      status: healthy ? 200 : 503,
      headers: { 'cache-control': 'no-store' }
    }
  );
}
