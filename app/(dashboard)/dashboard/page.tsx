import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUser } from '@/lib/db/queries';

/**
 * Placeholder Overview.
 *
 * This route used to be the starter's Team Settings screen — subscription card, member list and
 * invite form. It is replaced rather than deleted: the middleware redirects here after every
 * sign-in, so deleting it would 404 the destination of the app's main flow.
 *
 * The real Overview — visitors, pageviews, sources, top pages — arrives with the events table.
 * There is deliberately nothing here that looks like a metric yet, because there is no data to
 * back one.
 */
export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Overview</h1>
      <Card>
        <CardHeader>
          <CardTitle>No sites yet</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>
            Signed in as {user.email}. Once you register a site and install the
            snippet, its traffic will appear here.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
