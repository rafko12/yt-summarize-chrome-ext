# Specyfikacja refaktoru — YT Summarizer

## Status dokumentu

Niniejszy dokument jest specyfikacją wykonawczą do zatwierdzonego [planu refaktoru](../REFACTOR.md). Plan określa cel, kolejność etapów i kryteria wysokiego poziomu, a specyfikacja doprecyzowuje wymagane zachowanie, projektowane szwy, sposób weryfikacji i warunki odbioru.

Specyfikacja nie potwierdza ukończenia żadnego etapu. Status etapu można zmienić dopiero po spełnieniu wszystkich jego wymagań oraz przejściu odpowiedniej bramki automatycznej i manualnej.

Słowa „MUSI”, „NIE MOŻE”, „POWINIEN” i „MOŻE” określają odpowiednio wymaganie bezwzględne, zakaz, zalecenie oraz dopuszczalną możliwość.

## 1. Cel i rezultat

Refaktor MUSI zmniejszyć ryzyko regresji i koszt dalszego rozwoju rozszerzenia bez zamierzonej zmiany zachowania, wyglądu ani sposobu obsługi. Po zakończeniu:

- odpowiedzialności platformowe, domenowe i prezentacyjne są rozdzielone w miejscach, w których faktycznie zmienia się zachowanie;
- złożone zachowanie znajduje się w głębokich modułach za małymi interfejsami;
- szczegóły `chrome.*`, sieci i DOM YouTube są dostępne przez kontrolowane adaptery;
- testy opisują rezultaty obserwowalne przez interfejsy używane przez kod produkcyjny;
- formaty danych, komunikaty, modele AI, wygląd i interakcje pozostają zgodne z wersją bazową;
- repozytorium buduje wyłącznie rozszerzenie dla Google Chrome.

## 2. Zakres

Specyfikacja obejmuje:

1. bramkę jakości i środowisko testowe;
2. sterownik panelu bocznego;
3. komunikację między kontekstami Chrome;
4. dane w `chrome.storage`;
5. klienta i adaptery Dostawców AI;
6. właściciela stanu Sesji analizy;
7. content script i integrację z YouTube;
8. widoki panelu, opcje i dostępność;
9. konfigurację Chrome-only i dokumentację końcową.

### 2.1. Poza zakresem

Refaktor NIE MOŻE:

- dodawać funkcji widocznych dla użytkownika;
- zmieniać wybranego Dostawcy AI, listy lub wartości modeli AI ani modeli domyślnych;
- przenosić żądań do Dostawców AI lub operacji Historii analiz poza panel boczny;
- zmieniać tekstów, opóźnień, liczby ponowień ani kolejności operacji bez testu potwierdzającego, że jest to obecne zachowanie;
- przeprojektowywać interfejsu użytkownika;
- wykonywać dużych aktualizacji zależności;
- dodawać zależności produkcyjnej, jeżeli ten sam rezultat można osiągnąć małym modułem własnym;
- dodawać obsługi przeglądarki innej niż Google Chrome;
- naprawiać przy okazji błędu ujawnionego przez test charakterystyczny.

Potwierdzony błąd spoza zakresu MUSI zostać zachowany w refaktorze i zgłoszony osobno zgodnie z procedurą w [`docs/agents/issue-tracker.md`](agents/issue-tracker.md).

## 3. Źródła prawdy

Wymagania należy interpretować w następującej kolejności:

1. faktyczne zachowanie wersji bazowej w Google Chrome zgodnym z `minimum_chrome_version` z [`src/manifest.ts`](../src/manifest.ts);
2. test charakterystyczny zapisujący to zachowanie;
3. niniejsza specyfikacja i zatwierdzone ADR-y;
4. [architektura](../ARCHITECTURE.md), [terminologia domenowa](../CONTEXT.md) i reguły w `.agents/rules/`;
5. plan w [`REFACTOR.md`](../REFACTOR.md).

Jeżeli obserwacja przeczy dokumentacji, implementacja MUSI zachować obserwowane zachowanie, a rozbieżność MUSI otrzymać osobne zgłoszenie. Dokumentacji nie wolno aktualizować tak, aby niepotwierdzony stan wyglądał na oczekiwany.

### 3.1. Wersja bazowa

Dla każdego pionowego fragmentu wersją bazową jest commit albo jednoznacznie zapisany stan drzewa roboczego, na którym wykonano test charakterystyczny. Wynik testu, wersja Chrome i identyfikator buildu MUSZĄ pozwalać odtworzyć obserwację.

## 4. Niezmienniki globalne

### 4.1. Platforma i narzędzia

- EXT-GEN-001: Projekt MUSI używać Node.js 20 lub nowszego i wyłącznie `pnpm`.
- EXT-GEN-002: Manifest i uprawnienia MUSZĄ mieć jedno źródło prawdy w `src/manifest.ts`.
- EXT-GEN-003: Wspierana jest wyłącznie wersja Google Chrome zgodna z `minimum_chrome_version` w manifeście.
- EXT-GEN-004: `dist_chrome` MUSI być generowany przez build i NIE MOŻE być edytowany jako źródło.
- EXT-GEN-005: Tematy DaisyUI MUSZĄ pozostać konfigurowane w głównym CSS przez `@plugin "daisyui"`.

