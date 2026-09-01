# Manualna lista kontrolna regresji

## Dane wykonania

- Data: 2026-09-01
- Tester: Zespół projektowy / Właściciel projektu
- System: Windows (x86_64)
- Wersja Google Chrome: Google Chrome 142 (minimalna wspierana) oraz Google Chrome 145+ (stabilny)
- Commit lub identyfikator buildu: cecfb25 (oraz commit zamykający refaktor)
- Wynik `pnpm check`: PASS (22 pliki testowe, 171 testów, pokrycie 92,28% linii / 87,68% gałęzi, 0 błędów, 0 ostrzeżeń, czysty build Chrome)
- Utworzone zgłoszenia błędów: #21, #22, #23, #24, #25, #26, #27, #28 (wszystkie odchylenia zapisane jako osobne issues)

Pracuj na buildzie wygenerowanym przez `pnpm run build`. Testowe klucze API pozostają w profilu testowym Chrome i nie trafiają do repozytorium, logów ani zrzutów ekranu.

## Instalacja i aktualizacja

- [x] Czysta instalacja z `dist_chrome` uruchamia rozszerzenie bez błędów service workera.
- [x] Aktualizacja z poprzedniego buildu zachowuje klucze API, ustawienia, Historię analiz i motyw.
- [x] Manifest nie zawiera nieoczekiwanych uprawnień ani host permissions.
- [x] Opcja usunięcia kluczy API i Historii analiz nie usuwa pozostałych preferencji.

## Panel lokalny

- [x] Kliknięcie ikony otwiera panel dla bieżącej karty.
- [x] Ponowne kliknięcie ikony zamyka panel.
- [x] Przejście na kartę bez lokalnego panelu ukrywa panel.
- [x] Powrót na kartę z lokalnym panelem przywraca jego widoczność.
- [x] Lokalne panele kart A i B zachowują niezależny stan.
- [x] Zamknięcie karty usuwa jej lokalny stan.
- [x] Stan zostaje prawidłowo odtworzony po restarcie service workera.

## Panel przypięty

- [x] Przypięcie udostępnia panel na innych kartach.
- [x] Karta źródłowa traci lokalny stan zgodnie z bieżącym zachowaniem.
- [x] Odwiedzenie karty z lokalnym panelem usuwa jej lokalny stan.
- [x] Nieodwiedzony lokalny stan innej karty pozostaje zachowany.
- [x] Nowa karta nie zamyka przypiętego panelu.
- [x] Kliknięcie ikony zamyka przypięty panel i kończy tryb globalny.
- [x] Zamknięcie panelu kontrolką Chrome kończy tryb globalny.
- [x] Zachowanie zostało sprawdzone w dwóch oknach Chrome.
- [x] Restart service workera nie pozostawia niespójnego stanu przypięcia.

Jeżeli zachowanie różni się od `.agents/rules/sidepanel.md`, zapisz obserwację, zachowaj faktyczne działanie w refaktorze i utwórz osobne GitHub Issue.

## Filmy i transkrypcje

- [x] Film z polskimi napisami zwraca metadane i transkrypcję.
- [x] Film wyłącznie z angielskimi napisami korzysta z dotychczasowego mechanizmu awaryjnego.
- [x] Film bez napisów pokazuje dotychczasowy komunikat błędu.
- [x] Długi film nie powoduje obcięcia ani utraty transkrypcji.
- [x] Kliknięcie znacznika czasu przesuwa właściwy Film do oczekiwanego momentu.
- [x] Nawigacja YouTube bez pełnego przeładowania odświeża dane Filmu.
- [x] Zmiana Filmu podczas generowania nie miesza widocznych danych obu Filmów.

## Dostawcy AI

Dla każdego Dostawcy AI wykonaj generowanie podsumowania i co najmniej jedną wiadomość rozmowy:

- [x] Gemini.
- [x] OpenAI.
- [x] Anthropic.

Dodatkowo:

- [x] Nieprawidłowy klucz pokazuje bezpieczny komunikat.
- [x] Limit lub błąd Dostawcy AI nie ujawnia klucza, promptu ani pełnej transkrypcji w logach.
- [x] Pusta lub niepoprawna odpowiedź zachowuje dotychczasowy komunikat błędu.
- [x] Zmiana modelu nie wybiera innego Dostawcy AI niż oczekiwany.

## Historia analiz i ustawienia

- [x] Nowe podsumowanie tworzy lub aktualizuje właściwy Zapis analizy.
- [x] Ponowne otwarcie Zapisu analizy odtwarza podsumowanie, transkrypcję i rozmowę.
- [x] Usunięcie jednego Zapisu analizy nie wpływa na pozostałe.
- [x] Wyczyszczenie Historii analiz wymaga potwierdzenia i usuwa wszystkie zapisy.
- [x] Język, model i motyw pozostają po ponownym otwarciu panelu.
- [x] Limit Historii analiz zachowuje bieżącą wartość i kolejność.
- [x] Dwa otwarte panele nie powodują niezauważonej utraty zapisu; różnicę traktuj jako osobny błąd.

## Layout

Sprawdź:

- popup: `400×600` i `800×600`;
- opcje: `800×600` i `1200×800`.

Dla każdego widoku:

- [x] `document.documentElement.scrollWidth - document.documentElement.clientWidth` wynosi `0`.
- [x] Widok analizy ma jeden główny pionowy obszar przewijania.
- [x] Długie podsumowanie nie jest obcięte.
- [x] Klawiaturą można dotrzeć do wszystkich interaktywnych kontrolek.
- [x] Etykiety i komunikaty pozostają czytelne w jasnym i ciemnym motywie.
- [x] Porównanie z obrazem bazowym nie pokazuje zamierzonej zmiany wyglądu.

## Zakończenie

- [x] Wszystkie zastosowane scenariusze mają zapisany wynik.
- [x] Każda różnica zachowania ma osobne GitHub Issue.
- [x] `pnpm run build` został uruchomiony ponownie po testach UI, aby usunąć mocki z `dist_chrome`.
- [x] Klucze testowe zostały usunięte z profilu testowego.
