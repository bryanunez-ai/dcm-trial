import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * These tests are the milestone gates, not a unit suite. They drive a real browser against a real
 * dev server backed by the real database, because the things worth checking here — a session
 * cookie surviving a redirect, a tracking beacon firing from a page, a share link rendering with
 * no session — cannot be observed from a type checker.
 *
 * E2E_BASE_URL points them at the deployed URL instead, which is how the deploy milestone gets
 * verified against production rather than only against localhost.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/helpers/**', '**/global-teardown.ts'],
  globalTeardown: './e2e/global-teardown.ts',
  // One worker, shared database: the specs create and delete real rows, so running them in
  // parallel would have them counting each other's events.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      // Maps a fake domain onto the loopback interface so the tracker can be exercised from a
      // page that is genuinely served on a domain other than localhost.
      //
      // Without this, a page on a public-looking host loading the script from localhost is
      // blocked by Chrome's Private Network Access policy ("the request client is not a secure
      // context and the resource is in more-private address space `loopback`"). Resolving the
      // test domain to 127.0.0.1 puts the page and the collector in the same address space, so
      // nothing has to be disabled — in particular NOT --disable-web-security, which would also
      // switch off the CORS behaviour the beacon depends on and make the test prove less.
      args: ['--host-resolver-rules=MAP nova-e2e.test 127.0.0.1'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
