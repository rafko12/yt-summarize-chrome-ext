import fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('weryfikacja artefaktu produkcyjnego (dist_chrome)', () => {
  const distDir = resolve(__dirname, '../dist_chrome');

  it('wymaga obecności katalogu wyjściowego dist_chrome po buildzie', () => {
    expect(
      fs.existsSync(distDir),
      "Katalog artefaktu 'dist_chrome' nie istnieje. Uruchom 'pnpm build' przed testem artefaktu."
    ).toBe(true);
  });

  it('zawiera wygenerowany manifest zgodny z wersją Chrome i punktami wejścia', () => {
    const manifestPath = resolve(distDir, 'manifest.json');
    expect(
      fs.existsSync(manifestPath),
      'Brak wygenerowanego manifest.json w dist_chrome'
    ).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe('142');
    expect(manifest.side_panel?.default_path).toBe('src/sidepanel/index.html');
    expect(manifest.options_page).toBe('src/options/index.html');
  });

  it('emituje arkusz stylów CSS do assets/ i dołącza go do szablonu panelu bocznego', () => {
    const assetsDir = resolve(distDir, 'assets');
    expect(fs.existsSync(assetsDir)).toBe(true);

    const cssFiles = fs
      .readdirSync(assetsDir)
      .filter((file) => file.endsWith('.css'));
    expect(
      cssFiles.length,
      'Brak wygenerowanego arkusza stylów CSS w dist_chrome/assets'
    ).toBeGreaterThan(0);

    const sidePanelHtmlPath = resolve(distDir, 'src/sidepanel/index.html');
    expect(
      fs.existsSync(sidePanelHtmlPath),
      'Brak zbudowanego src/sidepanel/index.html w dist_chrome'
    ).toBe(true);

    const sidePanelHtml = fs.readFileSync(sidePanelHtmlPath, 'utf-8');
    expect(sidePanelHtml).toMatch(
      /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css">/
    );
    expect(sidePanelHtml).toContain('id="my-ext-sidepanel-page"');
  });

  it('dołącza wygenerowany arkusz CSS i kontener montowania do szablonu strony opcji', () => {
    const optionsHtmlPath = resolve(distDir, 'src/options/index.html');
    expect(
      fs.existsSync(optionsHtmlPath),
      'Brak zbudowanego src/options/index.html w dist_chrome'
    ).toBe(true);

    const optionsHtml = fs.readFileSync(optionsHtmlPath, 'utf-8');
    expect(optionsHtml).toMatch(
      /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css">/
    );
    expect(optionsHtml).toContain('id="my-ext-options-page"');
  });

  it('zapewnia emisję zoptymalizowanych fontów Geist Sans w dist_chrome/assets/fonts/', () => {
    const fontsDir = resolve(distDir, 'assets/fonts');
    expect(fs.existsSync(fontsDir)).toBe(true);

    const fontFiles = fs
      .readdirSync(fontsDir)
      .filter((file) => file.endsWith('.woff2'));
    expect(fontFiles.length).toBeGreaterThanOrEqual(5);
  });

  it('zawiera komplet wymaganych ikon produktu w dist_chrome', () => {
    const requiredIcons = [
      'icon16.png',
      'icon32.png',
      'icon48.png',
      'icon128.png',
      'icon.png',
    ];

    requiredIcons.forEach((iconName) => {
      const iconPath = resolve(distDir, iconName);
      expect(
        fs.existsSync(iconPath),
        `Brak ikony ${iconName} w artefakcie dist_chrome`
      ).toBe(true);
    });
  });
});