### 4.2. Dane i bezpieczeństwo

- EXT-DATA-001: Trwałe dane użytkownika MUSZĄ pozostać w `chrome.storage.local`.
- EXT-DATA-002: Stan bieżącej sesji panelu MOŻE korzystać z `chrome.storage.session` i NIE MOŻE zostać uznany za trwały profil użytkownika.
- EXT-DATA-003: Istniejące nazwy kluczy i akceptowane formaty danych MUSZĄ pozostać możliwe do odczytania.
- EXT-DATA-004: Zmiana formatu danych wymaga bezstratnej, wersjonowanej migracji oraz testu zgodności danych sprzed zmiany.
- EXT-DATA-005: Klucze Dostawców AI, pełne polecenia i pełne transkrypcje NIE MOGĄ trafiać do repozytorium, logów, raportów testów ani zrzutów ekranu.

### 4.3. Konteksty wykonania

- EXT-CTX-001: Background service worker zarządza cyklem życia panelu i powiadamia o zmianie adresu Filmu.
- EXT-CTX-002: Content script odczytuje dane Filmu, pobiera transkrypcję, obsługuje przewijanie odtwarzacza i odpowiada na wiadomości panelu.
- EXT-CTX-003: Panel boczny jest właścicielem żądań do Dostawców AI, Historii analiz i bieżącej Sesji analizy.
- EXT-CTX-004: Widok NIE MOŻE wykonywać operacji platformowej, jeśli odpowiedzialność ma już dedykowany moduł.

### 4.4. Interfejsy i szwy

- EXT-DES-001: Moduł POWINIEN ukrywać więcej zachowania, niż wymaga wiedzy od wywołującego go kodu.
- EXT-DES-002: Szew dla zależności zewnętrznej MUSI mieć adapter produkcyjny i kontrolowany adapter testowy.
- EXT-DES-003: Wewnętrzne szwy używane wyłącznie przez implementację lub jej testy NIE MOGĄ powiększać publicznego interfejsu modułu.
- EXT-DES-004: Testy po wydzieleniu modułu MUSZĄ używać jego docelowego interfejsu. Testy płytkich modułów, które tylko powtarzają tę samą odpowiedzialność, POWINNY zostać zastąpione.
- EXT-DES-005: Listener `chrome.runtime.onMessage.addListener`, który obsługuje tylko część wiadomości, MUSI dla pozostałych ścieżek wykonać jawne `return false;`.

## 5. Docelowe moduły i kierunek zależności

| Obszar        | Moduł                       | Interfejs używany przez kod i testy                                     | Adapter zewnętrzny                                   |
| ------------- | --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Panel boczny  | sterownik stanu panelu      | pojedyncza instalacja, gotowość i zatrzymanie nasłuchiwania             | Chrome side panel, tabs, runtime i storage           |
| Komunikacja   | transport wiadomości        | wysłanie typowanej wiadomości i odebranie typowanej odpowiedzi          | `chrome.tabs`, `chrome.runtime` i `chrome.scripting` |
| Storage       | operacje danych użytkownika | odczyt lub zapis ustawień, kluczy, Historii analiz, motywu i przypięcia | `chrome.storage.local` oraz storage sesyjny panelu   |
| Dostawcy AI   | wspólny klient LLM          | walidacja klucza, podsumowanie i odpowiedź rozmowy                      | adapter `fetch` właściwego Dostawcy AI               |
| Sesja analizy | właściciel przejść stanu    | działania użytkownika i obserwowalny stan widoku                        | transport Chrome, klient LLM i storage               |
| YouTube       | moduł content scriptu       | wiadomość i odpowiedź                                                   | DOM YouTube oraz `youtube-transcript`                |
| Widoki        | panel i opcje               | działanie użytkownika i widoczny rezultat                               | DOM przeglądarki                                     |

Kontrakty wiadomości, typy Filmu i trwałe formaty danych nie mogą zależeć od Reacta ani globalnego `chrome`. Adapter może zależeć od kontraktu, lecz kontrakt NIE MOŻE zależeć od adaptera.

## 6. Sposób realizacji i odbioru

### 6.1. Pionowy fragment

Każdą zmianę zachowania wewnętrznego należy wykonać w następującej kolejności:

1. wskazać obserwowalny rezultat i szew docelowy;
2. dodać test charakterystyczny wersji bazowej;
3. potwierdzić przez kontrolowaną zmianę, że test wykrywa zmianę opisywanego zachowania;
4. wykonać najmniejsze wydzielenie odpowiedzialności;
5. uruchomić ten sam scenariusz przez docelowy interfejs;
6. usunąć zastąpione testy wnętrza, jeżeli nie opisują już osobnej odpowiedzialności;
7. uruchomić bramkę właściwą dla fragmentu i całego etapu.

### 6.2. Bramka automatyczna

Każdy etap MUSI zakończyć się poleceniem:

```bash
pnpm check
```

