import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@assets': resolve(__dirname, './src/assets'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
    exclude: [...configDefaults.exclude, 'tests/buildArtifact.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/vite-env.d.ts',
        'src/**/index.ts',
        'src/**/index.tsx',
        'src/manifest.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        'src/background/sidePanelController.ts': {
          branches: 100,
        },
        'src/messaging/messages.ts': {
          branches: 100,
        },
        'src/sidepanel/ai/modelCatalog.ts': {
          branches: 100,
        },
      },
    },
  },
});
