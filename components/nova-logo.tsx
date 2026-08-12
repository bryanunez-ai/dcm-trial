import { cn } from '@/lib/utils';

/**
 * The Nova mark: a four-point star burst over a rising bar pair — the "nova" and the analytics
 * in one shape. Drawn inline rather than shipped as an image file so it inherits currentColor
 * and stays sharp at every size, and so the header costs no extra request.
 */
export function NovaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      <path
        d="M12 1.5 13.9 8.1 20.5 10 13.9 11.9 12 18.5 10.1 11.9 3.5 10 10.1 8.1 12 1.5Z"
        fill="currentColor"
      />
      <rect x="3.5" y="18" width="4" height="4.5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="10" y="15.5" width="4" height="7" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="16.5" y="12.5" width="4" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

export function NovaLogo({
  className,
  markClassName
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <NovaMark className={cn('size-6 text-brand', markClassName)} />
      <span className="text-xl font-semibold tracking-tight text-foreground">
        Nova <span className="text-muted-foreground font-medium">Analytics</span>
      </span>
    </span>
  );
}
