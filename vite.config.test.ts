import fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

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

  it('potwierdza brak aliasu @utils we wszystkich konfiguracjach i brak zastępczego katalogu src/utils', () => {
    const viteSource = fs.readFileSync(
      resolve(__dirname, 'vite.config.ts'),
      'utf-8'
    );
    expect(viteSource).not.toContain('@utils');

    const vitestSource = fs.readFileSync(
      resolve(__dirname, 'vitest.config.ts'),
      'utf-8'
    );
    expect(vitestSource).not.toContain('@utils');

    const tsconfigSource = fs.readFileSync(
      resolve(__dirname, 'tsconfig.json'),
      'utf-8'
    );
    expect(tsconfigSource).not.toContain('@utils');
    expect(tsconfigSource).not.toContain('src/utils');

    expect(fs.existsSync(resolve(__dirname, 'src/utils'))).toBe(false);
  });

  it('potwierdza, że manifest deweloperski i produkcyjny zawierają dokładnie jeden, identyczny entry point content scriptu', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      vi.resetModules();
      process.env.NODE_ENV = 'development';
      const devManifest = (await import('./src/manifest')).default;

      vi.resetModules();
      process.env.NODE_ENV = 'production';
      const prodManifest = (await import('./src/manifest')).default;

      expect(devManifest.content_scripts).toBeDefined();
      expect(prodManifest.content_scripts).toBeDefined();
      expect(devManifest.content_scripts).toHaveLength(1);
      expect(prodManifest.content_scripts).toHaveLength(1);

      expect(devManifest.content_scripts![0].js).toEqual([
        'src/content/index.ts',
      ]);
      expect(prodManifest.content_scripts![0].js).toEqual([
        'src/content/index.ts',
      ]);
      expect(devManifest.content_scripts![0].js).toEqual(
        prodManifest.content_scripts![0].js
      );
      expect(devManifest.content_scripts![0].matches).toEqual(
        prodManifest.content_scripts![0].matches
      );

      // Contract checks: permissions, host_permissions, minimum_chrome_version remain unchanged
      expect(devManifest.permissions).toEqual(prodManifest.permissions);
      expect(devManifest.host_permissions).toEqual(
        prodManifest.host_permissions
      );
      expect(devManifest.minimum_chrome_version).toBe('142');
      expect(prodManifest.minimum_chrome_version).toBe('142');
    } finally {
      process.env.NODE_ENV = originalEnv;
      vi.resetModules();
    }
  });

  it('potwierdza, że usunięte pośrednie entry pointy content scriptu nie są wymagane', () => {
    const deprecatedEntryPoints = [
      'src/content/index.dev.ts',
      'src/content/index.prod.ts',
      'src/content/index.dev.tsx',
      'src/content/index.prod.tsx',
      'src/content/Content.ts',
      'src/content/Content.tsx',
    ];

    deprecatedEntryPoints.forEach((relativePath) => {
      expect(
        fs.existsSync(resolve(__dirname, relativePath)),
        `Plik ${relativePath} powinien być trwale usunięty`
      ).toBe(false);
    });

    const singleEntryPoint = resolve(__dirname, 'src/content/index.ts');
    expect(fs.existsSync(singleEntryPoint)).toBe(true);

    const indexSource = fs.readFileSync(singleEntryPoint, 'utf-8');
    expect(indexSource).toContain('./youtubeContentScript');
    expect(indexSource).not.toContain('react');
    expect(indexSource).not.toContain('React');
  });

  it('potwierdza statyczną kontrolą brak martwego aliasu, aplikacyjnych pozostałości popup i starych nazw', () => {
    const srcDir = resolve(__dirname, 'src');

    function getAllFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      entries.forEach((entry) => {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getAllFiles(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      });
      return files;
    }

    const allSourceFiles = getAllFiles(srcDir);
    expect(allSourceFiles.length).toBeGreaterThan(0);

    allSourceFiles.forEach((filePath) => {
      const relativePath = filePath.replace(srcDir, 'src').replace(/\\/g, '/');

      // No file path should contain popup
      expect(relativePath.toLowerCase()).not.toContain('popup');

      const content = fs.readFileSync(filePath, 'utf-8');

      // No usage of dead alias @utils
      expect(content).not.toContain('@utils');

      // No application leftovers of popup
      expect(content).not.toContain('src/popup');

      // No references to old removed modules
      expect(content).not.toContain('src/shared');
      expect(content).not.toContain('createShadowRoot');
    });

    // Explicit check for non-existence of old module locations
    expect(fs.existsSync(resolve(__dirname, 'src/popup'))).toBe(false);
    expect(fs.existsSync(resolve(__dirname, 'src/shared'))).toBe(false);
    expect(fs.existsSync(resolve(__dirname, 'src/utils'))).toBe(false);
    expect(
      fs.existsSync(resolve(__dirname, 'src/sidepanel/ai/registry.ts'))
    ).toBe(false);
  });

  it('potwierdza brak przejściowych aliasów i nierespektowanych wzorców w kodzie produkcyjnym oraz testach', () => {
    const srcDir = resolve(__dirname, 'src');

    function getAllSourceFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      entries.forEach((entry) => {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getAllSourceFiles(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      });
      return files;
    }

    const forbiddenPatterns = [
      'PopupContainer',
      'PopupTab',
      'YoutubePagePlatform',
      'createYoutubePage',
      'youtubePageOverride',
      'saveAnalysisSession',
      'createLocalStorageAdapter',
      'ChromeSidePanelPlatform',
      'ChromeStorageLocalPlatform',
    ];

    const allFiles = getAllSourceFiles(srcDir);
    allFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      forbiddenPatterns.forEach((pattern) => {
        expect(
          content.includes(pattern),
          `Plik ${filePath} nie powinien zawierać wycofanego aliasu ${pattern}`
        ).toBe(false);
      });
    });
  });

  it('potwierdza konfigurację progów 100% gałęzi dla krytycznych modułów w vitest.config.ts', () => {
    const vitestSource = fs.readFileSync(
      resolve(__dirname, 'vitest.config.ts'),
      'utf-8'
    );
    expect(vitestSource).toContain(
      "'src/background/sidePanelController.ts': {"
    );
    expect(vitestSource).toContain("'src/messaging/messages.ts': {");
    expect(vitestSource).toContain("'src/sidepanel/ai/modelCatalog.ts': {");
    expect(vitestSource).toContain('branches: 100');
  });

  it("potwierdza domknięcie granic feature'ów analizy i Historii analiz (AC #76)", () => {
    // 1. Kontrakty nie mogą importować Reacta
    const historyTypes = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/history/types.ts'),
      'utf-8'
    );
    expect(historyTypes).not.toContain('react');
    expect(historyTypes).not.toContain('React');

    const analysisTypes = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/analysis/analysisSessionTypes.ts'),
      'utf-8'
    );
    expect(analysisTypes).not.toContain('react');
    expect(analysisTypes).not.toContain('React');

    // 2. Typy właściwości widoków muszą być kolokowane z widokami, a nie w kontraktach persistence
    expect(historyTypes).not.toContain('HistoryViewProps');

    const historyViewSource = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/history/HistoryView.tsx'),
      'utf-8'
    );
    expect(historyViewSource).toContain('interface HistoryViewProps');

    // 3. Publiczne wejścia eksportują wyłącznie symbole używane przez composition root / produkcję
    const analysisIndex = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/analysis/index.ts'),
      'utf-8'
    );
    expect(analysisIndex).not.toContain('UseAnalysisSessionProps');

    const historyIndex = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/history/index.ts'),
      'utf-8'
    );
    expect(historyIndex).not.toContain('UseAnalysisHistoryProps');

    // 4. Testy nie weryfikują obecności eksportów
    const historySeamTest = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/history/seam.test.ts'),
      'utf-8'
    );
    expect(historySeamTest).not.toContain('expect(typeof history.saveChat)');
  });

  it('potwierdza domknięcie interfejsów preferencji, AI, YouTube i shella (AC #77)', () => {
    // 1. Kontrakty preferencji, AI i integracji YouTube nie zawierają typów właściwości widoków
    const preferencesTypes = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/preferences/types.ts'),
      'utf-8'
    );
    expect(preferencesTypes).not.toContain('SettingsViewProps');
    expect(preferencesTypes).not.toContain('react');
    expect(preferencesTypes).not.toContain('React');
    expect(preferencesTypes).not.toContain('export type { AiProvider }');

    const aiTypes = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/ai/types.ts'),
      'utf-8'
    );
    expect(aiTypes).not.toContain('react');
    expect(aiTypes).not.toContain('React');
    expect(aiTypes).not.toContain('Props');
    expect(aiTypes).not.toContain('export type { ConversationMessage');
    expect(aiTypes).not.toContain('export type { TranscriptSegment');

    const youtubeTypes = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/youtube/types.ts'),
      'utf-8'
    );
    expect(youtubeTypes).not.toContain('react');
    expect(youtubeTypes).not.toContain('React');
    expect(youtubeTypes).not.toContain('Props');

    // 2. Typy właściwości ustawień i shella są kolokowane z widokami, które ich używają
    const settingsViewSource = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/preferences/SettingsView.tsx'),
      'utf-8'
    );
    expect(settingsViewSource).toContain('interface SettingsViewProps');

    const headerSource = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/shell/Header.tsx'),
      'utf-8'
    );
    expect(headerSource).toContain('interface HeaderProps');

    // 3. Publiczne wejścia feature'ów mają jawne, minimalne eksporty bez równoległych aliasów
    const preferencesIndex = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/preferences/index.ts'),
      'utf-8'
    );
    expect(preferencesIndex).not.toContain('AiProvider');
    expect(preferencesIndex).not.toContain('UseSettingsProps');

    const aiIndex = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/ai/index.ts'),
      'utf-8'
    );
    expect(aiIndex).not.toContain('generateSummary');
    expect(aiIndex).not.toContain('generateChatResponse');
    expect(aiIndex).not.toContain('validateApiKey');
    expect(aiIndex).not.toContain('getProvider');

    const shellIndex = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/shell/index.ts'),
      'utf-8'
    );
    expect(shellIndex).not.toContain('HeaderProps');

    // 4. Klient AI i integracja YouTube ukrywają adaptery za publicznymi interfejsami
    const dependenciesSource = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/dependencies.ts'),
      'utf-8'
    );
    expect(dependenciesSource).toContain('createAiClient');
    expect(dependenciesSource).toContain('createYoutube');
  });
});
