'use client';

import { useActionState, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateAnalysis } from './actions';
import type { ActionState } from '@/lib/auth/middleware';

/**
 * Staged progress, not a simulated typewriter.
 *
 * The response is not streamed — streaming with strict tools is undocumented on this provider,
 * and faking token-by-token output over a request that arrives all at once would be theatre. What
 * the server actually does is fetch the site's pages, then call the model, then validate the
 * result, and these labels advance on a timer calibrated to those real stages. The work is real
 * even though the timing is approximate, and the labels never claim a step has finished.
 */
const STAGES = [
  'Reading your traffic…',
  'Fetching your pages…',
  'Analysing…',
  'Prioritising recommendations…'
];

export function GenerateButton({
  siteId,
  hasExisting,
  force = false
}: {
  siteId: number;
  hasExisting: boolean;
  force?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    generateAnalysis,
    {}
  );
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!pending) {
      setStage(0);
      return;
    }
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      4000
    );
    return () => clearInterval(timer);
  }, [pending]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="siteId" value={siteId} />
      {force && <input type="hidden" name="force" value="true" />}

      <Button type="submit" disabled={pending} className="rounded-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {STAGES[stage]}
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            {force
              ? 'Generate a new analysis anyway'
              : hasExisting
                ? 'Generate a new analysis'
                : 'Generate analysis'}
          </>
        )}
      </Button>

      {pending && (
        <p className="text-xs text-muted-foreground">
          This takes up to a minute — the server is fetching your pages and then
          reading them alongside your traffic.
        </p>
      )}

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