Polecenie MUSI obejmować, bez pomijania błędów ani ostrzeżeń:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm lint:spell
pnpm test:coverage
pnpm build
```

Minimalne progi coverage wynoszą 80% linii i 75% gałęzi globalnie. Sterownik panelu, kontrakty wiadomości, migracje storage i rejestr modeli MUSZĄ osiągnąć 100% gałęzi. Samo osiągnięcie progu bez testów znaczącego zachowania nie spełnia wymagania.

### 6.3. Bramka manualna

Etap MUSI przejść wszystkie dotyczące go scenariusze z [manualnej listy kontrolnej regresji](manual-regression-checklist.md). Pełna lista jest obowiązkowa na zakończenie etapu 8. Testy z rzeczywistymi kluczami wykonuje właściciel projektu bez przekazywania sekretów agentowi.

### 6.4. Warunek rozpoczęcia następnego etapu

Etapy należy realizować w kolejności od 0 do 8. Następny etap NIE MOŻE zostać uznany za rozpoczęty jako zatwierdzona zmiana, dopóki poprzedni etap nie spełni bramki. Dopuszczalne jest wcześniejsze rozpoznanie kodu i przygotowanie testu charakterystycznego, jeżeli nie zmienia to zachowania ani publicznych kontraktów.

## 7. Etap 0 — bramka jakości

### 7.1. Wymagania

- EXT-QG-001: Repozytorium MUSI udostępniać jeden skrypt `pnpm check` o kolejności z punktu 6.2.
- EXT-QG-002: Vitest MUSI działać domyślnie w środowisku Node, a testy React mogą jawnie korzystać z jsdom.
- EXT-QG-003: Wspólne przygotowanie testów MUSI znajdować się w `vitest.setup.ts`.
- EXT-QG-004: Coverage MUSI być generowane deterministycznie z progami opisanymi w punkcie 6.2.
- EXT-QG-005: GitHub Actions MUSI uruchamiać tę samą bramkę `pnpm check`, której używa środowisko lokalne.
- EXT-QG-006: Prettier, ESLint, TypeScript i cspell MUSZĄ zakończyć się bez błędów i ostrzeżeń.
- EXT-QG-007: Build Chrome MUSI zakończyć się bez nierozwiązanych zasobów i bez ręcznych zmian w `dist_chrome`.

### 7.2. Kryterium odbioru

Etap jest ukończony, gdy świeża instalacja zależności zgodna z lockfile pozwala uruchomić pełne `pnpm check` lokalnie i w CI z tym samym wynikiem, a raport coverage spełnia wymagane progi.

## 8. Etap 1 — sterownik panelu bocznego

Projekt tego etapu MUSI być zgodny z [ADR-0002](adr/0002-sterownik-stanu-panelu-z-adapterem-chrome.md).

### 8.1. Interfejs modułu

- EXT-SP-001: Sterownik MUSI być instalowany jednym wywołaniem przyjmującym adapter platformy i funkcję raportowania błędów.
- EXT-SP-002: Wynik instalacji MUSI udostępniać co najwyżej sygnał gotowości oraz możliwość odłączenia listenerów.
- EXT-SP-003: Interfejs sterownika NIE MOŻE ujawniać jego zbioru otwartych kart, flagi przypięcia, kolejki operacji ani kompensacji.
- EXT-SP-004: Adapter produkcyjny MUSI zawierać szczegóły `chrome.sidePanel`, `chrome.tabs`, `chrome.runtime`, `chrome.action`, `chrome.storage.local` i `chrome.storage.session` używane przez sterownik.
- EXT-SP-005: Testy MUSZĄ korzystać z deterministycznego adaptera pozwalającego kontrolować kolejność zakończenia operacji asynchronicznych.
- EXT-SP-006: Przepływ `YOUTUBE_URL_UPDATED` MUSI pozostać poza sterownikiem panelu.

### 8.2. Zachowanie

- EXT-SP-010: Po instalacji lub starcie istniejące karty MUSZĄ otrzymać bieżącą konfigurację panelu.
- EXT-SP-011: Nowa i zastąpiona karta MUSI otrzymać konfigurację panelu, a zastąpienie karty MUSI zachować jej lokalny stan zgodnie z wersją bazową.
- EXT-SP-012: Odtworzenie stanu MUSI odrzucać identyfikatory nieistniejących kart oraz wartości o nieprawidłowym typie.
- EXT-SP-013: W trybie lokalnym kliknięcie ikony MUSI przełączać panel bieżącej karty bez usuwania stanów innych kart.
- EXT-SP-014: Aktywowanie karty bez lokalnego panelu MUSI ukryć panel, a powrót do karty z lokalnym panelem MUSI zachować jego widoczność.
- EXT-SP-015: Zamknięcie karty MUSI usunąć jej stan sesyjny.
- EXT-SP-016: Przypięcie MUSI otworzyć panel globalny, utrwalić stan przypięcia i usunąć lokalny stan karty źródłowej w kolejności wersji bazowej.
- EXT-SP-017: W trybie przypiętym odwiedzenie karty z wcześniejszym stanem lokalnym MUSI usunąć stan tej karty, ale NIE MOŻE natychmiast usuwać stanów nieodwiedzonych kart.
- EXT-SP-018: Zamknięcie trybu globalnego ikoną lub kontrolką Chrome MUSI wyczyścić stan globalny i pozostałe stany lokalne zgodnie z wersją bazową.
- EXT-SP-019: Równoległe żądania zakończenia trybu globalnego MUSZĄ współdzielić jedną operację porządkowania albo dawać równoważny, deterministyczny rezultat.
- EXT-SP-020: Niepowodzenie otwarcia, zamknięcia, przypięcia lub zapisu MUSI wykonać obecną kompensację, zwrócić obecną odpowiedź i zgłosić bezpieczny błąd bez pozostawienia jawnie sprzecznego stanu.
- EXT-SP-021: Odpowiedź inicjująca i odczyt przypięcia MUSZĄ czekać na zakończenie odtworzenia stanu.

### 8.3. Weryfikacja

Wszystkie gałęzie sterownika MUSZĄ być pokryte przez jego interfejs instalacji. Testy adaptera Chrome MUSZĄ potwierdzać mapowanie zdarzeń i operacji `chrome.*`, ale NIE MOGĄ powtarzać decyzji sterownika. `background/index.ts` po etapie MUSI jedynie składać sterownik, adapter, obsługę raportowania i niezależny przepływ aktualizacji adresu Filmu.

## 9. Etap 2 — komunikacja Chrome

### 9.1. Kontrakty

- EXT-MSG-001: Typy wiadomości, mapy odpowiedzi i walidatory MUSZĄ pozostać w czystym module bez odwołań do globalnego `chrome`.
- EXT-MSG-002: Kontrakt MUSI rozróżniać wiadomości content scriptu i backgroundu oraz wiązać typ wiadomości z typem odpowiedzi.
- EXT-MSG-003: Walidator MUSI odrzucać `null`, wartości niebędące obiektem, nieznany typ oraz brakujące lub nieprawidłowo typowane pola.
- EXT-MSG-004: Obsługiwane typy MUSZĄ pozostać zgodne z wersją bazową: `GET_VIDEO_DATA`, `GET_TRANSCRIPT`, `SEEK_TO`, `PANEL_INIT`, `PIN_GLOBAL`, `YOUTUBE_URL_UPDATED` i `GET_PIN_STATE`.
- EXT-MSG-005: Odpowiedzi sukcesu, błędu, danych Filmu, transkrypcji i stanu przypięcia MUSZĄ zachować istniejące kształty.

### 9.2. Transport

- EXT-MSG-010: Transport MUSI udostępniać typowane wysłanie wiadomości do karty i do backgroundu.
- EXT-MSG-011: Pierwsze wysłanie do content scriptu MUSI nastąpić przed próbą ponownego wstrzyknięcia.
- EXT-MSG-012: Ponowne wstrzyknięcie jest dozwolone wyłącznie dla błędu braku odbiorcy rozpoznawanego zgodnie z wersją bazową.
- EXT-MSG-013: Pliki do wstrzyknięcia MUSZĄ pochodzić z pierwszej deklaracji `content_scripts` bieżącego manifestu.
- EXT-MSG-014: Po wstrzyknięciu transport MUSI zachować obecne opóźnienie 500 ms i wykonać dokładnie jedną ponowną próbę.
- EXT-MSG-015: Brak pliku content scriptu, błąd wstrzyknięcia lub błąd ponownej próby MUSI zwrócić obecny komunikat proszący o odświeżenie karty YouTube.
- EXT-MSG-016: Błąd niezwiązany z brakiem odbiorcy MUSI zostać przekazany bez wstrzyknięcia content scriptu.
- EXT-MSG-017: Opcjonalne powiadomienie o wstrzykiwaniu MUSI zostać wywołane najwyżej raz i przed operacją wstrzyknięcia.

### 9.3. Weryfikacja

Testy kontraktów MUSZĄ osiągnąć 100% gałęzi. Testy transportu MUSZĄ obserwować wysłane wiadomości, kolejność `sendMessage` → `executeScript` → opóźnienie → `sendMessage` oraz końcową odpowiedź lub błąd. Nie wolno testować prywatnych funkcji rozpoznawania błędu poza tym przepływem.

## 10. Etap 3 — storage

### 10.1. Trwały kontrakt

- EXT-ST-001: Następujące wartości kluczy MUSZĄ pozostać niezmienione:
  - `gemini_api_key`;
  - `openai_api_key`;
  - `claude_api_key`;
  - `summarizer_settings`;
  - `summarizer_history`;
  - `panel_pin_state`;
  - `ui_theme`.
- EXT-ST-002: Lokalny stan kart panelu MUSI pozostać w `chrome.storage.session` pod dotychczasową nazwą, dopóki test zgodności i ewentualna migracja nie zatwierdzą zmiany.
- EXT-ST-003: Klucze Dostawców AI odczytane jako wartość inna niż tekst MUSZĄ dawać pusty tekst.
- EXT-ST-004: Niepełne ustawienia MUSZĄ używać dotychczasowych wartości domyślnych osobno dla każdego brakującego pola.
- EXT-ST-005: Nieprawidłowy motyw MUSI dawać `null`, a stan przypięcia ma być prawdziwy wyłącznie dla wartości `true`.

### 10.2. Historia analiz

- EXT-ST-010: Zapis analizy MUSI zachować pola `videoId`, `title`, `author`, `thumbnailUrl`, `summary`, `transcript`, `chat` i `createdAt` w istniejących typach.
- EXT-ST-011: Odczyt Historii analiz MUSI ignorować nieprawidłowe rekordy bez utraty prawidłowych rekordów z tej samej kolekcji.
- EXT-ST-012: Zapis dla istniejącego `videoId` MUSI zastąpić poprzedni Zapis analizy, ustawić nowy `createdAt` i przenieść zapis na początek.
- EXT-ST-013: Historia analiz MUSI zachować limit 50 zapisów i dotychczasową kolejność.
- EXT-ST-014: Aktualizacja rozmowy nieistniejącego Zapisu analizy NIE MOŻE tworzyć rekordu, chyba że robi to operacja wysokiego poziomu zachowująca wersję bazową.
- EXT-ST-015: Usunięcie jednego zapisu NIE MOŻE zmienić pozostałych, a wyczyszczenie Historii analiz MUSI zachować pozostałe preferencje.
- EXT-ST-016: Operacja usunięcia kluczy Dostawców AI i Historii analiz MUSI zachować ustawienia, motyw i stan przypięcia.

### 10.3. Projekt modułu

- EXT-ST-020: Kod wywołujący storage MUSI używać operacji wysokiego poziomu i NIE MOŻE znać wywołań zwrotnych `chrome.storage`.
- EXT-ST-021: Walidacja trwałych formatów POWINNA być czysta i prywatna dla modułu, chyba że ten sam format jest rzeczywistym kontraktem innego kontekstu wykonania.
- EXT-ST-022: Adapter storage MUSI umożliwiać deterministyczne testy odczytu, zapisu, usuwania i błędów bez globalnego `chrome`.
- EXT-ST-023: Moduł NIE MOŻE wprowadzać generycznego repozytorium klucz–wartość do interfejsu wywołującego kodu.

### 10.4. Migracja

Migracji NIE NALEŻY dodawać bez wykazanej zmiany formatu. Jeśli stanie się konieczna, MUSI:

1. mieć jawną wersję źródłową i docelową;
2. być bezstratna i bezpieczna przy ponownym uruchomieniu;
3. pozostawić dane nietknięte przy nieznanym nowszym formacie;
4. mieć test na rzeczywistym przykładzie danych poprzedniej wersji;
5. osiągnąć 100% pokrycia gałęzi;
6. nie usuwać starej wartości przed pomyślnym zapisaniem i odczytaniem nowej.

## 11. Etap 4 — Dostawcy AI

### 11.1. Wspólny klient

- EXT-AI-001: Panel MUSI wywoływać Dostawców AI przez wspólny klient oferujący walidację klucza, generowanie podsumowania i generowanie odpowiedzi rozmowy.
- EXT-AI-002: Interfejs adaptera Dostawcy AI MUSI przyjmować klucz, model, instrukcję systemową, wiadomość użytkownika, opcjonalną historię rozmowy i limit tokenów oraz zwracać tekst.
- EXT-AI-003: Różnice adresów, nagłówków, ciał żądań i parsowania odpowiedzi Gemini, OpenAI oraz Anthropic MUSZĄ pozostać w ich adapterach.
- EXT-AI-004: Widoki i hooki NIE MOGĄ wybierać formatu protokołu Dostawcy AI.
- EXT-AI-005: Żądania MUSZĄ nadal być wykonywane w kontekście panelu bocznego.

### 11.2. Rejestr i modele

- EXT-AI-010: Typ Dostawcy AI i mapowanie modeli MUSZĄ mieć jedno źródło prawdy używane przez klienta, ustawienia i storage.
- EXT-AI-011: Rejestr modeli MUSI zachować wszystkie wartości rozpoznawane przez wersję bazową oraz ich mapowanie na `gemini`, `openai` albo `claude`.
- EXT-AI-012: Domyślny model i zachowanie dla nieznanego modelu MUSZĄ zostać utrwalone testem charakterystycznym przed zmianą rejestru.
- EXT-AI-013: Rejestr modeli MUSI osiągnąć 100% pokrycia gałęzi.
- EXT-AI-014: Dodanie adaptera Dostawcy AI POWINNO wymagać zmiany rejestru i testów, ale NIE MOŻE wymagać zmiany widoków.

Rejestr wersji bazowej obejmuje:

| Dostawca AI | Modele AI                                                                         |
| ----------- | --------------------------------------------------------------------------------- |
| Gemini      | `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro` |
| OpenAI      | `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-4o-mini`                                    |
| Anthropic   | `claude-sonnet-5`, `claude-opus-5`, `claude-haiku-4-5`                            |

Wartość domyślna wersji bazowej to `gemini-3.5-flash`. Tabela utrwala zgodność refaktoru, ale nie rozstrzyga, czy nazwy odpowiadają aktualnej ofercie Dostawców AI. Ewentualna niespójność jest osobnym błędem poza zakresem.

### 11.3. Błędy i bezpieczeństwo

- EXT-AI-020: Błąd żądania MUSI zachować bezpieczny komunikat, nazwę Dostawcy AI i — jeśli istnieje — status HTTP.
- EXT-AI-021: Statusy odrzucenia klucza, limitu i niedostępności Dostawcy AI MUSZĄ zachować dotychczasowe komunikaty użytkownika.
- EXT-AI-022: Pusta albo nieprawidłowa odpowiedź MUSI zachować dotychczasowy tryb błędu.
- EXT-AI-023: Błąd NIE MOŻE ujawnić klucza, pełnego promptu, pełnej transkrypcji ani surowej odpowiedzi zawierającej dane użytkownika.

### 11.4. Weryfikacja

Każdy adapter MUSI mieć test utworzonego żądania, wymaganych nagłówków, parsowania poprawnej odpowiedzi, pustej odpowiedzi i niepowodzenia HTTP przez kontrolowany adapter `fetch`. Test wspólnego klienta MUSI potwierdzać wybór adaptera i bezpieczne mapowanie błędu przez jego publiczny interfejs.

Jeżeli test ujawni niespójność istniejących nazw lub modeli, implementacja MUSI zachować bieżące zachowanie, a niespójność MUSI otrzymać osobne zgłoszenie.

## 12. Etap 5 — Sesja analizy

### 12.1. Właściciel stanu

- EXT-AS-001: Sesja analizy MUSI mieć jednego właściciela przejść stanu dla bieżącego Filmu, transkrypcji, podsumowania, rozmowy, ładowania i błędów.
- EXT-AS-002: `PopupContainer` MUSI składać moduły i widoki, ale NIE MOŻE implementować przejść domenowych Sesji analizy.
- EXT-AS-003: Prywatny podział na hooki MOŻE się zmieniać bez zmiany testów zachowania panelu.
- EXT-AS-004: Pobieranie aktywnej karty i Historii analiz NIE MOŻE być powielane w kilku przepływach, jeśli rezultat należy do tego samego przejścia Sesji analizy.
- EXT-AS-005: Moduł MUSI odróżniać dane bieżącego Filmu od wyniku operacji rozpoczętej dla wcześniejszego Filmu.

### 12.2. Zachowanie

- EXT-AS-010: Otwarcie panelu MUSI odtworzyć stan przypięcia oraz dane aktywnego Filmu w dotychczasowej kolejności widocznej dla użytkownika.
- EXT-AS-011: Zmiana Filmu MUSI wyczyścić albo odtworzyć transkrypcję, podsumowanie i rozmowę dokładnie jak wersja bazowa.
- EXT-AS-012: Operacja generowania MUSI używać Filmu i transkrypcji, dla których została rozpoczęta.
- EXT-AS-013: Zakończenie starszej operacji po zmianie Filmu NIE MOŻE pomieszać widocznych danych obu Filmów; dokładny sposób ignorowania lub prezentacji wyniku MUSI wynikać z testu charakterystycznego.
- EXT-AS-014: Nowe podsumowanie MUSI utworzyć albo zaktualizować właściwy Zapis analizy.
- EXT-AS-015: Wysłanie wiadomości MUSI zachować kolejność ról i zapisać finalną rozmowę do właściwego Zapisu analizy.
- EXT-AS-016: Odtworzenie Zapisu analizy MUSI przywrócić metadane Filmu, transkrypcję, podsumowanie i rozmowę bez uruchamiania niezamierzonego nowego żądania.
- EXT-AS-017: Usunięcie bieżącego Zapisu analizy MUSI pozostawić panel w stanie zgodnym z wersją bazową.
- EXT-AS-018: Przewinięcie rozmowy po nowej wiadomości MUSI zachować obserwowane zachowanie.
- EXT-AS-019: Błędy aktywnej karty, transkrypcji, braku klucza i Dostawcy AI MUSZĄ zachować obecne komunikaty oraz możliwość dalszej pracy przewidzianą przez wersję bazową.

### 12.3. Bramka projektu reduktora

Reducer MOŻE zostać wprowadzony dopiero po zapisaniu tabeli rzeczywistych stanów i przejść. Decyzja MUSI porównać co najmniej:

- rozmiar interfejsu wywołującego kodu;
- liczbę nieprawidłowych stanów, których nie da się utworzyć;
- możliwość przetestowania wszystkich przejść przez działania użytkownika;
- koszt efektów asynchronicznych i ochrony przed przestarzałym wynikiem.

Reducer NIE MOŻE być publicznym interpreterem efektów ani ujawniać prywatnych kroków tylko na potrzeby testów. Jeśli nie pogłębia modułu, stan POWINIEN pozostać za prostszym interfejsem.

### 12.4. Weryfikacja

Testy MUSZĄ działać przez renderowany panel, działania użytkownika i widoczne rezultaty. Mogą kontrolować wyłącznie Chrome, sieć i storage. Nie wolno zastępować atrapą prywatnych hooków ani wykonywać asercji na ich wewnętrznym stanie.

## 13. Etap 6 — content script

### 13.1. Moduł i uruchomienie

- EXT-CS-001: Content script MUSI być zwykłym modułem TypeScript i NIE MOŻE uruchamiać Reacta ani tworzyć korzenia renderowania, ponieważ nie renderuje interfejsu.
- EXT-CS-002: Punkty wejścia trybu deweloperskiego i produkcyjnego MUSZĄ instalować ten sam moduł obsługi wiadomości; różnice dozwolone są wyłącznie tam, gdzie wymaga ich build i odświeżanie deweloperskie.
- EXT-CS-003: Instalacja funkcji nasłuchującej POWINNA być jednym wywołaniem i zwracać możliwość odłączenia w teście, o ile nie powiększa to interfejsu produkcyjnego.

### 13.2. Wiadomości i YouTube

- EXT-CS-010: `GET_VIDEO_DATA` MUSI zwracać dotychczasowe metadane bieżącego Filmu albo dotychczasowy błąd.
- EXT-CS-011: `GET_TRANSCRIPT` MUSI zachować wybór języka, kolejność źródeł transkrypcji i mechanizm awaryjny wersji bazowej.
- EXT-CS-012: Ekstrakcja `ytInitialPlayerResponse` MUSI korzystać z istniejącego parsera odpornego na klamry w tekście, sekwencje escape, niepełny JSON, niepasujący `videoId` i brak napisów.
- EXT-CS-013: `SEEK_TO` MUSI przesunąć właściwy odtwarzacz do podanej liczby sekund i zwrócić istniejący kształt sukcesu albo błędu.
- EXT-CS-014: Nieznana albo nieprawidłowa wiadomość NIE MOŻE zostać uznana za obsłużoną.
- EXT-CS-015: Listener częściowy MUSI zakończyć nieobsługiwaną ścieżkę jawnym `return false;`.
- EXT-CS-016: Asynchroniczna odpowiedź MUSI zachować wymagane `return true` wyłącznie wtedy, gdy odpowiedź zostanie wysłana później.
- EXT-CS-017: Treść odpowiedzi i błędów, w tym tryb dla braku napisów, MUSI pozostać zgodna z wersją bazową.

### 13.3. Weryfikacja

Testy MUSZĄ wysyłać rzeczywiste kontrakty wiadomości do zainstalowanego modułu i obserwować odpowiedź. DOM YouTube i `youtube-transcript` mogą być zastąpione kontrolowanymi adapterami. Parser MUSI nadal przechodzić zapisane przykłady HTML.

## 14. Etap 7 — widoki i dostępność

### 14.1. Podział widoków

- EXT-UI-001: Widok MOŻE zostać podzielony tylko wtedy, gdy wydzielenie przenosi spójną odpowiedzialność lub tworzy potrzebny szew testowy.
- EXT-UI-002: Element wyodrębniony wyłącznie z powodu liczby linii NIE SPEŁNIA wymagania refaktoru.
- EXT-UI-003: Widoki MUSZĄ otrzymywać stan i działania przez interfejs właściciela Sesji analizy, bez bezpośredniego wyboru transportu Chrome, storage albo adaptera Dostawcy AI.

### 14.2. Zgodność wizualna i interakcje

- EXT-UI-010: Refaktor NIE MOŻE wprowadzić zamierzonej różnicy wyglądu w jasnym ani ciemnym motywie.
- EXT-UI-011: Panel MUSI zachować jeden główny pionowy obszar przewijania obejmujący podsumowanie i rozmowę.
- EXT-UI-012: Długie podsumowanie MUSI wydłużać główny obszar przewijania i NIE MOŻE zostać obcięte przez zagnieżdżony kontener.
- EXT-UI-013: Łańcuch elementów flex MUSI zachować ograniczenie wysokości, w tym `min-height: 0` w miejscach wymaganych przez layout.
- EXT-UI-014: `#my-ext` MUSI pozostać prefiksem izolującym CSS, a klasy głównego layoutu MUSZĄ należeć do wewnętrznego korzenia aplikacji.
- EXT-UI-015: Wszystkie istniejące kontrolki MUSZĄ pozostać osiągalne klawiaturą, mieć czytelny fokus oraz dotychczasowe etykiety i komunikaty.
- EXT-UI-016: Pomiar poziomego przepełnienia MUSI wynosić `0` dla panelu `400×600` i `800×600` oraz opcji `800×600` i `1200×800`.

