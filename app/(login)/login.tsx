'use client';

import Link from 'next/link';
import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { NovaMark } from '@/components/nova-logo';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo';

/**
 * This component reads no search params, deliberately.
 *
 * It used to carry three hidden inputs — redirect, priceId and inviteId — read from the query
 * string with useSearchParams. All three are dead now: priceId fed Stripe checkout, inviteId fed
 * team invitations, and redirect was only ever set by the checkout handoff. A field that posts a
 * value nothing reads is decorative, so they are gone rather than preserved.
 *
 * That also removes the PPR hazard the spec warns about: useSearchParams in a client component
 * that renders a form opts the subtree out of the prerendered shell, and the form ships as an
 * empty shell that only appears after hydration. There is nothing to lift into the server page
 * because there is nothing left to read.
 */
export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );

  function fillDemoCredentials() {
    const form = formRef.current;
    if (!form) return;

    const email = form.elements.namedItem('email') as HTMLInputElement | null;
    const password = form.elements.namedItem(
      'password'
    ) as HTMLInputElement | null;

    if (email) email.value = DEMO_EMAIL;
    if (password) password.value = DEMO_PASSWORD;
    password?.focus();
  }

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-muted/40">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <NovaMark className="size-12 text-brand" />
        </Link>
        {/* An h1, not an h2: this is the page's own main heading, and these pages had none. */}
        <h1 className="mt-6 text-center text-3xl font-extrabold tracking-tight">
          {mode === 'signin'
            ? 'Sign in to Nova Analytics'
            : 'Create your Nova account'}
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <form ref={formRef} className="space-y-6" action={formAction}>
          <div>
            <Label htmlFor="email" className="block text-sm font-medium">
              Email
            </Label>
            <div className="mt-1">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                required
                maxLength={255}
                className="rounded-full"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="block text-sm font-medium">
              Password
            </Label>
            <div className="mt-1">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                defaultValue={state.password}
                required
                minLength={8}
                maxLength={100}
                className="rounded-full"
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {state?.error && (
            <div className="text-destructive text-sm">{state.error}</div>
          )}

          <div>
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Loading...
                </>
              ) : mode === 'signin' ? (
                'Sign in'
              ) : (
                'Sign up'
              )}
            </Button>
          </div>
        </form>

        {mode === 'signin' && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Reviewing this project?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with the shared demo account. It is read-mostly on
              purpose: it cannot change its own credentials, be deleted, or
              spend money on AI analyses.
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-20">Email</dt>
                <dd className="font-mono">{DEMO_EMAIL}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-20">Password</dt>
                <dd className="font-mono">{DEMO_PASSWORD}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-full"
              onClick={fillDemoCredentials}
            >
              Fill in demo credentials
            </Button>
          </div>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-muted/40 text-muted-foreground">
                {mode === 'signin'
                  ? 'New to Nova Analytics?'
                  : 'Already have an account?'}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href={mode === 'signin' ? '/sign-up' : '/sign-in'}>
                {mode === 'signin'
                  ? 'Create an account'
                  : 'Sign in to existing account'}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
