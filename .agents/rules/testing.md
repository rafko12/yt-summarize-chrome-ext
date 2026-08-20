---
description: 'Testing Approach and Standards'
globs: '*'
---

# Testing Approach

## Current State

- The repository currently **does not have an automated unit or E2E testing framework** (such as Jest, Vitest, Playwright, or Cypress) installed in `package.json`.
- Testing is primarily handled manually in the browser.

## Manual Testing Commands

- **Chrome:** Run `pnpm run dev` to start Vite in Chrome extension mode.

## Future Guidelines

- If an automated testing framework is introduced, this file should be updated to reflect the chosen tools (e.g., Playwright for E2E extension testing, Vitest for unit tests).

## Metodologia Testowania UI Rozszerzenia Chrome (Deterministic Layout Audit)

Podczas testowania interfejsu (w tym audytów takich jak `deterministic-design`), używaj następującej procedury, ponieważ środowisko rozszerzenia wymaga specjalnego podejścia:

1. **Mockowanie API Chrome**: Zanim sprawdzisz layout w standardowej przeglądarce (np. przez `browser_subagent`), wstrzyknij mocki obiektów `chrome` do plików HTML (`dist_chrome/src/popup/index.html`, `dist_chrome/src/options/index.html`), np.:
   ```javascript
   window.chrome = window.chrome || {};
   window.chrome.runtime = window.chrome.runtime || {};
   window.chrome.runtime.onMessage = {
     addListener: () => {},
     removeListener: () => {},
   };
   window.chrome.storage = {
     local: {
       get: (k, cb) => (cb ? cb({}) : Promise.resolve({})),
       set: (k, cb) => (cb ? cb() : Promise.resolve()),
     },
   };
   window.chrome.tabs = {
     query: (o, cb) =>
       cb
         ? cb([{ id: 1, url: 'https://youtube.com/watch?v=123' }])
         : Promise.resolve([{ id: 1, url: 'https://youtube.com/watch?v=123' }]),
   };
   ```
2. **Serwowanie lokalne**: Uruchom pliki z folderu `dist_chrome` za pomocą serwera statycznego, np. `npx -y serve dist_chrome -p 3000`.
3. **Pomiary i weryfikacja (Viewport)**: Wejdź na strony poprzez subagenta z odpowiednio ustawionym oknem:
   - Popup: `http://localhost:3000/src/popup/index.html` (rozmiary: `400x600`, `800x600`).
   - Opcje: `http://localhost:3000/src/options/index.html` (rozmiary: `800x600`, `1200x800`).
4. **Weryfikacja Horizontal Overflow**: Zawsze wywołuj matematyczny pomiar przepełnienia poziomego z JavaScriptu:
   ```javascript
   document.documentElement.scrollWidth - document.documentElement.clientWidth;
   ```
   Wartość musi zawsze wynosić `0`. Jeśli jest `> 0`, znajdź kolidujący element.
5. **Sprzątanie (Ważne)**: Po zakończeniu audytu, uruchom `pnpm run build` aby nadpisać zmockowane pliki w `dist_chrome` oryginalnymi artefaktami i posprzątać po środowisku testowym.