### 14.3. Audyt

Audyt MUSI korzystać z buildu `dist_chrome`, deterministycznego mocka `chrome` i obrazu bazowego. Mocki audytu NIE MOGĄ pozostać w artefakcie produkcyjnym. Po audycie należy ponownie uruchomić build.

## 15. Etap 8 — Chrome-only i dokumentacja końcowa

### 15.1. Build i zależności

- EXT-CHR-001: Konfiguracja Vite MUSI generować tylko manifest i katalog wyjściowy Chrome.
- EXT-CHR-002: Należy usunąć konfigurację `firefox`, `dist_firefox`, `moz-extension` i manifestowe rozgałęzienia Firefoksa.
- EXT-CHR-003: Deklaracje i zależności `webextension-polyfill` MUSZĄ zostać usunięte, jeśli nadal istnieją.
- EXT-CHR-004: `src/manifest.ts` MUSI pozostać jedynym źródłem wspólnych pól manifestu, a konfiguracja kompilacji NIE MOŻE odtwarzać drugiego niezależnego manifestu.
- EXT-CHR-005: Build MUSI zachować stronę opcji, background service worker, content script, panel boczny, uprawnienia i host permissions wymagane przez wersję bazową.

### 15.2. Dokumentacja

- EXT-DOC-001: `ARCHITECTURE.md` MUSI opisywać faktycznie zweryfikowane moduły, interfejsy, szwy i kierunek zależności końcowego kodu.
- EXT-DOC-002: `AGENTS.md` i `.agents/rules/` MUSZĄ być zgodne z końcowym kodem i nie mogą ogłaszać nieukończonego etapu jako stanu bieżącego.
- EXT-DOC-003: `CONTEXT.md` MUSI zachować kanoniczne terminy Film, Sesja analizy, Zapis analizy, Historia analiz, Dostawca AI i Model AI.
- EXT-DOC-004: README MUSI opisywać wyłącznie wspierany build Chrome i prowadzić do aktualnego planu, specyfikacji oraz dokumentacji architektury.
- EXT-DOC-005: Końcowa dokumentacja NIE MOŻE opisywać prywatnego podziału implementacji jako stabilnego interfejsu, jeżeli wywołujący kod nie musi go znać.

