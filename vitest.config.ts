import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // Only include React hook and component tests that need vitest/jsdom
    include: [
      'lib/hooks/__tests__/*.test.ts', 
      'lib/hooks/__tests__/*.test.tsx',
      'app/components/AgentComposer/__tests__/*.test.tsx',
      'lib/db/__tests__/*.test.ts',
      'lib/adk/__tests__/tool-manager.test.ts',
      'lib/genkit/__tests__/categorization.test.ts'
    ],
    // Exclude tests that use node:test
    exclude: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
