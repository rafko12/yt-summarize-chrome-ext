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
- `chromeSidePanelAdapter.ts` jest adapterem interfejsów `chrome.sidePanel`, `chrome.tabs`, `chrome.runtime` i `chrome.storage`.
- `youtubeNavigationEvents.ts` pozostaje niezależnym przepływem powiadomień `YOUTUBE_URL_UPDATED`.

Sterownik panelu i adapter Chrome realizują decyzję z [ADR-0002](docs/adr/0002-sterownik-stanu-panelu-z-adapterem-chrome.md).

### Content script

`src/content/` działa na stronach YouTube. Odpowiada za:

- odczyt metadanych bieżącego Filmu;
- pobranie transkrypcji;
- przesunięcie odtwarzacza do wskazanego czasu;
- obsługę wiadomości wysłanych z panelu.

`playerResponseExtractor.ts` izoluje parsowanie `ytInitialPlayerResponse` i jest testowany na zapisanych przykładach HTML. Bootstrap content scriptu (`youtubeContentScript.ts`) i jego punkt wejścia (`index.ts`) są zwykłymi modułami TypeScript bez zależności od Reacta.

### Panel boczny

`src/sidepanel/` jest aplikacją React obsługującą analizę, Historię analiz i ustawienia.

- `SidePanelApp.tsx` składa widoki i hooki jako composition root panelu.
- `analysisSession/` zarządza stanem analizy przez reducer (`analysisSessionReducer.ts`) oraz orkiestrację przepływu analizy (`useAnalysisSession.ts`).
- `youtube/` integruje dostęp do aktywnego Filmu YouTube, ukrywając odczyt karty, messaging z ponawianiem i wstrzykiwaniem skryptu oraz fallback metadanych za jednym interfejsem publicznym (`youtube.ts`) z adapterem Chrome (`chromeYoutubeAdapter.ts`).
- `ai/` integruje Dostawców AI: wspólnego klienta (`client.ts`), rejestr modeli i dostawców (`registry.ts`), politykę modeli (`modelPolicy.ts`), prompty (`prompts.ts`), typy (`types.ts`) oraz adaptery Gemini, OpenAI i Anthropic (`providers/`).
- `chromeBackgroundTransport.ts` realizuje transport wiadomości z panelu do background service workera.
- `hooks/` obsługuje ustawienia (`useSettings.ts`) oraz Historię analiz (`useHistory.ts`).
- `components/` renderuje widoki bez przejmowania integracji z Chrome lub Dostawcami AI.

Panel komunikuje się ze skryptem treści przez moduł integracji YouTube (`src/sidepanel/youtube/`), a z backgroundem przez transport panelu `src/sidepanel/chromeBackgroundTransport.ts`. Żądania do Dostawców AI są wykonywane bezpośrednio z panelu przez klienta `src/sidepanel/ai/client.ts`; przeniesienie ich do backgroundu nie należy do neutralnego funkcjonalnie refaktoru.

### Strona opcji

`src/options/` jest osobnym punktem wejścia React (`Options.tsx`). Nie współdzieli stanu renderowania z panelem bocznym.

## Moduły współdzielone

- `src/shared/messages.ts` — typy wiadomości, odpowiedzi i ich walidacja.
- `src/shared/video.ts` — współdzielone typy Filmu.
- `src/preferences/` — operacje na preferencjach użytkownika, kluczach API, motywie i ustawieniach (`userPreferences.ts`) z adapterem Chrome (`chromePreferencesPlatform.ts`).
- `src/analysisHistory/` — operacje wysokiego poziomu na Historii analiz i Zapisach analiz (`analysisHistory.ts`) z adapterem Chrome (`chromeAnalysisHistoryPlatform.ts`).
- `src/utils/storage.ts` — fasada zgodności wstecznej dla storage.
- `src/utils/createShadowRoot.tsx` — tworzenie izolowanego korzenia UI.
- `src/assets/` — style i fonty (`geistFonts.ts`).

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