### 15.3. Odbiór końcowy

Etap wymaga pełnego `pnpm check`, pełnej manualnej listy kontrolnej regresji na czystym buildzie oraz potwierdzenia, że repozytorium nie zawiera aktywnej konfiguracji innej przeglądarki.

## 16. Macierz zgodności

| Ryzyko                         | Wymagania kontrolne              | Dowód odbioru                                                                       |
| ------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------- |
| Regresja panelu                | EXT-SP-010–021                   | testy sterownika i scenariusze panelu lokalnego oraz przypiętego                    |
| Zerwanie komunikacji           | EXT-MSG-001–017, EXT-CS-010–017  | testy kontraktów, transportu i content scriptu                                      |
| Utrata danych                  | EXT-DATA-001–004, EXT-ST-001–023 | przykłady starszych danych, testy operacji wysokiego poziomu i ewentualnej migracji |
| Zmiana Dostawcy AI lub modelu  | EXT-AI-001–023                   | test rejestru, utworzonych żądań i bezpiecznych błędów                              |
| Pomieszanie Filmów             | EXT-AS-005, EXT-AS-011–016       | test zmiany Filmu podczas operacji asynchronicznej                                  |
| Zmiana wyglądu lub przewijania | EXT-UI-010–016                   | audyt wymiarów, pomiar przepełnienia i porównanie z obrazem bazowym                 |
| Rozjazd platformy              | EXT-GEN-002–004, EXT-CHR-001–005 | inspekcja manifestu i pojedynczy build Chrome                                       |
| Testowanie wnętrza             | EXT-DES-003–004                  | testy przez zatwierdzone interfejsy bez zastępowania prywatnych modułów atrapami    |

