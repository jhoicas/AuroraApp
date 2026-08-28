import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API_URL = 'http://localhost:8080/api/v1';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    env: {
      VITE_API_URL: API_URL,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/store/**/*.ts',
        'src/lib/**/*.ts',
        'src/components/ErrorBoundary.tsx',
        'src/components/AuroraCopilot/**/*.tsx',
        'src/pages/tenant/ProjectsDashboard.tsx',
      ],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
