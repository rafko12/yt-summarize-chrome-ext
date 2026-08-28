---
description: 'Read when changing module responsibilities, Chrome execution contexts, messaging, storage, build, or manifest.'
globs: '*'
---

# Architektura

Przed zmianą platformy, zależności, buildu albo narzędzi przeczytaj mapę i źródła
prawdy w [`../../TECH_STACK.md`](../../TECH_STACK.md). Przepływy oraz
odpowiedzialności modułów opisuje
[`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Reguły zmian

- Zarządzaj manifestem wyłącznie przez `src/manifest.ts`.
- Umieszczaj decyzje o stanie panelu w sterowniku, a szczegóły `chrome.*` w adapterze Chrome.
- Utrzymuj `src/shared/messages.ts` jako kontrakt niezależny od transportu.
- Zachowuj klucze i akceptowane formaty danych z `STORAGE_KEYS`; zmiana wymaga migracji.
- Wykonuj żądania LLM oraz operacje Historii analiz w panelu, dopóki osobna decyzja architektoniczna nie zmieni kontekstu wykonania.
- Konfiguruj tematy DaisyUI w głównym CSS przez `@plugin "daisyui"`.
- Generuj `dist_chrome` przez build. Artefaktu nie edytuj jako źródła.
