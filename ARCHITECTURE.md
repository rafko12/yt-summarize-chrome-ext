# Architektura Projektu: YT Summarizer (Rozszerzenie Chrome Manifest V3)

## 1. Ogólny cel i działanie

YT Summarizer to rozszerzenie do przeglądarki Chrome działające w formie **Side Panelu (Panelu bocznego)**. Jego głównym zadaniem jest wspomaganie użytkownika w szybkiej analizie filmów na YouTube. Rozszerzenie automatycznie wykrywa aktualnie odtwarzany film, pobiera jego napisy (transkrypcję), a następnie – przy pomocy zintegrowanych modeli AI (Gemini, OpenAI, Claude) – generuje zwięzłe podsumowania oraz umożliwia interaktywny czat na temat zawartości wideo.

## 2. Drzewo plików (File Structure)

Oto najważniejsze pliki w projekcie wraz z krótkim opisem ich odpowiedzialności:

- **`src/background/index.ts`** – Skrypt działający w tle (Service Worker), zarządzający cyklem życia Side Panelu, jego przypinaniem (globalnie lub per-karta) oraz nasłuchujący zmian URL w celu wykrycia nawigacji na YouTube.
- **`src/content/Content.tsx`** – Skrypt wstrzykiwany do strony YouTube (Content Script), odpowiedzialny za ekstrakcję metadanych filmu (`ytInitialPlayerResponse`), przewijanie wideo oraz pobieranie transkrypcji.
- **`src/popup/Popup.tsx`** – Główny plik interfejsu użytkownika Side Panelu (ogromny komponent React), integrujący widoki analizy, historii i ustawień oraz logikę stanu.
- **`src/utils/gemini.ts`** – Mimo nazwy "gemini", plik ten to uniwersalny dyspozytor (adapter) do komunikacji z API trzech różnych dostawców LLM: Google Gemini, OpenAI oraz Anthropic Claude.
- **`src/utils/storage.ts`** – Zestaw funkcji pomocniczych do zarządzania lokalną bazą danych (opartą na `chrome.storage.local`), obsługujących zapis kluczy API, ustawień, historii i stanu przypięcia panelu.
- **`src/utils/prompts.ts`** – Zbiór zaawansowanych, ustrukturyzowanych promptów systemowych (w języku polskim) definiujących, jak AI ma analizować transkrypcje i odpowiadać użytkownikowi.
- **`src/manifest.ts`** – Dynamicznie generowany plik konfiguracyjny (Manifest V3) definiujący uprawnienia i punkty wejścia rozszerzenia.
- **`vite.config.ts`** – Konfiguracja środowiska budowania (Vite) używająca `@crxjs/vite-plugin` do płynnego budowania rozszerzenia z Hot Module Replacement (HMR).

## 3. Przepływ komunikacji (Communication Flow)

Architektura komunikacji rozszerzenia opiera się na wymianie wiadomości między izolowanymi środowiskami (Background, Content Script, Side Panel):

1. **Wykrywanie zmian (Background -> Side Panel):** `background/index.ts` nasłuchuje zdarzeń `chrome.tabs.onUpdated`. Kiedy użytkownik wejdzie na film YouTube, background wysyła wiadomość `YOUTUBE_URL_UPDATED`, co informuje Side Panel, aby odświeżył widok.
2. **Pobieranie danych wideo (Side Panel -> Content Script):** `Popup.tsx` za pomocą `chrome.tabs.sendMessage` wysyła prośby `GET_VIDEO_DATA` i `GET_TRANSCRIPT` do skryptu wstrzykniętego (Content Script).
3. **Ekstrakcja (Content Script -> YouTube DOM):** Content Script analizuje drzewo DOM (lub natywny HTML strony) za pomocą wyrażeń regularnych w poszukiwaniu globalnego obiektu `ytInitialPlayerResponse`, z którego wyciąga ID filmu i metadane. Korzysta też z zewnętrznej paczki `youtube-transcript`. Następnie zwraca zebrane dane do Side Panelu.
4. **Zarządzanie stanem okna (Side Panel <-> Background):** Kiedy użytkownik chce przypiąć panel (`PIN_GLOBAL`), `Popup.tsx` wysyła żądanie do Background Scriptu, który za pomocą API Chrome odpowiednio zarządza opcjami `chrome.sidePanel`.
5. **Zapytania do AI (Side Panel -> Internet):** Plik `gemini.ts` bezpośrednio z kontekstu Side Panelu wysyła asynchroniczne żądania HTTP (fetch) do zewnętrznych serwerów API (Google, OpenAI, Anthropic), a odpowiedź wraca wprost do UI.

