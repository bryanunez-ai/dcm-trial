import type { Metadata } from 'next';
import { Login } from '../login';

export const metadata: Metadata = {
  title: 'Sign up'
};

export default function SignUpPage() {
  return <Login mode="signup" />;
}
