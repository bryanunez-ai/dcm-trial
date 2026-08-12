import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { NewSiteForm } from './new-site-form';

export const metadata: Metadata = { title: 'Add a site' };

export default async function NewSitePage() {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="mb-6 text-lg font-medium lg:text-2xl">Add a site</h1>
      <NewSiteForm />
    </section>
  );
}
