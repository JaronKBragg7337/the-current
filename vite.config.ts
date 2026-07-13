import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/') || id.includes('react-three') || id.includes('three-stdlib')) return 'three';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          if (id.includes('/idb/') || id.includes('/zod/')) return 'persistence';
          return undefined;
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    // Hosted two-core runners otherwise make the long deterministic replay
    // and IndexedDB retention workloads contend until their safety timeouts.
    fileParallelism: process.env.CI !== 'true',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/simulation/**/*.ts', 'src/persistence/**/*.ts'],
    },
  },
});
