'use client';

import { useActionState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteSite } from './actions';
import type { ActionState } from '@/lib/auth/middleware';

/**
 * Deleting a site destroys its entire history, which cannot be recovered, so it asks first.
 *
 * window.confirm rather than a modal: this is a genuinely destructive, rarely-taken action, and
 * the native dialog is unmissable, keyboard-correct and impossible to mis-style. The server
 * action re-checks ownership regardless — the confirmation is a courtesy to the user, not a
 * security control.
 */
export function DeleteSiteButton({
  siteId,
  domain
}: {
  siteId: number;
  domain: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteSite,
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Delete ${domain} and all of its collected history?\n\nThis cannot be undone. The snippet will stop reporting.`
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="rounded-full text-destructive hover:text-destructive"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        Delete
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}
