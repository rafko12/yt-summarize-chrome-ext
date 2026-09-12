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

  it('potwierdza przygotowanie stylów i fontów niezależnych od Shadow DOM (AC #78)', () => {
    // 1. Główny CSS zachowuje konfigurację motywów DaisyUI w trybie CSS-first
    const indexCss = fs.readFileSync(
      resolve(__dirname, 'src/assets/styles/index.css'),
      'utf-8'
    );
    expect(indexCss).toContain("@import 'tailwindcss';");
    expect(indexCss).toContain('@plugin "daisyui"');
    expect(indexCss).toContain('night --default');
    expect(indexCss).toContain('nord');

    // 2. Właściciele stylów dokumentu, korzenia i przewijania nie wymagają :host
    expect(indexCss).toMatch(
      /html,\s*body\s*\{[^}]*font-family:\s*'Geist Sans'/
    );
    expect(indexCss).toMatch(/html,\s*body\s*\{[^}]*overflow:\s*hidden/);
    expect(indexCss).toMatch(/#my-ext\s*\{[^}]*font-family:\s*'Geist Sans'/);
    expect(indexCss).toMatch(/#my-ext\s*\{[^}]*font-weight:\s*500/);
    expect(indexCss).toMatch(/#my-ext\s*\{[^}]*font-size:\s*16px/);
    expect(indexCss).toContain('::-webkit-scrollbar');
    expect(indexCss).toContain('scrollbar-width: thin');

    // 3. Fonty można ładować bezpośrednio bez adaptera Chrome (chrome.runtime.getURL)
    const geistFontsSource = fs.readFileSync(
      resolve(__dirname, 'src/assets/geistFonts.ts'),
      'utf-8'
    );
    expect(geistFontsSource).toContain(
      'resolveUrl: (url: string) => string = (url) => url'
    );
    expect(geistFontsSource).toContain('export function loadGeistFonts');
    expect(geistFontsSource).not.toContain('chrome.runtime.getURL');

    // 4. Konfiguracja wyjścia Rollup gwarantuje emisję fontów do assets/fonts/
    const viteSource = fs.readFileSync(
      resolve(__dirname, 'vite.config.ts'),
      'utf-8'
    );
    expect(viteSource).toContain("'assets/fonts/[name][extname]'");
  });

  it('potwierdza przełączenie panelu bocznego na bezpośredni root React bez Shadow DOM (AC #79)', () => {
    // 1. Punkt wejścia panelu bocznego nie importuje createIsolatedRoot ani stylów z ?inline
    const sidePanelIndexSource = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/index.tsx'),
      'utf-8'
    );
    expect(sidePanelIndexSource).not.toContain('createIsolatedRoot');
    expect(sidePanelIndexSource).not.toContain('index.css?inline');
    expect(sidePanelIndexSource).toContain("import '@assets/styles/index.css'");
    expect(sidePanelIndexSource).toContain('loadGeistFonts');
    expect(sidePanelIndexSource).toContain('createRoot');
    expect(sidePanelIndexSource).toContain('my-ext-sidepanel-page');

    // 2. Dokument panelu bocznego ładuje arkusz stylów i definiuje kontener roota
    const sidePanelHtml = fs.readFileSync(
      resolve(__dirname, 'src/sidepanel/index.html'),
      'utf-8'
    );
    expect(sidePanelHtml).toContain('id="my-ext-sidepanel-page"');
    expect(sidePanelHtml).toContain(
      '<link rel="stylesheet" href="../assets/styles/index.css"'
    );

    // 3. Style zawierają reguły zapobiegające overflow i zapewniające pełną wysokość
    const indexCss = fs.readFileSync(
      resolve(__dirname, 'src/assets/styles/index.css'),
      'utf-8'
    );
    expect(indexCss).toContain('#my-ext-sidepanel-page');

    // 4. Artefakt produkcyjny ładuje bezpośredni arkusz CSS do dokumentu panelu
    const distSidePanelHtmlPath = resolve(
      __dirname,
      'dist_chrome/src/sidepanel/index.html'
    );
    if (fs.existsSync(distSidePanelHtmlPath)) {
      const distHtml = fs.readFileSync(distSidePanelHtmlPath, 'utf-8');
      expect(distHtml).toMatch(
        /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css">/
      );
      expect(distHtml).toContain('id="my-ext-sidepanel-page"');
    }
  });

  it('potwierdza przełączenie strony opcji i usunięcie nieużywanej izolacji UI (AC #80)', () => {
    // 1. Punkt wejścia strony opcji montuje React bezpośrednio bez createIsolatedRoot i inline CSS
    const optionsIndexSource = fs.readFileSync(
      resolve(__dirname, 'src/options/index.tsx'),
      'utf-8'
    );
    expect(optionsIndexSource).not.toContain('createIsolatedRoot');
    expect(optionsIndexSource).not.toContain('index.css?inline');
    expect(optionsIndexSource).toContain("import '@assets/styles/index.css'");
    expect(optionsIndexSource).toContain('loadGeistFonts');
    expect(optionsIndexSource).toContain('createRoot');
    expect(optionsIndexSource).toContain('my-ext-options-page');

    // 2. Dokument strony opcji ładuje arkusz stylów i posiada kontener roota
    const optionsHtml = fs.readFileSync(
      resolve(__dirname, 'src/options/index.html'),
      'utf-8'
    );
    expect(optionsHtml).toContain('id="my-ext-options-page"');
    expect(optionsHtml).toContain(
      '<link rel="stylesheet" href="../assets/styles/index.css"'
    );

    // 3. Całkowite usunięcie modułu Shadow DOM (src/ui)
    expect(fs.existsSync(resolve(__dirname, 'src/ui'))).toBe(false);

    // 4. PostCSS i style nie zawierają prefiksu selektorów, rem-to-px ani reguł :host
    const postcssConfig = fs.readFileSync(
      resolve(__dirname, 'postcss.config.js'),
      'utf-8'
    );
    expect(postcssConfig).not.toContain('postcssPrefixSelector');
    expect(postcssConfig).not.toContain('postcssRemToPx');
    expect(postcssConfig).not.toContain('transformSelector');
    expect(postcssConfig).toContain('tailwindcss()');
    expect(postcssConfig).toContain('autoprefixer()');

    const indexCss = fs.readFileSync(
      resolve(__dirname, 'src/assets/styles/index.css'),
      'utf-8'
    );
    expect(indexCss).not.toContain(':host');
    expect(indexCss).toContain('#my-ext-options-page');

    // 5. Niestandardowy plugin touchGlobalCSSPlugin został usunięty z vite.config.ts
    const viteConfigSource = fs.readFileSync(
      resolve(__dirname, 'vite.config.ts'),
      'utf-8'
    );
    expect(viteConfigSource).not.toContain('touchGlobalCSSPlugin');
    expect(viteConfigSource).not.toContain('touchFile');

    // 6. Zależności usunięte z manifestu pakietu
    const packageJson = JSON.parse(
      fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
    );
    expect(
      packageJson.devDependencies['@thedutchcoder/postcss-rem-to-px']
    ).toBeUndefined();
    expect(
      packageJson.devDependencies['postcss-prefix-selector']
    ).toBeUndefined();

    // 7. Artefakt produkcyjny strony opcji zawiera bezpośredni arkusz CSS
    const distOptionsHtmlPath = resolve(
      __dirname,
      'dist_chrome/src/options/index.html'
    );
    if (fs.existsSync(distOptionsHtmlPath)) {
      const distHtml = fs.readFileSync(distOptionsHtmlPath, 'utf-8');
      expect(distHtml).toMatch(
        /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css">/
      );
      expect(distHtml).toContain('id="my-ext-options-page"');
    }
  });

  it('potwierdza brak cykli importów oraz brak zależności kontraktów aplikacyjnych od Reacta (AC #81)', () => {
    const srcDir = resolve(__dirname, 'src');

    function getAllSourceFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      entries.forEach((entry) => {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getAllSourceFiles(fullPath));
        } else if (
          /\.(ts|tsx)$/.test(entry.name) &&
          !entry.name.includes('.test.')
        ) {
          files.push(fullPath);
        }
      });
      return files;
    }

    const allSourceFiles = getAllSourceFiles(srcDir);

    // 1. Brak cykli importów w kodzie produkcyjnym (DFS cycle detection)
    function resolveImportPath(
      fromFile: string,
      importSpecifier: string
    ): string | null {
      let candidate = '';
      if (importSpecifier.startsWith('@/')) {
        candidate = resolve(srcDir, importSpecifier.slice(2));
      } else if (importSpecifier.startsWith('@assets/')) {
        candidate = resolve(srcDir, 'assets', importSpecifier.slice(8));
      } else if (importSpecifier.startsWith('.')) {
        candidate = resolve(resolve(fromFile, '..'), importSpecifier);
      } else {
        return null; // External package
      }

      const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
      const matchingExt = extensions.find((ext) => {
        const targetWithExt = candidate + ext;
        return (
          fs.existsSync(targetWithExt) && fs.statSync(targetWithExt).isFile()
        );
      });
      if (matchingExt) {
        return candidate + matchingExt;
      }
      return null;
    }

    const graph = new Map<string, string[]>();
    allSourceFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const importMatches = Array.from(
        content.matchAll(
          /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
        )
      );
      const dependencies: string[] = [];
      importMatches.forEach((match) => {
        const target = resolveImportPath(filePath, match[1]);
        if (target && target.startsWith(srcDir) && !target.includes('.test.')) {
          dependencies.push(target);
        }
      });
      graph.set(filePath, dependencies);
    });

    const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
    const cycles: string[][] = [];

    function detectCycles(node: string, path: string[]) {
      visited.set(node, 1);
      path.push(node);

      const neighbors = graph.get(node) || [];
      neighbors.forEach((neighbor) => {
        const state = visited.get(neighbor) || 0;
        if (state === 1) {
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart).concat(neighbor));
        } else if (state === 0) {
          detectCycles(neighbor, path);
        }
      });

      path.pop();
      visited.set(node, 2);
    }

    allSourceFiles.forEach((file) => {
      if ((visited.get(file) || 0) === 0) {
        detectCycles(file, []);
      }
    });

    expect(
      cycles,
      `Wykryto cykle importów: ${cycles.map((c) => c.join(' -> ')).join('; ')}`
    ).toEqual([]);

    // 2. Kontrakty aplikacyjne, domenowe, magazyn i orkiestracja nie importują Reacta
    const nonUiContractFiles = [
      'src/domain/analysis.ts',
      'src/messaging/messages.ts',
      'src/messaging/index.ts',
      'src/storage/keys.ts',
      'src/storage/chromeStorageLocalAdapter.ts',
      'src/storage/types.ts',
      'src/sidepanel/ai/types.ts',
      'src/sidepanel/ai/client.ts',
      'src/sidepanel/ai/modelCatalog.ts',
      'src/sidepanel/ai/modelPolicy.ts',
      'src/sidepanel/ai/prompts.ts',
      'src/sidepanel/ai/providers/gemini.ts',
      'src/sidepanel/ai/providers/openai.ts',
      'src/sidepanel/ai/providers/anthropic.ts',
      'src/sidepanel/history/types.ts',
      'src/sidepanel/history/analysisHistory.ts',
      'src/sidepanel/preferences/types.ts',
      'src/sidepanel/preferences/userPreferences.ts',
      'src/sidepanel/youtube/types.ts',
      'src/sidepanel/youtube/youtube.ts',
      'src/sidepanel/youtube/chromeYoutubeAdapter.ts',
      'src/sidepanel/analysis/analysisSessionTypes.ts',
      'src/sidepanel/analysis/analysisSessionReducer.ts',
      'src/sidepanel/analysis/timestampParser.ts',
      'src/sidepanel/dependencies.ts',
      'src/sidepanel/panelContext.ts',
      'src/sidepanel/chromeBackgroundTransport.ts',
      'src/sidepanel/dangerZone.ts',
      'src/background/sidePanelController.ts',
      'src/background/chromeSidePanelAdapter.ts',
      'src/background/youtubeNavigationEvents.ts',
      'src/content/index.ts',
      'src/content/youtubeContentScript.ts',
      'src/content/playerResponseExtractor.ts',
    ];

    nonUiContractFiles.forEach((relPath) => {
      const fullPath = resolve(__dirname, relPath);
      expect(
        fs.existsSync(fullPath),
        `Plik kontraktu ${relPath} powinien istnieć`
      ).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(
        content.includes("from 'react'"),
        `Plik kontraktu ${relPath} nie może importować 'react'`
      ).toBe(false);
      expect(
        content.includes('from "react"'),
        `Plik kontraktu ${relPath} nie może importować "react"`
      ).toBe(false);
      expect(
        content.includes("from 'react-dom'"),
        `Plik kontraktu ${relPath} nie może importować 'react-dom'`
      ).toBe(false);
      expect(
        content.includes('from "react-dom"'),
        `Plik kontraktu ${relPath} nie może importować "react-dom"`
      ).toBe(false);
      expect(
        content.includes('React.'),
        `Plik kontraktu ${relPath} nie może odwoływać się do przestrzeni React.`
      ).toBe(false);
    });

    // 3. Sprawdzenie, że importy Reacta są ograniczone wyłącznie do widoków (*.tsx), hooków (use*.ts) i korzeni
    allSourceFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hasReactImport =
        /from\s+['"]react(-dom(\/client)?)?['"]/.test(content) ||
        /import\s+['"]react(-dom(\/client)?)?['"]/.test(content);

      if (hasReactImport) {
        const basename = filePath.split('/').pop() || '';
        const isAllowedUiModule =
          basename.endsWith('.tsx') ||
          basename.startsWith('use') ||
          basename === 'index.tsx';
        expect(
          isAllowedUiModule,
          `Moduł ${filePath} importuje Reacta, ale nie jest widokiem (*.tsx), hookiem (use*.ts) ani punktem montowania (index.tsx)`
        ).toBe(true);
      }
    });
  });
});
