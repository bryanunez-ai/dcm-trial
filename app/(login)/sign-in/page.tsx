import type { Metadata } from 'next';
import { Login } from '../login';

export const metadata: Metadata = {
  title: 'Sign in',
  // Its own description. Without one, every page inherits the root layout's and search engines
  // see the site's pages as duplicates of each other.
  description:
    'Sign in to your Nova Analytics dashboard, or use the published demo account to look around first.',
  alternates: { canonical: '/sign-in' }
};

export default function SignInPage() {
  return <Login mode="signin" />;
}
