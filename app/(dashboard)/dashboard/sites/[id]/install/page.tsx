import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/db/queries';
import { getOwnedSite } from '@/lib/sites/queries';
import { CopyableSnippet } from './copyable-snippet';
import { SharePanel } from './share-panel';

export const metadata: Metadata = { title: 'Install' };
export const dynamic = 'force-dynamic';

export default async function InstallPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  const site = await getOwnedSite(Number(id), user.id);

  // 404, not 403. A site the caller cannot touch is reported as not existing, because a
  // "forbidden" would confirm the id is real and let anyone enumerate other people's sites.
  if (!site) notFound();

  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  const snippet = `<script defer src="${baseUrl}/nova.js" data-site="${site.siteKey}"></script>`;

  return (
    <section className="flex-1 space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-lg font-medium lg:text-2xl">Install on {site.domain}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste this into the <code>&lt;head&gt;</code> of every page you want
          measured.
        </p>
      </div>

      <CopyableSnippet snippet={snippet} />

      <SharePanel
        siteId={site.id}
        shareUrl={site.shareToken ? `${baseUrl}/share/${site.shareToken}` : null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">What happens next</h2>
          <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li>1. Deploy the page with the tag in place.</li>
            <li>2. Visit it from a normal browser, not localhost.</li>
            <li>
              3. Reload{' '}
              <Link
                href={`/dashboard?site=${site.id}`}
                className="text-brand underline underline-offset-4"
              >
                the dashboard
              </Link>
              . The pageview is usually there within a second or two.
            </li>
          </ol>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">If nothing arrives</h2>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="font-medium text-foreground">
                The domain must match exactly.
              </strong>{' '}
              Nova only accepts pageviews sent from{' '}
              <code>{site.domain}</code>. This site key is public — it is in
              your page&rsquo;s HTML — so the origin check is what protects your
              numbers.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                localhost is ignored on purpose,
              </strong>{' '}
              so development traffic never pollutes real figures.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Do Not Track is honoured,
              </strong>{' '}
              and ad blockers stop some requests. Both are expected.
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <h2 className="text-sm font-semibold">Your site key</h2>
        <p className="mt-1 font-mono text-sm">{site.siteKey}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Public by design. It ships in the HTML of every page you track, so it
          identifies the site but authorises nothing.
        </p>
      </div>

      <Button asChild variant="outline" className="rounded-full">
        <Link href="/dashboard/sites">Back to sites</Link>
      </Button>
    </section>
  );
}
