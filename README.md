# YT Summarizer

Rozszerzenie dla Google Chrome, które pobiera transkrypcję filmu z YouTube, tworzy podsumowanie za pomocą wybranego modelu AI i pozwala prowadzić rozmowę dotyczącą filmu.

## Funkcje

- podsumowania z klikalnymi znacznikami czasu;
- rozmowa dotycząca treści filmu;
- Gemini, OpenAI i Anthropic jako Dostawcy AI;
- wybór języka i modelu;
- Historia analiz z możliwością ponownego otwarcia;
- jasny i ciemny motyw;
- lokalny lub przypięty panel boczny.

## Wymagania

- Google Chrome w wersji zgodnej z `minimum_chrome_version` w
  [`src/manifest.ts`](src/manifest.ts);
- Node.js i pnpm w wersjach zadeklarowanych w [`package.json`](package.json);
- własny klucz wybranego Dostawcy AI.

Projekt wspiera wyłącznie Google Chrome. Zobacz [ADR-0001](docs/adr/0001-google-chrome-jako-jedyna-wspierana-przegladarka.md).

## Technologie

Rozszerzenie łączy Chrome Manifest V3, TypeScript, React, Vite z CRXJS,
Tailwind CSS z DaisyUI oraz Vitest z Testing Library. Pełna mapa technologii,
ich odpowiedzialności i plików źródłowych znajduje się w
[`TECH_STACK.md`](TECH_STACK.md).

## Uruchomienie deweloperskie

```bash
pnpm install
pnpm run dev
```

Następnie otwórz `chrome://extensions/`, włącz tryb dewelopera, wybierz „Załaduj rozpakowane” i wskaż `dist_chrome`.

## Build i jakość

```bash
pnpm run build
pnpm check
```

`dist_chrome` jest generowanym artefaktem. Nie należy edytować go ręcznie.

## Dane i prywatność

Klucze API, ustawienia, Historia analiz oraz motyw są przechowywane lokalnie w profilu Chrome przez `chrome.storage.local`. Rozszerzenie nie ma własnego serwera pośredniczącego. Gdy użytkownik wybiera Dostawcę AI, panel wysyła do jego interfejsu sieciowego klucz oraz dane potrzebne do wygenerowania odpowiedzi.

W ustawieniach rozszerzenia można usunąć zapisane klucze API i Historię analiz. Zmiana nazw lub formatów zapisanych danych wymaga migracji, aby aktualizacja rozszerzenia nie utraciła danych użytkownika.

## Dokumentacja techniczna

- [Stos technologiczny](TECH_STACK.md)
- [Architektura](ARCHITECTURE.md)
- [Plan refaktoru](REFACTOR.md)
- [Słownik domeny](CONTEXT.md)
- [Decyzje architektoniczne](docs/adr/)
- [Manualna lista kontrolna regresji](docs/manual-regression-checklist.md)