## 4. Wykryty bałagan i dług technologiczny

Podczas głębokiej analizy zidentyfikowano następujące obszary wymagające poprawy z punktu widzenia jakości kodu (Technical Debt):

- **Gigantyczny komponent (God Object):** Plik `src/popup/Popup.tsx` liczy ponad 1400 linii i zawiera praktycznie całą aplikację: stan, zarządzanie widokami (routing), obsługę zapytań do AI, zarządzanie pamięcią i renderowanie wszystkich zakładek. Jest to skrajne naruszenie zasady jednej odpowiedzialności (Single Responsibility Principle). Komponent ten powinien zostać rozbity na mniejsze, niezależne części (np. `ChatView`, `HistoryView`, `SettingsView`).
- **Mylące nazewnictwo i brak separacji:** Plik `src/utils/gemini.ts` sugeruje, że obsługuje tylko Gemini, tymczasem zawiera logikę również dla OpenAI i Claude. Powinien zostać przemianowany np. na `providers.ts` lub `llm.ts`.
- **Użycie Reacta tam, gdzie nie jest to potrzebne:** W `src/content/Content.tsx` zdefiniowano komponent Reactowy (zwracający `null`), wewnątrz którego użyto hooka `useEffect` wyłącznie po to, by podpiąć się pod nasłuchiwanie `chrome.runtime.onMessage`. Content Script nie ma tutaj żadnego interfejsu (UI) renderowanego w Shadow DOM, więc opakowywanie logiki imperatywnej w komponent Reacta dodaje zupełnie zbędny narzut wydajnościowy i pojęciowy.
- **Niestabilna ekstrakcja JSON z HTML:** Skrypt wyciągający informacje o filmie parsuje kod za pomocą wyrażenia `ytInitialPlayerResponse\s*=\s*\{`. Jest to podejście bardzo kruche – jakakolwiek zmiana minifikacji kodu przez inżynierów YouTube może zepsuć działanie tej funkcji.
- **Niekonsekwentne stosowanie Polyfillów:** Projekt ma w zależnościach `webextension-polyfill` (który pozwala na używanie Promises i ujednolica API przeglądarek pod przestrzeń `browser.*`), ale w całym kodzie źródłowym nagminnie używane jest natywne api `chrome.*` (np. `chrome.storage.local`, `chrome.tabs`). Jest to niespójność stylistyczna.
- **Mieszanie stanu:** Background script w dziwny sposób żongluje stanem pomiędzy `chrome.storage.session` a `chrome.storage.local` podczas synchronizowania tego, które panele są aktualnie otwarte, co może prowadzić do nieprzewidywalnych błędów stanu rozszerzenia.

## 5. Zależności (Dependencies)

- **Języki:** TypeScript, HTML, CSS.
- **Główny Framework:** React 19 (Hooks).
- **Ekosystem / Build Tools:** Vite 6, `@crxjs/vite-plugin` (dynamiczne tworzenie Manifest V3), pnpm.
- **Styling:** Tailwind CSS v4, DaisyUI 5, PostCSS (zgodnie z regułami, DaisyUI poprawnie zintegrowane przez `@plugin "daisyui"`).
- **Kluczowe Biblioteki:**
  - `youtube-transcript`: do omijania mechanizmów i pobierania surowych napisów.
  - `@phosphor-icons/react`: biblioteka ikon wektorowych.
  - `webextension-polyfill`: oficjalny polyfill do rozszerzeń.
  - Własne adaptery dla REST API (Gemini, OpenAI, Claude - wbudowane w kod).
