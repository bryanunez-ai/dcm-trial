import { test, expect } from '@playwright/test';
import { getBaseUrl } from '../lib/base-url';

/**
 * A deploy of this project failed with `TypeError: Invalid URL … input: 'none'` because the
 * BASE_URL environment variable had been filled in with the word "none". That string reached
 * `new URL()` in the root layout's metadataBase, which failed page-data collection for every
 * route and took the entire build down.
 *
 * A misconfigured environment variable should produce a wrong-but-working default, never a
 * broken deployment. These cases exist so that never happens again.
 */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test.describe('base URL resolution', () => {
  test('placeholder values never reach new URL()', () => {
    // The literal string that broke the deploy, plus its obvious siblings.
    for (const junk of ['none', 'todo', 'changeme', 'null', 'undefined', ' ', '::::']) {
      withEnv(
        { BASE_URL: junk, VERCEL_PROJECT_PRODUCTION_URL: undefined },
        () => {
          const resolved = getBaseUrl();
          expect(resolved, `"${junk}" must not survive`).toBe('http://localhost:3000');
          // The real assertion: whatever comes back is always constructible.
          expect(() => new URL(resolved)).not.toThrow();
        }
      );
    }
  });

  test('a bad BASE_URL falls through to the Vercel production domain', () => {
    withEnv(
      { BASE_URL: 'none', VERCEL_PROJECT_PRODUCTION_URL: 'dcm-trial.vercel.app' },
      () => {
        expect(getBaseUrl()).toBe('https://dcm-trial.vercel.app');
      }
    );
  });

  test('an explicit BASE_URL wins and is normalised', () => {
    withEnv(
      {
        BASE_URL: 'https://analytics.example.com/',
        VERCEL_PROJECT_PRODUCTION_URL: 'dcm-trial.vercel.app'
      },
      () => {
        // Trailing slash removed: this gets concatenated with paths for the install snippet.
        expect(getBaseUrl()).toBe('https://analytics.example.com');
      }
    );
  });

  test('a bare host is accepted and assumed https', () => {
    withEnv({ BASE_URL: 'analytics.example.com', VERCEL_PROJECT_PRODUCTION_URL: undefined }, () => {
      expect(getBaseUrl()).toBe('https://analytics.example.com');
    });
  });

  test('localhost still works for development', () => {
    withEnv(
      { BASE_URL: 'http://localhost:3000', VERCEL_PROJECT_PRODUCTION_URL: undefined },
      () => {
        expect(getBaseUrl()).toBe('http://localhost:3000');
      }
    );
  });

  test('the result is always a constructible absolute URL', () => {
    for (const combo of [
      { BASE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined },
      { BASE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '' },
      { BASE_URL: 'ftp://example.com', VERCEL_PROJECT_PRODUCTION_URL: undefined }
    ]) {
      withEnv(combo, () => {
        expect(() => new URL(getBaseUrl())).not.toThrow();
      });
    }
  });
});
