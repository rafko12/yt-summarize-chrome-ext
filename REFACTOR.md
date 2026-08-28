# Plan refaktoru — YT Summarizer

## Status

Plan został zatwierdzony 20 sierpnia 2026 r. Status etapu można zmienić dopiero po przejściu jego automatycznej i manualnej bramki. Sama obecność nowych plików w drzewie roboczym nie oznacza ukończenia etapu.

Bieżące technologie i ich źródła prawdy mapuje [`TECH_STACK.md`](TECH_STACK.md). Ten plan opisuje zamierzone przejścia, dlatego nie należy traktować jego etapów jako opisu już wdrożonego stosu.

## Cel

Zmniejszyć ryzyko regresji i koszt dalszego rozwoju rozszerzenia bez zamierzonych zmian zachowania, wyglądu ani UX. Audyt obejmuje całe repozytorium, lecz zmieniamy wyłącznie kod z mierzalnym problemem: pomieszanymi odpowiedzialnościami, duplikacją, niejawnym stanem, słabą testowalnością albo niebezpieczną zależnością.

## Ograniczenia

- Wspieramy wyłącznie Google Chrome. Zobacz [ADR-0001](docs/adr/0001-google-chrome-jako-jedyna-wspierana-przegladarka.md).
- Zachowujemy istniejące klucze i akceptowane formaty danych użytkownika.
- Żądania LLM i operacje Historii analiz pozostają w panelu.
- Nie dodajemy zależności produkcyjnych bez przewagi niemożliwej do osiągnięcia małym modułem własnym.
- Nie dodajemy funkcji, nie zmieniamy modeli AI, nie projektujemy ponownie UI i nie wykonujemy dużych aktualizacji zależności.
- Dzielimy kod według odpowiedzialności i szwów, nie według arbitralnego limitu linii.

## Źródło zachowania

Faktyczne zachowanie bieżącej wersji w obsługiwanym Chrome jest bazą refaktoru. Przed wydzieleniem logiki dodajemy test charakterystyczny obserwowalnego zachowania. Potwierdzony błąd otrzymuje osobne GitHub Issue i nie jest naprawiany po cichu w refaktorze.

Zatwierdzone szwy i procedurę pionowego testowania definiuje [`.agents/rules/testing.md`](.agents/rules/testing.md).

## Etapy

### 0. Bramka jakości

- skonfigurować coverage i środowisko testów React;
- udostępnić jeden skrypt `pnpm check`;
- uruchamiać tę samą bramkę w GitHub Actions;
- usunąć istniejące rozbieżności formatowania.

**Kryterium:** pełna bramka działa lokalnie i w CI, bez błędów i ostrzeżeń.

### 1. Sterownik panelu bocznego

- opisać testami charakterystycznymi zdarzenia, odtwarzanie stanu, kolejność operacji i błędy;
- wydzielić sterownik instalowany jednym wywołaniem zgodnie z [ADR-0002](docs/adr/0002-sterownik-stanu-panelu-z-adapterem-chrome.md);
- umieścić szczegóły `chrome.*` w adapterze produkcyjnym;
- używać deterministycznego adaptera testowego;
- pozostawić `YOUTUBE_URL_UPDATED` poza sterownikiem.

**Kryterium:** `background/index.ts` jedynie składa moduły, a wszystkie gałęzie sterownika są pokryte testami przez jego interfejs.

### 2. Komunikacja Chrome

- opisać testami rozpoznawanie typów, odpowiedzi, ponawianie i ponowne wstrzyknięcie content scriptu;
- oddzielić czyste kontrakty wiadomości od transportu Chrome;
- zachować treść błędów, opóźnienia i kolejność operacji.

**Kryterium:** kontrakty nie zależą od `chrome.*`, a transport jest testowany przez wysłaną wiadomość i odpowiedź.

### 3. Storage

- opisać testami ustawienia, klucze API, Historię analiz, motyw i stan przypięcia;
- zachować nazwy kluczy oraz akceptowane starsze dane;
- oddzielić walidację i trwałe kontrakty od operacji wysokiego poziomu;
- wprowadzić migrację wyłącznie wtedy, gdy będzie konieczna i bezstratna.

**Kryterium:** dotychczasowe dane można odczytać bez utraty, a caller nie zna szczegółów `chrome.storage`.

### 4. Dostawcy AI

- opisać testami format żądań i parsowanie odpowiedzi każdego Dostawcy AI;
- usunąć duplikację typu dostawcy i mapowania modeli;
- zachować obecne modele domyślne, nawet jeśli test ujawni ich niespójność;
- zgłosić potwierdzoną niespójność jako osobny błąd zamiast zmieniać zachowanie.

**Kryterium:** wspólny klient ukrywa różnice dostawców, a dodanie adaptera nie wymaga zmiany widoków.

### 5. Sesja analizy

- opisać testami zmianę Filmu, generowanie, rozmowę i odtwarzanie Zapisu analizy;
- po poznaniu przejść stanu zdecydować, czy reducer tworzy głębszy moduł;
- usunąć duplikację pobierania aktywnej karty i Historii analiz;
- testować rezultat widoczny dla użytkownika, nie wnętrze hooków.

**Kryterium:** Sesja analizy ma jednego właściciela przejść stanu, a prywatny podział hooków może się zmieniać bez przepisywania testów.

### 6. Content script

- opisać testami wiadomości, transkrypcję, wybór języka oraz przewijanie odtwarzacza;
- zastąpić komponent React, który niczego nie renderuje, zwykłym modułem TypeScript;
- zachować istniejące odpowiedzi i tryby błędów.

**Kryterium:** content script nie uruchamia Reacta i zachowuje obserwowalne działanie.

### 7. Widoki i dostępność

- podzielić duże widoki tylko tam, gdzie rozdziela to odpowiedzialności;
- zachować wygląd, interakcje i jeden główny obszar przewijania;
- wykonać deterministyczny audyt panelu i opcji.

**Kryterium:** brak zamierzonej różnicy wizualnej i poziomego przepełnienia w zatwierdzonej macierzy rozmiarów okna.

### 8. Chrome-only i dokumentacja końcowa

- usunąć konfigurację Firefoksa i deklaracje `webextension-polyfill`;
- zaktualizować architekturę oraz reguły agentów do końcowego kodu;
- wykonać pełną [manualną listę kontrolną regresji](docs/manual-regression-checklist.md).

**Kryterium:** repozytorium buduje jeden wariant Chrome, a dokumentacja opisuje zweryfikowany kod.

## Bramka każdego etapu

```bash
pnpm check
```

Skrypt uruchamia kolejno:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm lint:spell
pnpm test:coverage
pnpm build
```

Pełną manualną macierz zawiera [`docs/manual-regression-checklist.md`](docs/manual-regression-checklist.md). Testy z rzeczywistymi kluczami wykonuje właściciel projektu bez udostępniania sekretów agentowi.

## Definicja zakończenia

Refaktor jest ukończony, gdy każdy etap spełnia kryterium, pełna bramka jest zielona, dokumentacja odpowiada kodowi, dane użytkowników pozostają kompatybilne, UI i zachowanie nie zmieniły się celowo, a potwierdzone błędy spoza zakresu mają osobne zgłoszenia.
