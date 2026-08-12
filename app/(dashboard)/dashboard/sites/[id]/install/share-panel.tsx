'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, Link2, Link2Off, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { disableSharing, enableSharing } from '../../actions';
import type { ActionState } from '@/lib/auth/middleware';

export function SharePanel({
  siteId,
  shareUrl
}: {
  siteId: number;
  shareUrl: string | null;
}) {
  const [enableState, enableAction, enabling] = useActionState<
    ActionState,
    FormData
  >(enableSharing, {});
  const [disableState, disableAction, disabling] = useActionState<
    ActionState,
    FormData
  >(disableSharing, {});
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The URL is on screen and selectable; nothing to recover from.
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Share a read-only dashboard</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send a client their numbers without creating them an account. The page
        shows aggregates only — never your site key — and is never indexed.
      </p>

      {shareUrl ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Share link"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copy}
              className="rounded-full"
            >
              {copied ? (
                <>
                  <Check className="size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy
                </>
              )}
            </Button>
          </div>

          <form action={disableAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={disabling}
              className="rounded-full text-destructive hover:text-destructive"
            >
              {disabling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2Off className="size-4" />
              )}
              Revoke link
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Revoking destroys the token rather than hiding it, so this URL stops
            working permanently. Publishing again mints a different one.
          </p>
        </div>
      ) : (
        <form action={enableAction} className="mt-4">
          <input type="hidden" name="siteId" value={siteId} />
          <Button
            type="submit"
            size="sm"
            disabled={enabling}
            className="rounded-full"
          >
            {enabling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Publish share link
          </Button>
        </form>
      )}

      {(enableState?.error || disableState?.error) && (
        <p className="mt-2 text-sm text-destructive">
          {enableState?.error ?? disableState?.error}
        </p>
      )}
    </div>
  );
}
