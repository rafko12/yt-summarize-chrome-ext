---
description: 'Side Panel Behavior Rules'
globs: '*'
---

# Side Panel Behavior

Poniższe reguły definiują oczekiwane działanie panelu bocznego (Side Panel) w rozszerzeniu:

## 1. Tryb lokalny (domyślny)

- **Otwieranie:** Domyślnie rozszerzenie otwiera się dla otwartej karty, na której zostało wywołane.
- **Zmiana karty:** Po przełączeniu na inną kartę, panel boczny znika. Jego stan (otwarty) zostaje przypisany do oryginalnej karty.
- **Powrót do karty:** Po powrocie na kartę, na której rozszerzenie było otwarte, panel boczny automatycznie otwiera się ponownie.
- **Niezależne stany kart:** Każda karta przechowuje własny lokalny stan panelu. Otwarcie rozszerzenia na kolejnej karcie nie zamyka ani nie usuwa stanu panelu zapamiętanego na innych kartach.
- **Wiele otwartych stanów:** Jeśli panel został otwarty osobno na kartach A i B, przełączanie między nimi powoduje wyświetlenie panelu przypisanego do aktualnej karty. Na karcie bez zapamiętanego lokalnego stanu panel pozostaje ukryty.

## 2. Tryb globalny (przypięty)

- **Przycisk "Przypnij":** Dostępny jest przycisk "Przypnij", który dopina panel boczny do całej przeglądarki (globalnie), a nie tylko do konkretnej karty.
- **Zmiana karty (przypięty):** Przypięty panel boczny nie znika po zmianie karty – jest widoczny na wszystkich kartach.
- **Konflikt stanów:** Gdy użytkownik z przypiętym panelem przejdzie na kartę, która miała już otwarty własny, lokalny panel boczny, panel globalny zastępuje ten lokalny, a lokalny stan tej odwiedzonej karty zostaje usunięty.
- **Selektywne usuwanie stanów lokalnych:** Przypięcie panelu nie usuwa od razu stanów lokalnych ze wszystkich kart. Usuwany jest wyłącznie stan karty odwiedzonej podczas działania panelu globalnego. Stany kart, których użytkownik nie odwiedził w tym trybie, pozostają zachowane.
- **Przykład:** Jeśli lokalny panel był otwarty na kartach A i B, a użytkownik przypnie panel na karcie C, następnie odwiedzi karty B i D, lokalny stan karty B zostaje usunięty. Karta D nie zyskuje lokalnego stanu, natomiast stan karty A pozostaje zachowany, ponieważ karta A nie została odwiedzona podczas działania panelu globalnego.

## 3. Pozostałe zachowania i przypadki brzegowe

- **Kliknięcie ikony (Toggle):** Ponowne naciśnięcie ikony rozszerzenia (gdy panel jest już otwarty) powoduje jego zamknięcie.
- **Odpinanie i przycisk "Przypnij":** Po przypięciu panelu, przycisk "Przypnij" znika z interfejsu użytkownika. Od tego momentu panel można jedynie zamknąć całkowicie (za pomocą przycisku z menu w panelu lub klikając ponownie na ikonę rozszerzenia).
- **Zamknięcie panelu globalnego:** Zamknięcie przypiętego panelu kończy tryb globalny i usuwa wszystkie pozostałe stany lokalne w danym oknie. Po zamknięciu panel nie może pojawić się ponownie przy powrocie na wcześniej odwiedzoną kartę; kolejne kliknięcie ikony otwiera nowy panel lokalny od czystego stanu.
- **Nowe karty w trybie przypiętym:** Gdy panel jest przypięty globalnie do przeglądarki, otwarcie nowej karty (lub nowego linku) nie zamyka panelu. Panel pozostaje otwarty wszędzie, dopóki użytkownik go jawnie nie zamknie.
- **Zamykanie karty:** Gdy karta, na której otwarty był lokalny panel, zostaje zamknięta, to stan tego panelu znika (panel zamyka się całkowicie razem z nią).

## 4. Zasady Layoutu i Scrollowania w Panelu Bocznym (Shadow DOM)

- **Jeden główny region scrollowania:** Widok analizy (Analysis Tab) powinien posiadać jeden główny, pionowy obszar przewijania zawierający zarówno podsumowanie (summary), jak i czat. Nie stosujemy oddzielnego scrollowania dla podsumowania.
- **Wysokość kart i obcinanie (Clipping):** Bezpośrednie karty z treścią w głównym kontenerze przewijania muszą zachowywać swoją naturalną wysokość (nie mogą się kurczyć). Długie podsumowania powinny wydłużać obszar przewijania, zamiast powodować wizualne obcięcie treści.
- **Flexbox i Shadow DOM:** Aby uniknąć problemów z przycinaniem zawartości przez hosta Shadow DOM, cały łańcuch elementów `flex` pomiędzy głównym korzeniem a docelową treścią musi zachowywać poprawne ograniczanie wysokości (np. stosując `min-height: 0`).
- **Rola kontenera `#my-ext`:** Ze względu na plugin PostCSS, który zamienia użyte klasy na selektory potomne (np. z `.flex` robi `#my-ext .flex`), element `#my-ext` pełni **wyłącznie** rolę prefiksu izolującego CSS. Klas sterujących głównym układem (takich jak `flex`, `h-screen` czy `overflow`) nie wolno przypisywać bezpośrednio do `<div id="my-ext">`. Należy nakładać je na znajdujący się wewnątrz niego główny element aplikacji.
