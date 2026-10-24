import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'database/**/*.js'],
      exclude: ['src/server.js', 'database/migrate.js'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
