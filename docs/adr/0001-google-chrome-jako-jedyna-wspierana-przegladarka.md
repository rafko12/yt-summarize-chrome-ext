# Google Chrome jako jedyna wspierana przeglądarka

Rozszerzenie wspiera wyłącznie Google Chrome w wersji zgodnej z minimalną wersją zadeklarowaną w manifeście. Implementacja zależy od interfejsu `chrome.sidePanel`, dlatego pozostałości konfiguracji Firefoksa i deklaracje zgodności przez `webextension-polyfill` zostaną usunięte; ewentualne wsparcie innych przeglądarek będzie osobną zmianą funkcjonalną wymagającą adapterów i odrębnych testów.
