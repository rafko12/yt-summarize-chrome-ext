# YT Summarizer

## Dane lokalne i artefakty buildu

Klucze API, preferencje oraz historia są przechowywane wyłącznie w
`chrome.storage.local`, czyli lokalnie w profilu użytej przeglądarki. Nie są
wysyłane do serwera rozszerzenia. W panelu bocznym, w „Strefie Niebezpiecznej”,
możesz usunąć wszystkie zapisane klucze API i historię jednym działaniem.

Folder `dist_chrome` jest artefaktem buildu i nie jest edytowany ręcznie.
Zawsze generuj go poleceniem `pnpm run build` przed wczytaniem lub wydaniem
rozszerzenia.

YT Summarizer to innowacyjne rozszerzenie do przeglądarki Chrome, które wykorzystuje modele sztucznej inteligencji (Google Gemini, OpenAI GPT, Anthropic Claude), aby błyskawicznie generować podsumowania filmów na YouTube oraz umożliwiać rozmowę z asystentem na temat treści materiału wideo.

## 🌟 Główne Funkcje

- **Błyskawiczne podsumowania**: Jednym kliknięciem generuj dokładne i przejrzyste podsumowania oglądanego filmu, podzielone na logiczne sekcje.
- **Interaktywny Czat z AI**: Zadawaj szczegółowe pytania na temat filmu (np. "O czym prowadzący mówił w 5 minucie?" lub "Wymień najważniejsze porady z tego wideo").
- **Wielu dostawców AI**: Wybór modeli sztucznej inteligencji od Google Gemini, OpenAI oraz Anthropic Claude.
- **Zarządzanie kluczami API**: Wygodne zapisywanie i konfiguracja własnych kluczy API dla każdego dostawcy w panelu opcji.
- **Inteligentne znaczniki czasu**: Wygenerowane podsumowania oraz odpowiedzi czatu zawierają klikalne timestampy, pozwalające szybko przenieść się do konkretnego momentu w filmie.
- **Zapisywanie Historii**: Rozszerzenie automatycznie zapisuje historię podsumowań, pozwalając na powrót do wcześniejszych filmów i konwersacji w dowolnym momencie.
- **Obsługa wielu języków**: Generuj podsumowania i odpowiedzi po polsku i angielsku.
- **Tryb Ciemny / Jasny**: Szybkie przełączanie motywu interfejsu (Light/Dark) w panelu rozszerzenia.

## 🛠️ Technologie

Projekt został zbudowany z wykorzystaniem nowoczesnego stosu technologicznego:

- **React 19**
- **TypeScript**
- **Vite** z pluginem `@crxjs/vite-plugin` (obsługa Manifest V3)
- **Tailwind CSS v4** + **DaisyUI 5** (nowoczesny i responsywny interfejs)
- **Multi-Provider AI API** (Google Gemini API, OpenAI API, Anthropic Claude API)
- **youtube-transcript** (wyciąganie napisów bezpośrednio z filmów)

## ⚙️ Wymagania wstępne

- [Node.js](https://nodejs.org/) (wersja 20.x lub nowsza)
- [pnpm](https://pnpm.io/) (wersja 8.15.0 lub nowsza)
- Klucz API do wybranego dostawcy AI:
  - Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
  - OpenAI API Key ([OpenAI Platform](https://platform.openai.com/))
  - Anthropic API Key ([Anthropic Console](https://console.anthropic.com/))

## 🚀 Instalacja i uruchomienie (Dla deweloperów)

1. Sklonuj repozytorium na swój dysk.
2. Zainstaluj zależności projektu przy pomocy pnpm:
   ```bash
   pnpm install
   ```
3. Uruchom serwer deweloperski Vite z funkcją Hot Module Replacement (HMR):
   ```bash
   pnpm run dev
   ```
4. **Wczytaj rozszerzenie do przeglądarki Chrome**:
   - Otwórz w przeglądarce adres: `chrome://extensions/`
   - Włącz prawym górnym rogu **Tryb dewelopera** (Developer mode).
   - Kliknij **"Załaduj rozpakowane"** (Load unpacked) i wskaż wygenerowany folder `dist_chrome` znajdujący się w głównym katalogu projektu.

## 📦 Budowanie do produkcji

Aby zbudować zoptymalizowaną wersję produkcyjną:

```bash
pnpm run build
```

Wygenerowane pliki znajdziesz w folderze `dist_chrome`.

## 🔑 Konfiguracja rozszerzenia (Klucze API)

Aby rozszerzenie mogło analizować filmy i rozmawiać na ich temat, musisz podać swój własny klucz API:

1. Kliknij ikonę **YT Summarizer** w pasku rozszerzeń przeglądarki lub otwórz opcje rozszerzenia.
2. Przejdź do zakładki **Opcje**.
3. Wklej swój klucz API w sekcji dostawcy (Gemini, OpenAI lub Claude) i zapisz go.
4. Wybierz domyślny model oraz preferowany język podsumowań. Rozszerzenie jest gotowe do pracy!

## 📜 Licencja

Ten projekt jest tworzony na użytek własny i udostępniany w celach demonstracyjnych.
