import Link from 'next/link';
import { NovaMark } from '@/components/nova-logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <div className="max-w-md space-y-8 p-4 text-center">
        <div className="flex justify-center">
          <NovaMark className="size-12 text-brand" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
        <p className="text-base text-muted-foreground">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>
        <Button asChild className="rounded-full">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
