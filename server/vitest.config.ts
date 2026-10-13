import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./test/globalSetup.ts'],
    globalTeardown: ['./test/globalTeardown.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3307',
      DB_USER: 'gavran',
      DB_PASSWORD: 'gavran_local',
      DB_NAME: 'gavran_test',
      DB_ADMIN_USER: 'root',
      DB_ADMIN_PASSWORD: 'gavran_root_local',
      JWT_SECRET: 'test-only-jwt-secret-must-be-32chars',
      COOKIE_SECURE: 'false',
      CORS_ORIGIN: 'http://127.0.0.1:4317',
      LOGIN_RATE_LIMIT_MAX: '1000',
      LOGIN_RATE_LIMIT_WINDOW_MS: '900000',
      LOG_LEVEL: 'silent',
    },
  },
  resolve: {
    alias: {
      '@gavran/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
