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

`playerResponseExtractor.ts` ekstrahuje metadane z `ytInitialPlayerResponse` i jest testowany na zapisanych przykładach HTML. Bootstrap content scriptu (`youtubeContentScript.ts`) i jego punkt wejścia (`index.ts`) są zwykłymi modułami TypeScript bez zależności od Reacta. Content script nie renderuje żadnego interfejsu użytkownika (UI) w DOM YouTube, w związku z czym architektura nie deklaruje ani nie stosuje izolacji stylów (Shadow DOM ani prefiksów CSS) od CSS YouTube.

### Panel boczny

`src/sidepanel/` jest aplikacją React montowaną bezpośrednio w kontenerze `#my-ext-sidepanel-page` własnego dokumentu HTML panelu (`src/sidepanel/index.html`), bez użycia Shadow DOM ani izolacji stylów. Obsługuje analizę, Historię analiz i settings.

- `compositionRoot.ts` jest jedynym jawnym composition root panelu bocznego (`SidePanelDependencies`), tworzącym i składającym wszystkie zależności panelu: runtime panelu (`PanelRuntime`), pojedynczy współdzielony adapter lokalnego storage (`StorageAdapter`), settings (`UserPreferencesStore`), Historię analiz (`AnalysisHistory`), most YouTube (`YoutubeBridge`) oraz klienta AI (`AiClient`). Produkcja i testy przekazują zależności przez ten sam interfejs.
- `SidePanelApp.tsx` składa widoki i hooki w oparciu o jawnie wstrzyknięty zestaw zależności (`SidePanelDependencies`).
- `shell/` integruje powłokę i nagłówek panelu (`Header.tsx`) oraz synchronizację motywu dokumentu (`useDocumentTheme.ts`) w oparciu o kontrakt `PanelTheme` (`theme.ts`).
- `analysis/` integruje widoki analizy (`AnalyzeView.tsx`, `SummaryView.tsx`), prezentacyjny renderer Markdown z timestampami (`MarkdownWithTimestamps.tsx`), parser timestampów (`timestampParser.ts`), stan analizy przez reducer (`analysisSessionReducer.ts`) oraz orkiestrację przepływu analizy (`useAnalysisSession.ts`). Widok analizy otrzymuje wyłącznie docelowy język i callback `onOpenSettings`, bez bezpośrednich zależności od typów shella ani settings. Renderer timestampów nie tworzy adaptera Chrome — otrzymuje jawny callback `onSeek` z orkiestracji sesji. Przewijanie rozmowy jest efektem widoku `AnalyzeView`, nie orkiestracji sesji.
- `youtube/` integruje dostęp do aktywnego Filmu YouTube, ukrywając odczyt karty, messaging z ponawianiem i wstrzykiwaniem skryptu oraz fallback metadanych za jednym interfejsem publicznym mostu YouTube (`youtube.ts`, `YoutubeBridge`) wymagającym jawnego adaptera (`YoutubeAdapter`), tworzonego produkcyjnie w composition root (`chromeYoutubeAdapter.ts`).
- `ai/` integruje Dostawców AI: wspólnego klienta (`client.ts`), katalog Modeli AI (`modelCatalog.ts`), politykę Modeli AI (`modelPolicy.ts`), prompty (`prompts.ts`), kontrakt adapterów (`providerContract.ts`) oraz adaptery Gemini, OpenAI i Anthropic (`providers/`).
- `history/` integruje Historię analiz i Zapisy analiz: widok (`HistoryView.tsx`), hook (`useAnalysisHistory.ts`), typy (`types.ts`) oraz operacje persistence (`analysisHistory.ts`) bezpośrednio przez wspólny adapter storage. Zapis analizy (`AnalysisRecord`) posiada wyłącznie znacznik czasu utworzenia `createdAt`. Operacja zapisu rozmowy (`saveChat`) zachowuje istniejący `createdAt`, zachowuje pozycję w kolekcji i nie posiada pola `updatedAt`.
- `settings/` integruje ustawienia użytkownika, klucze API Dostawców AI, motyw, język, model oraz konfigurację: widok (`SettingsView.tsx`), hook (`useSettings.ts`), typy (`types.ts`), operacje persistence preferencji użytkownika (`userPreferencesStore.ts`) bezpośrednio przez wspólny adapter storage oraz przypadek użycia czyszczenia danych użytkownika (`clearUserData.ts`). Moduł korzysta ze wspólnego kontraktu `PanelTheme` (`theme.ts`). Synchronizacja motywu dokumentu HTML należy do shella (`useDocumentTheme`), nie do feature settings.
- `runtime/` integruje szew pomiędzy panelem a hostem Chrome (`PanelRuntime`): pobieranie kontekstu karty i okna, start panelu w tle (`PANEL_INIT`), globalne przypinanie oraz subskrypcję notyfikacji panelu z adapterem produkcyjnym (`chromePanelRuntime.ts`) i kontrolowanym adapterem testowym (`controlledPanelRuntime.ts`).

