import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 70,
        branches: 70,
        statements: 80
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/tests/**',
        '**/coverage/**'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
