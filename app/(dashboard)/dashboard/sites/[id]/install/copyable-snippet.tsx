'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyableSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      // Long enough to be read, short enough that the button is never stuck in a state that no
      // longer reflects reality.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied. The snippet is on screen and selectable, so there is
      // nothing to recover from and nothing worth interrupting the user about.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">
          Your snippet
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          className="rounded-full"
        >
          {copied ? (
            <>
              <Check className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-sm">
        <code className="font-mono">{snippet}</code>
      </pre>
    </div>
  );
}
