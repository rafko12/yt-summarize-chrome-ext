# Reguły projektu (Workspace Rules)

Poniższe reguły określają wytyczne stylu i zachowania agentów w tym projekcie. Są one automatycznie ładowane do kontekstu agenta AI.

## 1. Architektura i Tech Stack
- **Framework:** React 19, TypeScript
- **Build Tool:** Vite + `@crxjs/vite-plugin` (dynamiczne generowanie manifestu)
- **Rozszerzenie:** `webextension-polyfill` (kompatybilność Chrome)
- **Styling:** Tailwind CSS v4, DaisyUI 5, PostCSS. Tematy DaisyUI konfiguruj bezpośrednio w pliku CSS (`@plugin "daisyui"`), nie w `tailwind.config.js`.
- **Kluczowe biblioteki:** `youtube-transcript`, wielomodelowa integracja AI (Gemini, OpenAI, Claude).
- **Zarządzanie stanem/API:** Używamy `chrome.storage.local` opakowanego w utilsy w `src/utils/storage.ts`.

## 2. Standardy Kodu (Style & Linting)
- **Package Manager:** Używaj WYŁĄCZNIE `pnpm`. Projekt wymusza pnpm (`npx only-allow pnpm`). Wersja Node: `>=20.x`.
- **Linter & Formatter:** Projekt restrykcyjnie używa ESLint (`--max-warnings 0`) oraz Prettier (z pluginami do sortowania importów i klas Tailwind).
- **Commity:** Obowiązuje standard Conventional Commits (sprawdzane przez Husky i commitlint).

## 3. Specyficzne reguły dla Rozszerzeń Chrome
### onMessage i eslint(consistent-return)
- W przypadku listenerów takich jak `chrome.runtime.onMessage.addListener`, w których niektóre ścieżki warunkowe (`if` / `switch`) zwracają `true` lub `false`, **zawsze** upewnij się, że na samym końcu funkcji znajduje się domyślne np. `return false;`. Zapobiega to domyślnemu zwracaniu `undefined` dla nieobsługiwanych wiadomości, co eliminuje ostrzeżenia `eslint(consistent-return)`.

## 4. Testowanie (Manualne, Unit, UI)
- **Unit Testy:** W projekcie skonfigurowany jest `vitest` do testów jednostkowych (uruchamianie przez `pnpm test`).
- **E2E / Funkcjonalne:** Brak zautomatyzowanych testów E2E (np. Playwright). Testowanie funkcjonalne odbywa się manualnie w przeglądarce.
- **Chrome:** `pnpm run dev` (tryb rozszerzenia Chrome).

- **Testowanie UI (Audyty deterministyczne):** Jeśli testujesz layout jako subagent, najpierw mockuj API Chrome w skompilowanych plikach `dist_chrome/src/.../index.html`, serwuj je lokalnie (np. `serve dist_chrome -p 3000`), dokonaj pomiarów w odpowiednich rozmiarach okna (np. brak przepełnienia poziomego), a po audycie użyj `pnpm run build`, by posprzątać zmockowane środowisko.

## 5. Dokumentacja w folderze `rules/`
Aby dowiedzieć się więcej na temat konkretnych implementacji architektonicznych, stylów czy procedur testowych, agenci mogą zajrzeć do plików w `.agents/rules/` (`architecture.md`, `style.md`, `testing.md`, `sidepanel.md`).

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `rafko12/yt-summarize-chrome-ext`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
