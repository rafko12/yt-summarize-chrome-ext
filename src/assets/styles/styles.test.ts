import fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('kontrakty stylów CSS (src/assets/styles/index.css)', () => {
  const cssPath = resolve(__dirname, 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  it('konfiguruje Tailwind CSS i wtyczkę DaisyUI z wymaganymi motywami night i nord', () => {
    expect(cssContent).toContain("@import 'tailwindcss';");
    expect(cssContent).toContain('@plugin "daisyui"');
    expect(cssContent).toContain('night --default');
    expect(cssContent).toContain('nord');
  });

  it('definiuje ograniczenia overflow i wymiary dla dokumentu HTML rozszerzenia', () => {
    expect(cssContent).toMatch(/html,\s*body\s*\{[^}]*overflow:\s*hidden/);
    expect(cssContent).toMatch(/html,\s*body\s*\{[^}]*width:\s*100%/);
    expect(cssContent).toMatch(/html,\s*body\s*\{[^}]*height:\s*100%/);
  });

  it('deklaruje dedykowane kontenery montowania panelu bocznego i strony opcji', () => {
    expect(cssContent).toContain('#my-ext-sidepanel-page');
    expect(cssContent).toContain('#my-ext-options-page');
    expect(cssContent).toContain('#my-ext');
  });

  it('zapewnia styl cienkiego paska przewijania dla kontenerów panelu', () => {
    expect(cssContent).toContain('::-webkit-scrollbar');
    expect(cssContent).toContain('scrollbar-width: thin');
  });

  it('potwierdza obecność kontenerów montowania w szablonach HTML punktów wejścia', () => {
    const sidepanelHtml = fs.readFileSync(
      resolve(__dirname, '../../sidepanel/index.html'),
      'utf-8'
    );
    expect(sidepanelHtml).toContain('id="my-ext-sidepanel-page"');
    expect(sidepanelHtml).toContain('href="../assets/styles/index.css"');

    const optionsHtml = fs.readFileSync(
      resolve(__dirname, '../../options/index.html'),
      'utf-8'
    );
    expect(optionsHtml).toContain('id="my-ext-options-page"');
    expect(optionsHtml).toContain('href="../assets/styles/index.css"');
  });
});
