import { describe, expect, it } from 'vitest';
import { EnvSchema } from './env.js';

describe('EnvSchema', () => {
  it('requires DATABASE_URL', () => {
    const result = EnvSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const result = EnvSchema.safeParse({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/app',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3001);
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.CORS_ORIGIN).toBe('http://localhost:5173');
    }
  });

  it('coerces PORT from string', () => {
    const result = EnvSchema.safeParse({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/app',
      PORT: '4000',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(4000);
  });
});