Panel komunikuje się ze skryptem treści przez most YouTube (`src/sidepanel/youtube/`), a z backgroundem przez jednolity runtime panelu (`src/sidepanel/runtime/`). Odpowiada to jednemu runtime panelu zamiast dawnym osobnym modułom kontekstu i komunikacji; panel nie posiada osobnego modułu kontekstu karty ani odrębnego transportu wiadomości poza mostem YouTube i runtime panelu. Żądania do Dostawców AI są wykonywane bezpośrednio z panelu przez klienta `src/sidepanel/ai/client.ts`; przeniesienie ich do backgroundu nie należy do neutralnego funkcjonalnie refaktoru.

### Strona opcji

`src/options/` jest osobnym punktem wejścia React (`OptionsInfoPage.tsx`), montowanym bezpośrednio w kontenerze `#my-ext-options-page` dokumentu strony opcji (`src/options/index.html`) bez użycia Shadow DOM ani izolacji stylów. Nie współdzieli stanu renderowania z panelem bocznym.

## Moduły współdzielone

- `src/domain/analysis.ts` — kanoniczne typy domeny analizy (Film, segment transkrypcji, wiadomość rozmowy `ConversationMessage`, Zapis analizy `AnalysisRecord` posiadający wyłącznie `createdAt`, bez pola `updatedAt`).
- `src/messaging/` — czyste kontrakty wiadomości, odpowiedzi i ich walidatory (`contracts.ts`, `index.ts`).
- `src/storage/` — kanoniczne źródło stabilnych kluczy storage (`keys.ts`), kontrakt storage (`storageAdapter.ts`) oraz jedyny wspólny adapter `chrome.storage.local` (`chromeStorageLocalAdapter.ts`).
- `src/assets/` — style i fonty (`loadGeistFonts.ts`).

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

`chrome.storage.local` przechowuje klucze API, ustawienia, Historię analiz, motyw i stan przypięcia. `chrome.storage.session` przechowuje identyfikatory kart z lokalnie otwartym panelem. Nazwy kluczy w `STORAGE_KEYS` są kontraktem kompatybilności. Zapis rozmowy w Historii analiz aktualizuje wyłącznie pole `chat` i nie posiada pola `updatedAt`.

## Reguły zależności

- Manifest i uprawnienia mają jedno źródło prawdy w `src/manifest.ts`.
- Panel boczny posiada jeden jawny composition root (`src/sidepanel/compositionRoot.ts`), który obejmuje runtime panelu (`PanelRuntime`), adapter storage (`StorageAdapter`), settings (`UserPreferencesStore`), Historię analiz (`AnalysisHistory`), most YouTube (`YoutubeBridge`) oraz klienta AI (`AiClient`); produkcja i testy przekazują zależności przez ten sam interfejs (`SidePanelDependencies`).
- Kontrakty domenowe, aplikacyjne, adaptery i moduły storage nie zależą od Reacta; importy biblioteki UI należą wyłącznie do widoków, hooków i punktów montowania.
- Montowanie UI w panelu i na stronie opcji odbywa się bezpośrednio w dokumencie HTML rozszerzenia bez Shadow DOM ani sztucznej izolacji stylów.
- Widoki nie wykonują bezpośrednio operacji platformowych, jeśli istnieje moduł posiadający tę odpowiedzialność.
- Kontrakty wiadomości pozostają niezależne od transportu Chrome.
- Adaptery Dostawców AI ukrywają różnice protokołów za wspólnym klientem.
- Szew zewnętrzny ma adapter produkcyjny i kontrolowany adapter testowy.
- Dzielimy według odpowiedzialności i szwów, nie według arbitralnej liczby linii.
- Nowa zależność produkcyjna wymaga przewagi, której nie da się uzyskać małym modułem własnym.

## Weryfikacja

Automatyczne i manualne zasady testowania definiują [`.agents/rules/testing.md`](.agents/rules/testing.md) oraz [lista kontrolna regresji](docs/manual-regression-checklist.md). Kolejność refaktoru i kryteria ukończenia znajdują się w [`REFACTOR.md`](REFACTOR.md).
