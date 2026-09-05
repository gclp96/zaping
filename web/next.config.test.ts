import { describe, expect, it } from 'vitest';

import nextConfig from './next.config';

describe('Next security configuration', () => {
  it('disables powered-by and applies the minimal security headers', async () => {
    const rules = await nextConfig.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    const values = new Map(headers.map((header) => [header.key, header.value]));

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(values.get('X-Content-Type-Options')).toBe('nosniff');
    expect(values.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(values.get('X-Frame-Options')).toBe('DENY');
    expect(values.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
    expect(values.has('Strict-Transport-Security')).toBe(false);
    expect(values.has('Content-Security-Policy')).toBe(false);
  });
});
