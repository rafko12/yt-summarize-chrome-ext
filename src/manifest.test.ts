import { describe, expect, it, vi } from 'vitest';

import rawManifest from './manifest';

type ManifestRecord = chrome.runtime.ManifestV3 & {
  minimum_chrome_version?: string;
  side_panel?: { default_path?: string };
  options_page?: string;
};

const manifest = rawManifest as ManifestRecord;

describe('konfiguracja manifestu Chrome (src/manifest.ts)', () => {
  it('definiuje kompletny i poprawny manifest V3 dla Chrome z minimalną wersją przeglądarki', () => {
    expect(manifest.manifest_version).toBe(3);
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
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts?.[0]?.js).toEqual(['src/content/index.ts']);
    expect(manifest.content_scripts?.[0]?.matches).toEqual([
      'https://*.youtube.com/*',
    ]);
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it('gwarantuje identyczność uprawnień, host permissions i punktów wejścia w trybie dev i prod', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      vi.resetModules();
      process.env.NODE_ENV = 'development';
      const devManifest = (await import('./manifest'))
        .default as ManifestRecord;

      vi.resetModules();
      process.env.NODE_ENV = 'production';
      const prodManifest = (await import('./manifest'))
        .default as ManifestRecord;

      expect(devManifest.minimum_chrome_version).toBe('142');
      expect(prodManifest.minimum_chrome_version).toBe('142');
      expect(devManifest.permissions).toEqual(prodManifest.permissions);
      expect(devManifest.host_permissions).toEqual(
        prodManifest.host_permissions
      );
      expect(devManifest.side_panel).toEqual(prodManifest.side_panel);
      expect(devManifest.options_page).toEqual(prodManifest.options_page);
      expect(devManifest.background).toEqual(prodManifest.background);

      expect(devManifest.content_scripts).toHaveLength(1);
      expect(prodManifest.content_scripts).toHaveLength(1);
      expect(devManifest.content_scripts![0].js).toEqual(
        prodManifest.content_scripts![0].js
      );
      expect(devManifest.content_scripts![0].matches).toEqual(
        prodManifest.content_scripts![0].matches
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      vi.resetModules();
    }
  });
});
