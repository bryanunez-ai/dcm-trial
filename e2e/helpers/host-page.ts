import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * A throwaway static server standing in for a customer's website.
 *
 * Why a real server rather than Playwright's route interception: a document produced by
 * `route.fulfill` is not classified as having come from the loopback address space, so Chrome's
 * Private Network Access policy then blocks every subresource the page requests from the local
 * app — including, absurdly, same-origin ones. Serving the page over a genuine socket on
 * 127.0.0.1 puts the page and the collector in the same address space, which is the situation a
 * real installation is in anyway.
 *
 * Paired with the --host-resolver-rules flag in playwright.config.ts, this gives a page that is
 * genuinely served from a domain other than localhost, which is what the origin check needs.
 */
export type HostPage = {
  origin: string;
  url: (path: string) => string;
  close: () => Promise<void>;
};

/** Where the app under test lives. Follows E2E_BASE_URL so the suite stays portable. */
export const APP_ORIGIN = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export async function startHostPage(options: {
  /** Domain the browser will use. Must be mapped to 127.0.0.1 by the resolver rule. */
  domain: string;
  siteKey: string;
  /** Defaults to the app under test; override only to point somewhere else deliberately. */
  appOrigin?: string;
}): Promise<HostPage> {
  const appOrigin = options.appOrigin ?? APP_ORIGIN;
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${path}</title>
    <script defer src="${appOrigin}/nova.js" data-site="${options.siteKey}"></script>
  </head>
  <body>
    <h1>${path}</h1>
    <a href="/about" id="spa">About</a>
    <script>
      // Stand-in for a single-page app router, to exercise the history patching.
      document.getElementById('spa').addEventListener('click', function (e) {
        e.preventDefault();
        history.pushState({}, '', '/about');
      });
    </script>
  </body>
</html>`);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://${options.domain}:${port}`;

  return {
    origin,
    url: (path: string) => `${origin}${path}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      )
  };
}
