# Reguły projektu (Workspace Rules)

## Reguły zawsze obowiązujące

- Odpowiadaj po polsku.
- Projekt wspiera wyłącznie Google Chrome w wersji zgodnej z `minimum_chrome_version` w `src/manifest.ts`.
- Używaj wyłącznie `pnpm` i Node.js 20 lub nowszego.
- Zarządzaj manifestem wyłącznie przez `src/manifest.ts`.
- Trwałe dane użytkownika zapisuj przez moduły storage oparte na `chrome.storage.local`. Stan bieżącej sesji panelu może korzystać z `chrome.storage.session`.
- Tematy DaisyUI konfiguruj w głównym pliku CSS przez `@plugin "daisyui"`, nie w `tailwind.config.js`.
- Listener `chrome.runtime.onMessage.addListener`, który zwraca wartość tylko dla części wiadomości, musi kończyć się jawnym `return false;`.
- Zachowuj istniejące klucze i akceptowane formaty danych. Zmiana formatu wymaga bezstratnej, wersjonowanej migracji i testu kompatybilności.
- Commity, jeśli użytkownik ich zażąda, muszą spełniać Conventional Commits.

## Bramka jakości

Po zmianie uruchom bramki proporcjonalne do zakresu. Pełna bramka repozytorium to:

```bash
pnpm check
```

Polecenie obejmuje Prettier, ESLint bez ostrzeżeń, TypeScript, cspell, coverage, testy i build Chrome.

## Dokumentacja kontekstowa

- Terminologia domenowa: przeczytaj [`CONTEXT.md`](CONTEXT.md) przed zmianą nazw lub modelu domeny.
- Decyzje architektoniczne: przeczytaj odpowiednie pliki w [`docs/adr/`](docs/adr/).
- Architektura i odpowiedzialności modułów: przeczytaj [`ARCHITECTURE.md`](ARCHITECTURE.md) oraz [`.agents/rules/architecture.md`](.agents/rules/architecture.md), gdy zmieniasz strukturę, manifest, komunikację, storage albo kontekst wykonania.
- Refaktor: przeczytaj [`REFACTOR.md`](REFACTOR.md) przed pracą nad zatwierdzonym planem. Refaktor ma zachować faktyczne zachowanie bieżącej wersji Chrome.
- Testowanie: przeczytaj [`.agents/rules/testing.md`](.agents/rules/testing.md) przed dodaniem lub zmianą testów.
- Panel boczny: przeczytaj [`.agents/rules/sidepanel.md`](.agents/rules/sidepanel.md) przed zmianą cyklu życia, przypinania lub layoutu panelu.
- Issue tracker i triage: procedury znajdują się w [`docs/agents/`](docs/agents/).

## Agent skills

### Issue tracker

Zgłoszenia i specyfikacje są prowadzone w GitHub Issues repozytorium `rafko12/yt-summarize-chrome-ext`. Zobacz `docs/agents/issue-tracker.md`.

### Triage labels

Stosowane są domyślne etykiety triage. Zobacz `docs/agents/triage-labels.md`.

### Domain docs

Projekt ma układ single-context. Zobacz `docs/agents/domain.md`.