## 17. Rejestr bramek decyzyjnych

W trakcie realizacji dopuszczalne są wyłącznie następujące nierozstrzygnięte decyzje:

1. **Reducer Sesji analizy** — decyzja po zapisaniu rzeczywistych stanów i przejść zgodnie z punktem 12.3.
2. **Migracja storage** — decyzja tylko wtedy, gdy implementacja wymaga zmiany trwałego formatu zgodnie z punktem 10.4.
3. **Dalszy podział widoków** — decyzja po wykazaniu osobnej odpowiedzialności albo potrzebnego szwu zgodnie z EXT-UI-001.

Każda decyzja MUSI zostać zapisana w opisie etapu albo nowym ADR, jeżeli zmienia architekturę, kontekst wykonania, trwały kontrakt lub zasady zależności. Brak rozstrzygnięcia NIE MOŻE zostać zastąpiony dodatkową warstwą abstrakcji „na przyszłość”.

## 18. Definicja zakończenia refaktoru

Refaktor jest ukończony wyłącznie wtedy, gdy:

1. wszystkie wymagania bezwzględne niniejszej specyfikacji są spełnione albo mają jawnie zatwierdzoną zmianę specyfikacji;
2. każdy etap od 0 do 8 ma zapisany dowód przejścia bramki automatycznej i dotyczących go testów manualnych;
3. pełne `pnpm check` przechodzi bez błędów i ostrzeżeń;
4. pełna manualna lista kontrolna regresji jest zakończona na buildzie Chrome;
5. istniejące dane użytkownika pozostają możliwe do odczytania bez utraty;
6. nie wprowadzono zamierzonej zmiany funkcji, modeli AI, komunikatów, wyglądu ani UX;
7. potwierdzone błędy spoza zakresu mają osobne zgłoszenia;
8. dokumentacja opisuje zweryfikowany kod, a nie stan planowany;
9. repozytorium buduje jeden wspierany wariant dla Google Chrome.
