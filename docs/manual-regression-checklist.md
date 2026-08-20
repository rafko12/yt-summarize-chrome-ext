# Manualna lista kontrolna regresji

## Dane wykonania

- Data:
- Tester:
- System:
- Wersja Google Chrome:
- Commit lub identyfikator buildu:
- Wynik `pnpm check`:
- Utworzone zgłoszenia błędów:

Pracuj na buildzie wygenerowanym przez `pnpm run build`. Testowe klucze API pozostają w profilu testowym Chrome i nie trafiają do repozytorium, logów ani zrzutów ekranu.

## Instalacja i aktualizacja

- [ ] Czysta instalacja z `dist_chrome` uruchamia rozszerzenie bez błędów service workera.
- [ ] Aktualizacja z poprzedniego buildu zachowuje klucze API, ustawienia, Historię analiz i motyw.
- [ ] Manifest nie zawiera nieoczekiwanych uprawnień ani host permissions.
- [ ] Opcja usunięcia kluczy API i Historii analiz nie usuwa pozostałych preferencji.

## Panel lokalny

- [ ] Kliknięcie ikony otwiera panel dla bieżącej karty.
- [ ] Ponowne kliknięcie ikony zamyka panel.
- [ ] Przejście na kartę bez lokalnego panelu ukrywa panel.
- [ ] Powrót na kartę z lokalnym panelem przywraca jego widoczność.
- [ ] Lokalne panele kart A i B zachowują niezależny stan.
- [ ] Zamknięcie karty usuwa jej lokalny stan.
- [ ] Stan zostaje prawidłowo odtworzony po restarcie service workera.

## Panel przypięty

- [ ] Przypięcie udostępnia panel na innych kartach.
- [ ] Karta źródłowa traci lokalny stan zgodnie z bieżącym zachowaniem.
- [ ] Odwiedzenie karty z lokalnym panelem usuwa jej lokalny stan.
- [ ] Nieodwiedzony lokalny stan innej karty pozostaje zachowany.
- [ ] Nowa karta nie zamyka przypiętego panelu.
- [ ] Kliknięcie ikony zamyka przypięty panel i kończy tryb globalny.
- [ ] Zamknięcie panelu kontrolką Chrome kończy tryb globalny.
- [ ] Zachowanie zostało sprawdzone w dwóch oknach Chrome.
- [ ] Restart service workera nie pozostawia niespójnego stanu przypięcia.

Jeżeli zachowanie różni się od `.agents/rules/sidepanel.md`, zapisz obserwację, zachowaj faktyczne działanie w refaktorze i utwórz osobne GitHub Issue.

## Filmy i transkrypcje

- [ ] Film z polskimi napisami zwraca metadane i transkrypcję.
- [ ] Film wyłącznie z angielskimi napisami korzysta z dotychczasowego mechanizmu awaryjnego.
- [ ] Film bez napisów pokazuje dotychczasowy komunikat błędu.
- [ ] Długi film nie powoduje obcięcia ani utraty transkrypcji.
- [ ] Kliknięcie znacznika czasu przesuwa właściwy Film do oczekiwanego momentu.
- [ ] Nawigacja YouTube bez pełnego przeładowania odświeża dane Filmu.
- [ ] Zmiana Filmu podczas generowania nie miesza widocznych danych obu Filmów.

## Dostawcy AI

Dla każdego Dostawcy AI wykonaj generowanie podsumowania i co najmniej jedną wiadomość rozmowy:

- [ ] Gemini.
- [ ] OpenAI.
- [ ] Anthropic.

Dodatkowo:

- [ ] Nieprawidłowy klucz pokazuje bezpieczny komunikat.
- [ ] Limit lub błąd Dostawcy AI nie ujawnia klucza, promptu ani pełnej transkrypcji w logach.
- [ ] Pusta lub niepoprawna odpowiedź zachowuje dotychczasowy komunikat błędu.
- [ ] Zmiana modelu nie wybiera innego Dostawcy AI niż oczekiwany.

## Historia analiz i ustawienia

- [ ] Nowe podsumowanie tworzy lub aktualizuje właściwy Zapis analizy.
- [ ] Ponowne otwarcie Zapisu analizy odtwarza podsumowanie, transkrypcję i rozmowę.
- [ ] Usunięcie jednego Zapisu analizy nie wpływa na pozostałe.
- [ ] Wyczyszczenie Historii analiz wymaga potwierdzenia i usuwa wszystkie zapisy.
- [ ] Język, model i motyw pozostają po ponownym otwarciu panelu.
- [ ] Limit Historii analiz zachowuje bieżącą wartość i kolejność.
- [ ] Dwa otwarte panele nie powodują niezauważonej utraty zapisu; różnicę traktuj jako osobny błąd.

## Layout

Sprawdź:

- popup: `400×600` i `800×600`;
- opcje: `800×600` i `1200×800`.

Dla każdego widoku:

- [ ] `document.documentElement.scrollWidth - document.documentElement.clientWidth` wynosi `0`.
- [ ] Widok analizy ma jeden główny pionowy obszar przewijania.
- [ ] Długie podsumowanie nie jest obcięte.
- [ ] Klawiaturą można dotrzeć do wszystkich interaktywnych kontrolek.
- [ ] Etykiety i komunikaty pozostają czytelne w jasnym i ciemnym motywie.
- [ ] Porównanie z obrazem bazowym nie pokazuje zamierzonej zmiany wyglądu.

## Zakończenie

- [ ] Wszystkie zastosowane scenariusze mają zapisany wynik.
- [ ] Każda różnica zachowania ma osobne GitHub Issue.
- [ ] `pnpm run build` został uruchomiony ponownie po testach UI, aby usunąć mocki z `dist_chrome`.
- [ ] Klucze testowe zostały usunięte z profilu testowego.
