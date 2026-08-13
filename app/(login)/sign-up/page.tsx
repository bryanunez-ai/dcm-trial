import type { Metadata } from 'next';
import { Login } from '../login';

export const metadata: Metadata = {
  title: 'Sign up',
  description:
    'Create a Nova Analytics account and start measuring a site with one script tag. No cookies, no consent banner.',
  alternates: { canonical: '/sign-up' }
};

export default function SignUpPage() {
  return <Login mode="signup" />;
}
