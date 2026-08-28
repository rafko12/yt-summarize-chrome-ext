---
description: 'Read before adding tests, changing behavior, refactoring a seam, running coverage, or auditing extension UI.'
globs: '*'
---

# Testowanie

## Automatyczna bramka

Pełną bramkę uruchamia:

```bash
pnpm check
```

Składają się na nią Prettier, ESLint bez ostrzeżeń, TypeScript, cspell, Vitest z coverage oraz build Chrome. Do krótszej pętli używaj `pnpm test` albo testu wskazanego pliku, ale przed zakończeniem etapu uruchom pełną bramkę.

Mapę narzędzi testowych i ich pliki źródłowe zawiera
[`../../TECH_STACK.md`](../../TECH_STACK.md). Domyślne środowisko Vitest to
Node; testy UI mogą wybrać jsdom. Wspólne przygotowanie znajduje się w
`vitest.setup.ts`.

## Zatwierdzone szwy

Testuj zachowanie przez interfejs używany przez kod produkcyjny:

1. panel boczny — instalacja sterownika z kontrolowanym adapterem Chrome;
2. storage — operacje wysokiego poziomu, np. zapis analizy albo odczyt ustawień;
3. komunikacja — wysłana wiadomość i otrzymana odpowiedź;
4. Dostawcy AI — wspólny klient LLM z kontrolowanym adapterem `fetch`;
5. YouTube — wiadomości content scriptu i zapisane przykłady HTML;
6. popup — działanie użytkownika i widoczny rezultat.

Mockuj wyłącznie granice zewnętrzne: Chrome, sieć i DOM YouTube. Nie mockuj prywatnych modułów ani nie testuj wnętrza hooków. Oczekiwane wartości mają pochodzić ze specyfikacji albo znanego przykładu, nie z powtórzenia algorytmu implementacji.

## Refaktor zachowujący zachowanie

Pracuj pionowym fragmentem:

1. dodaj test charakterystyczny obserwowalnego zachowania;
2. potwierdź, że test reaguje na zmianę tego zachowania;
3. wykonaj minimalne wydzielenie;
4. uruchom test przez ten sam szew;
5. uruchom pełną bramkę etapu.

Jeżeli test potwierdzi błąd, zachowaj bieżące zachowanie w refaktorze i utwórz osobne GitHub Issue zgodnie z `docs/agents/issue-tracker.md`.

## Docelowe coverage

- minimum 80% linii i 75% gałęzi globalnie;
- 100% gałęzi dla sterownika panelu, kontraktów wiadomości, migracji storage i rejestru modeli.

Coverage jest bramką regresji, nie celem samym w sobie. Test musi opisywać istotne zachowanie przez zatwierdzony szew.

## Testy manualne

Pełna procedura znajduje się w [`../../docs/manual-regression-checklist.md`](../../docs/manual-regression-checklist.md).

Dla deterministycznego audytu UI:

1. uruchom `pnpm run build`;
2. wstrzyknij niezbędny mock `chrome` do zbudowanych stron w `dist_chrome`;
3. serwuj `dist_chrome` lokalnie;
4. sprawdź popup w `400×600` i `800×600`, a opcje w `800×600` i `1200×800`;
5. zmierz `document.documentElement.scrollWidth - document.documentElement.clientWidth`; wynik musi wynosić `0`;
6. po audycie uruchom `pnpm run build`, aby odtworzyć czyste artefakty.

Mocki testowe i klucze Dostawców AI nie mogą trafić do artefaktu produkcyjnego.
