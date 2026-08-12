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
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
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
