---
description: 'Read when changing module responsibilities, Chrome execution contexts, messaging, storage, build, or manifest.'
globs: '*'
---

# Architektura i technologia

## Platforma

- React 19 i TypeScript.
- Vite z `@crxjs/vite-plugin`.
- Manifest V3 dla Google Chrome; projekt nie utrzymuje wariantu Firefoksa.
- Tailwind CSS v4, DaisyUI 5 i PostCSS.
- Vitest oraz Testing Library dla testów automatycznych.

Pełny opis przepływów i odpowiedzialności znajduje się w [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md). Nie kopiuj jego treści do tej reguły.

## Reguły zmian

- Zarządzaj manifestem wyłącznie przez `src/manifest.ts`.
- Umieszczaj decyzje o stanie panelu w sterowniku, a szczegóły `chrome.*` w adapterze Chrome.
- Utrzymuj `src/shared/messages.ts` jako kontrakt niezależny od transportu.
- Zachowuj klucze i akceptowane formaty danych z `STORAGE_KEYS`; zmiana wymaga migracji.
- Wykonuj żądania LLM oraz operacje Historii analiz w panelu, dopóki osobna decyzja architektoniczna nie zmieni kontekstu wykonania.
- Konfiguruj tematy DaisyUI w głównym CSS przez `@plugin "daisyui"`.
- Generuj `dist_chrome` przez build. Artefaktu nie edytuj jako źródła.
