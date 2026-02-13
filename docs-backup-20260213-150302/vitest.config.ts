import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e/**'],

    // Parallel execution for 25,000 tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 4,    // Adjust based on CPU cores
        maxThreads: 8,
      }
    },

    // Test filtering by pattern (for critical tests)
    testNamePattern: process.env.TEST_PATTERN,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.ts', 'app/**/*.ts', 'app/**/*.tsx'],
      exclude: [
        'node_modules',
        'tests',
        '**/*.d.ts',
        '**/*.config.ts',
        'app/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    },

    // Timeouts for long-running tests
    testTimeout: 30000,
    hookTimeout: 30000,

    // Benchmark configuration
    benchmark: {
      include: ['tests/bench/**/*.bench.ts'],
      exclude: ['node_modules'],
      outputFile: './benchmark-results.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
