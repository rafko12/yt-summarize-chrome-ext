import { describe, expect, it } from 'vitest';

import manifest from './src/manifest';
import viteConfig from './vite.config';

describe('konfiguracja buildu Vite i manifestu', () => {
  it('zawsze tworzy artefakt Chrome w dist_chrome i ogranicza CORS serwera do chrome-extension', () => {
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

  it('definiuje kompletny manifest dla Chrome bezpośrednio w src/manifest.ts', () => {
    expect(manifest.minimum_chrome_version).toBe('142');
    expect(manifest.permissions).toEqual([
      'tabs',
      'storage',
      'sidePanel',
      'scripting',
    ]);
    expect(manifest.host_permissions).toEqual([
      'https://*.youtube.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
    ]);
    expect(manifest.side_panel?.default_path).toBe('src/sidepanel/index.html');
    expect(manifest.options_page).toBe('src/options/index.html');
    expect(manifest.background).toEqual({
      service_worker: 'src/background/index.ts',
      type: 'module',
    });
    expect(manifest.content_scripts?.[0]?.js).toEqual(['src/content/index.ts']);
    expect(manifest.content_scripts?.[0]?.matches).toEqual([
      'https://*.youtube.com/*',
    ]);
    expect(manifest.web_accessible_resources).toBeUndefined();
  });
});
