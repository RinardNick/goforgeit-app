import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // Only include React hook tests that need vitest/jsdom
    include: ['lib/hooks/__tests__/*.test.ts', 'lib/hooks/__tests__/*.test.tsx'],
    // Exclude tests that use node:test
    exclude: ['lib/adk/__tests__/*.test.ts', 'lib/db/__tests__/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
