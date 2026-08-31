# Architektura YT Summarizer

## Cel systemu

YT Summarizer jest rozszerzeniem Manifest V3 dla Google Chrome. Pozwala pobrać transkrypcję filmu z YouTube, wygenerować podsumowanie przy użyciu wybranego Dostawcy AI oraz prowadzić rozmowę dotyczącą filmu. Kanoniczne pojęcia domenowe definiuje [`CONTEXT.md`](CONTEXT.md).

Projekt jest Chrome-only. Uzasadnienie znajduje się w [ADR-0001](docs/adr/0001-google-chrome-jako-jedyna-wspierana-przegladarka.md).
Technologie, ich role i pliki konfiguracyjne mapuje [`TECH_STACK.md`](TECH_STACK.md).

## Konteksty wykonania

### Background service worker

`src/background/` zarządza cyklem życia panelu bocznego oraz powiadamia panel o zmianach adresu filmu.

- `index.ts` uruchamia moduły background.
- `sidePanelController.ts` ukrywa stan panelu, odtwarzanie, kolejność operacji i kompensacje.
- `chromeSidePanelPlatform.ts` jest adapterem interfejsów `chrome.sidePanel`, `chrome.tabs`, `chrome.runtime` i `chrome.storage`.
- `youtubeUrlUpdates.ts` pozostaje niezależnym przepływem powiadomień `YOUTUBE_URL_UPDATED`.

Sterownik panelu i adapter Chrome realizują decyzję z [ADR-0002](docs/adr/0002-sterownik-stanu-panelu-z-adapterem-chrome.md).

### Content script

`src/content/` działa na stronach YouTube. Odpowiada za:

- odczyt metadanych bieżącego Filmu;
- pobranie transkrypcji;
- przesunięcie odtwarzacza do wskazanego czasu;
- obsługę wiadomości wysłanych z panelu.

`playerResponseExtractor.ts` izoluje parsowanie `ytInitialPlayerResponse` i jest testowany na zapisanych przykładach HTML. Bootstrap content scriptu jest zwykłym modułem TypeScript bez zależności od Reacta.

### Panel boczny

`src/popup/` jest aplikacją React obsługującą analizę, Historię analiz i ustawienia.

- `PopupContainer.tsx` składa widoki i hooki.
- `hooks/` obsługuje ustawienia, Historię analiz, dane Filmu oraz przepływy LLM.
- `components/` renderuje widoki bez przejmowania integracji z Chrome lub Dostawcami AI.

Panel komunikuje się ze skryptem treści i backgroundem przez wiadomości Chrome. Żądania do Dostawców AI są wykonywane bezpośrednio z panelu; przeniesienie ich do backgroundu nie należy do neutralnego funkcjonalnie refaktoru.

### Strona opcji

`src/options/` jest osobnym punktem wejścia React. Nie współdzieli stanu renderowania z panelem bocznym.

## Moduły współdzielone

- `src/shared/messages.ts` — typy wiadomości, odpowiedzi i ich walidacja; transport i retry mają docelowo zostać wydzielone zgodnie z planem refaktoru.
- `src/shared/video.ts` — współdzielone typy Filmu.
- `src/llm/` — wspólny klient i adaptery Gemini, OpenAI oraz Anthropic.
- `src/utils/storage.ts` — stabilne klucze, walidacja i operacje na danych użytkownika.
- `src/utils/prompts.ts` — treść promptów analizy i rozmowy.
- `src/utils/createShadowRoot.tsx` — tworzenie izolowanego korzenia UI.
- `src/assets/` — style i fonty.

## Przepływy danych

### Analiza Filmu

```text
Panel boczny
  -> wiadomość Chrome
Content script
  -> YouTube / youtube-transcript
Content script
  -> metadane i transkrypcja
Panel boczny
  -> wybrany Dostawca AI
Panel boczny
  -> podsumowanie lub rozmowa
```

### Stan panelu

```text
Zdarzenia Chrome
  -> adapter Chrome
Sterownik panelu
  -> decyzja i aktualizacja stanu
Adapter Chrome
  -> sidePanel / tabs / storage
```

### Dane użytkownika

`chrome.storage.local` przechowuje klucze API, ustawienia, Historię analiz, motyw i stan przypięcia. `chrome.storage.session` przechowuje identyfikatory kart z lokalnie otwartym panelem. Nazwy kluczy w `STORAGE_KEYS` są kontraktem kompatybilności.

## Reguły zależności

- Manifest i uprawnienia mają jedno źródło prawdy w `src/manifest.ts`.
- Widoki nie wykonują bezpośrednio operacji platformowych, jeśli istnieje moduł posiadający tę odpowiedzialność.
- Kontrakty wiadomości pozostają niezależne od transportu Chrome.
- Adaptery Dostawców AI ukrywają różnice protokołów za wspólnym klientem.
- Szew zewnętrzny ma adapter produkcyjny i kontrolowany adapter testowy.
- Dzielimy według odpowiedzialności i szwów, nie według arbitralnej liczby linii.
- Nowa zależność produkcyjna wymaga przewagi, której nie da się uzyskać małym modułem własnym.

## Weryfikacja

Automatyczne i manualne zasady testowania definiują [`.agents/rules/testing.md`](.agents/rules/testing.md) oraz [lista kontrolna regresji](docs/manual-regression-checklist.md). Kolejność refaktoru i kryteria ukończenia znajdują się w [`REFACTOR.md`](REFACTOR.md).
