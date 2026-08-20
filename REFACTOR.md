# Plan refaktoru — YT Summarizer

## Cel

Zmniejszyć ryzyko regresji i koszt rozwoju rozszerzenia bez zmieniania jego
funkcji widocznych dla użytkownika. Refaktor obejmuje przede wszystkim stan
panelu, komunikację między kontekstami rozszerzenia, integracje LLM i pobieranie
danych z YouTube.

## Zasady realizacji

- Każdy etap kończy się zielonym `pnpm.cmd lint` i `pnpm.cmd build`.
- Zachowujemy obecne dane użytkownika w `chrome.storage.local`; żadnych zmian
  nazw kluczy bez migracji.
- Zmiany wykonujemy małymi PR-ami. PR nie powinien łączyć zmiany struktury z
  nową funkcjonalnością.
- Przed wydzieleniem logiki dodajemy testy jej aktualnego zachowania.

## Stan docelowy

```text
popup/
  hooks/
    useVideoSession.ts       # aktywna karta, dane wideo, transkrypcja
    useSettings.ts           # model, język, klucze API, motyw
    useHistory.ts            # historia sesji i czatu
    useChat.ts               # generowanie podsumowania i rozmowa
  PopupContainer.tsx         # kompozycja widoków
shared/
  messages.ts                # typy request/response popup–content–background
  video.ts                   # VideoSession i funkcje pomocnicze
content/
  playerResponseExtractor.ts # odizolowany ekstraktor danych YouTube
llm/
  types.ts
  providers/
    gemini.ts
    openai.ts
    anthropic.ts
  client.ts                  # wybór providera i wspólna obsługa błędów
```

## Etap 0 — baza bezpieczeństwa zmian

**Szacowany wysiłek: 0.5–1 dzień**

1. Dodać Vitest oraz skrypt `test` do `package.json`.
2. Dodać testy jednostkowe dla:
   - `formatTranscript`, w tym znaczniki czasu powyżej godziny;
   - operacji historii i limitu 50 rekordów;
   - mapowania modelu na dostawcę;
   - parsera znacznika czasu używanego przez `handleTimestampClick`.
3. Skonfigurować mock `chrome.storage`, `chrome.tabs` i `chrome.runtime`.
4. Dodać do CI (jeżeli istnieje) kolejność: lint → test → build.

**Kryterium akceptacji:** testy uruchamiają się lokalnie bez Chrome, a bieżące
zachowanie funkcji objętych testami jest zachowane.

## Etap 1 — kontrakty komunikacji rozszerzenia

**Szacowany wysiłek: 1 dzień**

1. Utworzyć `src/shared/messages.ts` z unionami dla komunikatów:
   `GET_VIDEO_DATA`, `GET_TRANSCRIPT`, `SEEK_TO`, `PANEL_INIT`, `PIN_GLOBAL`
   i `YOUTUBE_URL_UPDATED`.
2. Zdefiniować typy odpowiedzi (`VideoDataResponse`, `TranscriptResponse`,
   `SuccessResponse`, `ErrorResponse`) oraz type guard `isErrorResponse`.
3. Zastąpić `any` w `Content.tsx` i rzutowania `unknown` w `usePopupState.ts`.
4. Wydzielić cienki wrapper dla `chrome.tabs.sendMessage`, aby centralnie
   obsługiwać błąd braku content scriptu i wstrzyknięcie skryptu.

**Kryterium akceptacji:** brak `any` w obsłudze komunikatów, a komunikaty są
typowane po obu stronach kanału.

## Etap 2 — rozbicie stanu side panelu

**Szacowany wysiłek: 2–3 dni**

Kolejność wydzielania z `src/popup/usePopupState.ts`:

1. `useSettings` — klucze API, dostawca, model, język i motyw.
2. `useHistory` — ładowanie, zapis, usuwanie, czyszczenie oraz odtwarzanie
   sesji historii.
3. `useVideoSession` — aktywna karta, rozpoznawanie filmu, pobranie
   transkrypcji i reset sesji przy zmianie filmu.
4. `useChat` — generowanie podsumowania, czat, stan ładowania i zapis wyniku
   do historii.
5. Pozostawić w `usePopupState` tylko kompozycję hooków lub usunąć go, gdy
   `PopupContainer` może łączyć ich publiczne interfejsy czytelniej.

W trakcie etapu należy:

- wprowadzić wspólny typ `VideoSession` zamiast powtarzanych anonimowych
  obiektów metadanych filmu;
- wyodrębnić funkcję `resetAnalysisState`;
- wyeliminować duplikację pobierania aktywnej karty i fallbacków metadanych;
- użyć stabilnych callbacków tam, gdzie hooki rejestrują listenery Chrome.

