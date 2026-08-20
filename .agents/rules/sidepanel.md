---
description: 'Read before changing side-panel lifecycle, pinning, tab/window behavior, or Shadow DOM layout.'
globs: '*'
---

# Zachowanie panelu bocznego

## Status i źródło prawdy

Ten dokument opisuje oczekiwane scenariusze produktu. Podczas refaktoru źródłem prawdy jest faktyczne zachowanie bieżącej wersji w obsługiwanym Google Chrome, utrwalone testem charakterystycznym. Gdy obserwacja i ten dokument się różnią, zachowaj obserwowane działanie, utwórz osobne GitHub Issue i nie poprawiaj rozbieżności po cichu w zmianie strukturalnej.

## Tryb lokalny

- Kliknięcie ikony otwiera panel dla bieżącej karty.
- Po przejściu na kartę bez lokalnego stanu panel znika.
- Powrót na kartę z otwartym lokalnym panelem przywraca jego widoczność.
- Każda karta przechowuje niezależny lokalny stan panelu.
- Otwarcie panelu na kolejnej karcie nie usuwa stanów innych kart.
- Zamknięcie karty usuwa jej lokalny stan.
- Ponowne kliknięcie ikony na karcie z otwartym panelem zamyka go.

## Tryb przypięty

- Przycisk „Przypnij” otwiera panel globalny zamiast panelu lokalnego karty źródłowej.
- Przypięty panel pozostaje widoczny po zmianie karty i po otwarciu nowej karty.
- Przejście na kartę z wcześniejszym lokalnym panelem usuwa lokalny stan tej odwiedzonej karty.
- Przypięcie nie usuwa od razu lokalnych stanów nieodwiedzonych kart.
- Po przypięciu przycisk „Przypnij” znika.
- Kliknięcie ikony albo zamknięcie panelu kontrolką Chrome kończy tryb globalny i czyści pozostałe lokalne stany zgodnie z faktycznym zachowaniem obsługiwanej wersji Chrome.
- Zachowanie wielu okien oraz restartu service workera zawsze wymaga testu charakterystycznego i scenariusza z `docs/manual-regression-checklist.md`.

Przykład: lokalne panele są otwarte na kartach A i B. Użytkownik przypina panel na karcie C i odwiedza B oraz D. Lokalny stan B zostaje usunięty, D nie otrzymuje lokalnego stanu, a nieodwiedzony stan A pozostaje.

## Layout i przewijanie

- Widok analizy ma jeden główny pionowy obszar przewijania obejmujący podsumowanie i rozmowę.
- Bezpośrednie karty treści zachowują naturalną wysokość; długie podsumowanie wydłuża obszar przewijania zamiast być obcinane.
- Łańcuch elementów flex pomiędzy korzeniem a treścią zachowuje poprawne ograniczenie wysokości, w tym `min-height: 0` tam, gdzie jest wymagane.
- Element `#my-ext` służy jako prefiks izolujący CSS dla PostCSS. Klasy głównego layoutu, takie jak `flex`, `h-screen` i `overflow`, należą do wewnętrznego korzenia aplikacji, nie do `#my-ext`.
- Deterministyczne rozmiary okna i pomiar przepełnienia definiuje `.agents/rules/testing.md`.
