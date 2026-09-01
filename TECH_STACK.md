# Stos technologiczny

Ten dokument jest mapą technologii używanych przez YT Summarizer. Dokładne
wersje i konfigurację odczytuj ze wskazanych plików źródłowych zamiast utrwalać
je w dokumentacji.

## Platforma wykonawcza

| Obszar                | Technologia                                                                               | Zastosowanie                                                       | Źródło prawdy                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Przeglądarka          | Google Chrome, Manifest V3                                                                | Rozszerzenie z panelem bocznym, usługą w tle i skryptem treści     | [`src/manifest.ts`](src/manifest.ts)                                       |
| Interfejsy rozszerzeń | `chrome.sidePanel`, `chrome.runtime`, `chrome.tabs`, `chrome.storage`, `chrome.scripting` | Panel, komunikacja między kontekstami, stan i integracja ze stroną | [`src/manifest.ts`](src/manifest.ts), [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Strona docelowa       | YouTube                                                                                   | Metadane Filmu, transkrypcja i sterowanie odtwarzaczem             | [`src/content/`](src/content/), [`ARCHITECTURE.md`](ARCHITECTURE.md)       |

Wspieranym artefaktem jest wyłącznie build Chrome w `dist_chrome`. Minimalną
wersję przeglądarki wyznacza `minimum_chrome_version` w `src/manifest.ts`.
Udokumentowana allowlista artefaktu obejmuje wyłącznie:

- `manifest.json` (wygenerowany z `src/manifest.ts`);
- punkty wejścia i chunki skryptów (`service-worker-loader.js`, skrypty background, content scriptu, popupu i opcji);
- szablony HTML punktów wejścia (`src/popup/index.html`, `src/options/index.html`);
- style i fonty (`assets/fonts/*.woff2`);
- ikony produktu (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`, `icon.png`).

Artefakt nie zawiera konfiguracji deweloperskich, testów, mocków ani plików tymczasowych.

## Język i interfejs użytkownika

| Obszar              | Technologia                 | Zastosowanie                                   | Źródło prawdy                                                                                                |
| ------------------- | --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Język               | TypeScript w trybie ścisłym | Kod produkcyjny, konfiguracja buildu i testy   | [`tsconfig.json`](tsconfig.json), [`package.json`](package.json)                                             |
| UI                  | React i React DOM           | Panel boczny oraz strona opcji                 | [`package.json`](package.json), [`src/popup/`](src/popup/), [`src/options/`](src/options/)                   |
| Style               | Tailwind CSS 4              | Klasy narzędziowe i konfiguracja CSS-first     | [`src/assets/styles/index.css`](src/assets/styles/index.css), [`postcss.config.js`](postcss.config.js)       |
| Komponenty i motywy | DaisyUI 5                   | Komponenty oraz motywy `night` i `nord`        | [`src/assets/styles/index.css`](src/assets/styles/index.css)                                                 |
| Izolacja stylów     | Shadow DOM i PostCSS        | Izolacja UI rozszerzenia od CSS strony YouTube | [`src/utils/createShadowRoot.tsx`](src/utils/createShadowRoot.tsx), [`postcss.config.js`](postcss.config.js) |
| Typografia i ikony  | Geist Sans, Phosphor Icons  | Font i ikony interfejsu                        | [`package.json`](package.json), [`src/assets/`](src/assets/)                                                 |

Bootstrap content scriptu jest zwykłym modułem TypeScript bez zależności od
Reacta.

## Build i zależności

| Obszar                      | Technologia           | Zastosowanie                                                             | Źródło prawdy                                                            |
| --------------------------- | --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Środowisko                  | Node.js 20 lub nowszy | Uruchamianie narzędzi projektu                                           | [`package.json`](package.json)                                           |
| Pakiety                     | pnpm                  | Jedyny wspierany menedżer pakietów                                       | [`package.json`](package.json), [`pnpm-lock.yaml`](pnpm-lock.yaml)       |
| Build i serwer deweloperski | Vite                  | Budowanie i lokalna pętla deweloperska                                   | [`vite.config.ts`](vite.config.ts), [`package.json`](package.json)       |
| Integracja rozszerzenia     | CRXJS Vite Plugin     | Generowanie rozszerzenia z typowanego manifestu                          | [`vite.config.ts`](vite.config.ts), [`src/manifest.ts`](src/manifest.ts) |
| Przetwarzanie CSS           | PostCSS               | Tailwind, prefiks selektorów, zamiana `rem` na `px` i prefiksy dostawców | [`postcss.config.js`](postcss.config.js)                                 |

## Testy i jakość

| Obszar                  | Technologia                                        | Zastosowanie                                         | Źródło prawdy                                                                                        |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Test runner             | Vitest                                             | Testy jednostkowe i integracyjne                     | [`vitest.config.ts`](vitest.config.ts)                                                               |
| Testy UI                | React Testing Library, User Event, Jest DOM, jsdom | Testy zachowania widocznego dla użytkownika          | [`package.json`](package.json), [`vitest.setup.ts`](vitest.setup.ts)                                 |
| Coverage                | V8                                                 | Raporty pokrycia kodu                                | [`vitest.config.ts`](vitest.config.ts)                                                               |
| Analiza statyczna       | TypeScript, ESLint                                 | Typy i reguły jakości bez ostrzeżeń                  | [`tsconfig.json`](tsconfig.json), [`.eslintrc.cjs`](.eslintrc.cjs)                                   |
| Formatowanie i pisownia | Prettier, cspell                                   | Spójny zapis kodu i dokumentacji                     | [`.prettierrc`](.prettierrc), [`cspell.config.yaml`](cspell.config.yaml)                             |
| Hooki Git               | Husky, lint-staged, commitlint                     | Kontrole plików staged i Conventional Commits        | [`.husky/`](.husky/), [`package.json`](package.json), [`commitlint.config.js`](commitlint.config.js) |
| CI                      | GitHub Actions                                     | Uruchamianie `pnpm check` dla zmian i gałęzi głównej | [`.github/workflows/quality.yml`](.github/workflows/quality.yml)                                     |

Procedurę doboru testów i wymagane progi opisuje
[`.agents/rules/testing.md`](.agents/rules/testing.md). Pełną bramką repozytorium
pozostaje skrypt `check` z `package.json`.

## Integracje zewnętrzne

| Integracja                 | Sposób użycia                                             | Źródło prawdy                                                  |
| -------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| Gemini, OpenAI i Anthropic | Bezpośrednie żądania z panelu przez adaptery Dostawców AI | [`src/llm/`](src/llm/), [`src/manifest.ts`](src/manifest.ts)   |
| `youtube-transcript`       | Pobieranie transkrypcji Filmu                             | [`package.json`](package.json), [`src/content/`](src/content/) |
| `chrome.storage.local`     | Trwałe dane użytkownika                                   | [`src/utils/storage.ts`](src/utils/storage.ts)                 |
| `chrome.storage.session`   | Stan bieżącej sesji panelu                                | [`ARCHITECTURE.md`](ARCHITECTURE.md)                           |

Klucze API i dane potrzebne do wygenerowania odpowiedzi trafiają bezpośrednio
do interfejsu sieciowego wybranego Dostawcy AI. Rozszerzenie nie utrzymuje
własnego serwera pośredniczącego.

## Narzędzia agentów i zarządzanie skillami

| Obszar                | Technologia                        | Zastosowanie                                                           | Źródło prawdy                                                                                                       |
| --------------------- | ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Menedżer pakietów AI  | Agent Package Manager (APM) 0.29.0 | Zarządzanie deklaratywnymi zależnościami skilli dla agentów AI         | [`apm.yml`](apm.yml), [`apm.lock.yaml`](apm.lock.yaml), [ADR-0003](docs/adr/0003-zarzadzanie-skillami-przez-apm.md) |
| Targety dystrybucji   | Claude, Codex, Antigravity         | Środowiska asystentów korzystające z commitowanych skilli projektu     | [`apm.yml`](apm.yml), [`.agents/`](.agents/), [`.claude/`](.claude/)                                                |
| Weryfikacja driftu CI | APM CLI via GitHub Actions         | Niezależny audyt integralności manifestu, lockfile i wdrożonych skilli | [`.github/workflows/apm.yml`](.github/workflows/apm.yml)                                                            |
| Pakiet globalny       | Podpakiet APM `mattpocock-skills`  | Przenośna deklaracja globalnego zestawu skilli użytkownika             | [`packages/mattpocock-skills/`](packages/mattpocock-skills/)                                                        |

### Rola i zasady działania APM

1. **Przypinanie wersji i odtwarzalność**: Wersja narzędzia CLI jest przypięta w CI (`0.29.0` z opcją `setup-only: 'true'` w [`.github/workflows/apm.yml`](.github/workflows/apm.yml)). Manifest projektu [`apm.yml`](apm.yml) deklaruje wymagane zależności skilli, a [`apm.lock.yaml`](apm.lock.yaml) przypina konkretne commity oraz skróty SHA-256 plików. Wygenerowane skille dla obsługiwanych targetów (`.agents/skills`, `.claude/skills`, `.codex`) są commitowane do repozytorium, zapewniając gotowość środowiska zaraz po sklonowaniu bez uruchamiania instalatora. Cache `apm_modules/` jest ignorowany przez Gita.
2. **Wspierane targety i brak translacji semantyki**: APM dystrybuuje identyczne pliki skilli do zadeklarowanych targetów (`antigravity`, `claude`, `codex`). Narzędzie odpowiada za bezpieczną dystrybucję plików i weryfikację ich integralności, lecz nie tłumaczy automatycznie składni ani zachowań specyficznych dla poszczególnych platform (np. specyficznych instrukcji Claude).
3. **Ograniczenie wyszukiwania**: Polecenie `apm search` przeszukuje wyłącznie zarejestrowane repozytoria marketplace (dodane do lokalnego rejestru APM) i nie zastępuje pełnotekstowego wyszukiwania skilli w serwisie GitHub.

## Aktualizacja dokumentu

Aktualizuj tę mapę, gdy zmienia się wspierana platforma, główna technologia,
rola zależności albo plik będący źródłem prawdy. Zmiana samej wersji zależności
wymaga aktualizacji wyłącznie w `package.json` i `pnpm-lock.yaml`, o ile nie
zmienia opisanej tutaj odpowiedzialności lub ograniczenia.
