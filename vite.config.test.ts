import fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import viteConfig from './vite.config';

describe('konfiguracja buildu Vite (vite.config.ts)', () => {
  it('konfiguruje docelowy katalog Chrome (dist_chrome) i ograniczenie CORS serwera deweloperskiego', () => {
    const config =
      typeof viteConfig === 'function'
        ? viteConfig({
            command: 'build',
            mode: 'production',
            isSsrBuild: false,
            isPreview: false,
          })
        : viteConfig;

    expect(config.build?.outDir).toBe('dist_chrome');
    expect(config.server?.cors).toEqual({
      origin: [/chrome-extension:\/\//],
    });
  });

  it('definiuje aliasy ścieżek dla src (@) oraz zasobów (@assets)', () => {
    const config =
      typeof viteConfig === 'function'
        ? viteConfig({
            command: 'build',
            mode: 'production',
            isSsrBuild: false,
            isPreview: false,
          })
        : viteConfig;

    expect(config.resolve?.alias).toEqual({
      '@': resolve(__dirname, './src'),
      '@assets': resolve(__dirname, './src/assets'),
    });
  });

  it('konfiguruje regułę emisji fontów Rollup do dedykowanego katalogu assets/fonts/', () => {
    const config =
      typeof viteConfig === 'function'
        ? viteConfig({
            command: 'build',
            mode: 'production',
            isSsrBuild: false,
            isPreview: false,
          })
        : viteConfig;

    const output = config.build?.rollupOptions?.output;
    expect(output).toBeDefined();

    if (
      output &&
      !Array.isArray(output) &&
      typeof output.assetFileNames === 'function'
    ) {
      const fontNaming = output.assetFileNames({
        name: 'geist-sans-latin-400-normal.woff2',
        source: '',
        type: 'asset',
      });
      expect(fontNaming).toBe('assets/fonts/[name][extname]');

      const defaultNaming = output.assetFileNames({
        name: 'image.png',
        source: '',
        type: 'asset',
      });
      expect(defaultNaming).toBe('assets/[name]-[hash][extname]');
    } else {
      throw new Error(
        'Oczekiwano funkcji assetFileNames w rollupOptions.output'
      );
    }
  });

  it('potwierdza konfigurację progów 100% gałęzi dla krytycznych modułów w vitest.config.ts', () => {
    const vitestSource = fs.readFileSync(
      resolve(__dirname, 'vitest.config.ts'),
      'utf-8'
    );
    expect(vitestSource).toContain(
      "'src/background/sidePanelController.ts': {"
    );
    expect(vitestSource).toContain("'src/messaging/contracts.ts': {");
    expect(vitestSource).toContain("'src/sidepanel/ai/modelCatalog.ts': {");
    expect(vitestSource).toContain('branches: 100');
  });
});
