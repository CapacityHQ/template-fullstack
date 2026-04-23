import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
    passWithNoTests: true,
  },
});
