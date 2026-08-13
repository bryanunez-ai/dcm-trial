import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { getUser } from '@/lib/db/queries';
import { getBaseUrl } from '@/lib/base-url';
import { SWRConfig } from 'swr';

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: 'Nova Analytics — cookieless web analytics with an AI advisor',
    template: '%s · Nova Analytics'
  },
  description:
    'Privacy-first web analytics you install with one line. No cookies, no consent banner, and an AI advisor that reads your traffic and your pages to tell you what to change.',
  // Nova's own advisor flagged these as missing on every page of the deployed site, which is
  // exactly the kind of finding it exists to produce.
  openGraph: {
    type: 'website',
    siteName: 'Nova Analytics',
    title: 'Nova Analytics — cookieless web analytics with an AI advisor',
    description:
      'One line of script. No cookies, and nothing stored that could identify a visitor.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nova Analytics — cookieless web analytics with an AI advisor',
    description:
      'One line of script. No cookies, and nothing stored that could identify a visitor.'
  }
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const siteKey = process.env.NOVA_SITE_KEY?.trim();

  return (
    <html lang="en" className={manrope.className} suppressHydrationWarning>
      <head>
        {/*
          Nova measuring itself, using its own public snippet — the same tag a customer pastes,
          not a privileged internal path. Dogfooding is the point: the deployed dashboard shows
          real traffic, including a reviewer's own visit arriving while they watch.

          Rendered only when NOVA_SITE_KEY is set, so local development and anyone else's fork
          never report into this deployment's numbers. The key is public by design — it ships in
          the HTML of every tracked page — so there is nothing here that needs protecting.
        */}
        {siteKey && (
          <script defer src="/nova.js" data-site={siteKey} />
        )}
      </head>
      <body className="min-h-[100dvh] bg-background text-foreground">
        <SWRConfig
          value={{
            fallback: {
              // We do NOT await here
              // Only components that read this data will suspend
              '/api/user': getUser()
            }
          }}
        >
          {children}
        </SWRConfig>
      </body>
    </html>
  );
}
