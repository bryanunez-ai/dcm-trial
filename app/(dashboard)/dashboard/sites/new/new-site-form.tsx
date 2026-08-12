'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSite } from '../actions';
import type { ActionState } from '@/lib/auth/middleware';

export function NewSiteForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSite,
    {}
  );

  return (
    <form
      action={formAction}
      className="max-w-lg space-y-5 rounded-xl border border-border bg-card p-5"
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={state.name}
          placeholder="My blog"
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Only you see this.
        </p>
      </div>

      <div>
        <Label htmlFor="domain">Domain</Label>
        <Input
          id="domain"
          name="domain"
          required
          maxLength={253}
          defaultValue={state.domain}
          placeholder="example.com"
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          No https://, no www, no path. Nova only accepts pageviews sent from
          this domain, which is what stops anyone else writing into your
          numbers.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="rounded-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Creating…
          </>
        ) : (
          'Create site'
        )}
      </Button>
    </form>
  );
}
