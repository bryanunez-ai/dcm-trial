import { getUser } from '@/lib/db/queries';
import { getReadableSite } from '@/lib/sites/queries';
import { getLiveVisitors } from '@/lib/analytics/metrics';

export const dynamic = 'force-dynamic';

/**
 * Visitors in the last five minutes, for a site the caller is allowed to read.
 *
 * Answers 404 for an unauthenticated caller and for a site belonging to someone else — the same
 * answer in both cases, and the same answer for an id that does not exist. A 401 here would
 * confirm which ids are real, which is exactly the enumeration this avoids.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notFound = () =>
    Response.json({ error: 'Not found' }, { status: 404 });

  const user = await getUser();
  if (!user) return notFound();

  const { id } = await params;
  const siteId = Number(id);
  if (!Number.isInteger(siteId)) return notFound();

  const site = await getReadableSite(siteId, user.id);
  if (!site) return notFound();

  const live = await getLiveVisitors(site.id);

  return Response.json(
    { live },
    { headers: { 'cache-control': 'no-store' } }
  );
}