**Kryterium akceptacji:** żaden hook nie przekracza około 250 linii, a
`PopupContainer` nie zawiera logiki domenowej.

## Etap 3 — adaptery dostawców LLM

**Szacowany wysiłek: 1–2 dni**

1. Przenieść typy `TranscriptItem`, `ChatMessage` i wspólny interfejs
   `LlmProvider` do `src/llm/types.ts`.
2. Rozdzielić `aiClient.ts` na trzy adaptery HTTP i `client.ts` wybierający
   dostawcę na podstawie jawnej konfiguracji modelu.
3. Wprowadzić wspólny typ błędu (`LlmRequestError`) zawierający dostawcę,
   status HTTP i bezpieczny komunikat dla UI.
4. Usunąć teksty zakładające Gemini z przepływów wspólnych dla wszystkich
   dostawców (np. komunikaty ładowania i etykiety czatu).
5. Przetestować serializowane requesty i mapowanie odpowiedzi każdego adaptera
   przez mock `fetch`.

**Kryterium akceptacji:** dodanie nowego dostawcy wymaga nowego adaptera,
rejestracji i testów, bez modyfikowania komponentów UI.

## Etap 4 — odporne pobieranie danych z YouTube

**Szacowany wysiłek: 1–2 dni**

1. Przenieść ekstrakcję `ytInitialPlayerResponse` do
   `src/content/playerResponseExtractor.ts`.
2. Napisać parser skanujący JSON ze stanem dla stringów, escape’ów i zagnieżdżeń
   albo zastąpić parsowanie HTML stabilniejszym źródłem danych dostępnych na
   stronie.
3. Dodać fixture’y: poprawna odpowiedź, nawias klamrowy w stringu, escape,
   niepełny JSON, niepasujące `videoId` oraz brak napisów.
4. Zachować obecny fallback do `YoutubeTranscript.fetchTranscript(videoId)`.

**Kryterium akceptacji:** parser nie kończy obiektu na `}` występującym w
łańcuchu JSON, a błędy są prezentowane użytkownikowi w zrozumiały sposób.

## Etap 5 — storage, zależności i build

**Szacowany wysiłek: 0.5–1 dzień**

1. Wydzielić nazwy kluczy storage do eksportowanego kontraktu i dodać walidację
   danych odczytanych ze storage.
2. Udokumentować, że klucze API są przechowywane lokalnie w profilu przeglądarki;
   dodać kontrolę usuwania wszystkich kluczy i historii.
3. Zdecydować o `webextension-polyfill`: konsekwentna migracja do `browser.*`
   albo usunięcie nieużywanej zależności.
4. Poprawić rozwiązywanie fontów Geist i potwierdzić ich ładowanie z
   `dist_chrome` w Chrome.
5. Ustalić, czy `dist_chrome` jest artefaktem wydania. Jeżeli tak, generować go
   wyłącznie w buildzie/release, zamiast ręcznie go edytować.

**Kryterium akceptacji:** build nie emituje ostrzeżeń o nierozwiązanych fontach,
a zasady przechowywania danych są opisane w README.

## Kolejność wdrożenia i zależności

```text
Etap 0 ──┬── Etap 1 ── Etap 2 ── Etap 3
          └── Etap 4
Etap 3 + Etap 4 ── Etap 5
```

Etapy 1 i 4 mogą być realizowane równolegle po ukończeniu testowej bazy z etapu 0. Etap 2 powinien korzystać z typów komunikatów wprowadzonych w etapie 1.

## Ryzyka i kontrola regresji

- **Migracja stanu:** nie zmieniać istniejących kluczy storage bez wersjonowanej
  migracji i testu danych historycznych.
- **Asynchroniczność:** po każdej zmianie ręcznie sprawdzić zmianę filmu podczas
  generowania podsumowania oraz wysłanie czatu bez wcześniejszego podsumowania.
- **YouTube:** wykonywać smoke test na filmie z napisami PL, tylko EN oraz bez
  napisów.
- **Dostawcy AI:** testować osobno Gemini, OpenAI i Anthropic z niewłaściwym
  kluczem, limitem API oraz pustą odpowiedzią.

## Definicja zakończenia

Refaktor jest ukończony, gdy:

- istnieją testy dla logiki krytycznej i są uruchamiane przez `pnpm test`;
- popup jest złożony z małych hooków o pojedynczych odpowiedzialnościach;
- komunikacja Chrome i adaptery LLM mają jawne, współdzielone typy;
- ekstrakcja danych YouTube ma testy regresyjne;
- lint, test i build przechodzą bez ostrzeżeń wymagających działania.
