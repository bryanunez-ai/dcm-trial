import { test, expect } from '@playwright/test';

test.describe('health check', () => {
  test('reports ok, without a session, and leaks nothing', async ({ request }) => {
    const response = await request.get('/api/status');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(typeof body.latencyMs).toBe('number');
    expect(() => new Date(body.time)).not.toThrow();

    // Never cached: a monitor reading a cached "ok" from ten minutes ago is worse than no monitor.
    expect(response.headers()['cache-control']).toContain('no-store');

    // The response must reveal up-or-down and nothing else. A public endpoint should not become a
    // reconnaissance tool, and error text is exactly what leaks a hostname or a credential.
    expect(Object.keys(body).sort()).toEqual(
      ['database', 'latencyMs', 'status', 'time'].sort()
    );

    const raw = await response.text();
    for (const secret of ['postgres', 'neon', 'password', 'sslmode', 'AUTH_SECRET', 'sk-']) {
      expect(raw.toLowerCase(), `must not mention ${secret}`).not.toContain(
        secret.toLowerCase()
      );
    }
  });
});
