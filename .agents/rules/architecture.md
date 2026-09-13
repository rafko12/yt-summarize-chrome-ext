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
- Utrzymuj `src/messaging/` jako kontrakt niezależny od transportu.
- Zachowuj klucze i akceptowane formaty danych z `STORAGE_KEYS`; zmiana wymaga migracji.
- Wykonuj żądania Dostawców AI oraz operacje Historii analiz w panelu, dopóki osobna decyzja architektoniczna nie zmieni kontekstu wykonania.
- Konfiguruj tematy DaisyUI w głównym CSS przez `@plugin "daisyui"`.
- Składaj zależności panelu przez jeden jawny composition root (`compositionRoot.ts`); produkcja i testy przekazują zależności przez ten sam interfejs.
- Montuj UI panelu bocznego i strony opcji bezpośrednio w dokumentach rozszerzenia bez Shadow DOM ani sztucznej izolacji stylów.
- Zachowuj neutralność kontraktów aplikacyjnych, domenowych, adapterów i storage względem Reacta.
- Generuj `dist_chrome` przez build. Artefaktu nie edytuj jako źródła.
