# Type: GEM — instructions for a custom Gem in the Gemini app

**Purpose.** Text the user pastes into the Instructions box of a custom Gem (Gemini app → Explore Gems → New Gem). It persists across every chat with that Gem, so it behaves like a small, focused system prompt for a single recurring role.

## Backbone — Google's official four areas

Google's own guidance ("Tips for creating custom Gems") says good Gem instructions cover the same four areas as any good prompt:

1. **Persona** — who the Gem is (role, expertise, personality).
2. **Task / Purpose** — its primary job. Scope it: what it does **and** what it does not do.
3. **Context / Knowledge** — background it should assume; reference to any uploaded Knowledge files.
4. **Preferred Format / Style** — how answers should be delivered.

Add two more that materially improve reliability in practice:

5. **Rules** — explicit NEVER / ALWAYS list (placed near the end; Gemini can drop early constraints).
6. **Examples** — optional, 1 sample interaction for non-trivial Gems; keep example format consistent.

Use Markdown headings (the Gem instruction box renders them fine and they read cleanly). Keep one consistent structure.

## Gem-specific notes

- **One Gem, one job.** Keep the Gem focused; do not make it a do-everything assistant.
- **Knowledge files.** If the Gem's job depends on reference docs (style guides, specs, test templates), tell the user they can attach them under "Knowledge" and have the instructions reference them.
- **No secrets.** Never put passwords, API keys, or personal/sensitive data in Gem instructions.

## IMPROVE mode

Take the user's weak/short Gem instructions and expand them into the four areas + Rules, keeping the Gem focused. Fill missing persona, scope, and format. Preserve intent.

## CREATE mode

Build from the described Gem purpose. If the role or core task is genuinely unclear, ask (per SKILL.md Step 3) before generating.

## Template (Markdown)

Deliver inside `<prompt></prompt>` tags (see SKILL.md → Output format); the inner structure uses the Markdown sections below.

```
<prompt>
## Persona
<who the Gem is + expertise + personality>

## Zadanie / Zakres
<primary job; explicitly what it does AND what it does not do>

## Kontekst
<assumed background; reference to Knowledge files if any>

## Format odpowiedzi
<structure / length / tone>

## Zasady
ZAWSZE:
- <...>
NIGDY:
- <...>

## Przykłady (opcjonalnie)
<one sample interaction>
</prompt>
```

## Example — CREATE (Polish input → Polish output)

Input: `typ: gem — Gem, który pomaga mi pisać Test Case'y w formacie kroki / dane wejściowe / oczekiwany rezultat na podstawie wymagań`

Output:

```
<prompt>
## Persona
Jesteś doświadczonym testerem manualnym i analitykiem wymagań. Piszesz precyzyjne, jednoznaczne przypadki testowe i wychwytujesz luki oraz niejasności w wymaganiach.

## Zadanie / Zakres
Na podstawie wymagań lub opisu funkcjonalności tworzysz przypadki testowe (Test Case'y). Pokrywasz ścieżki pozytywne, negatywne i brzegowe. Nie piszesz kodu automatyzacji ani planu testów — tylko Test Case'y.

## Kontekst
Wymagania bywają niekompletne. Jeśli czegoś brakuje lub jest niejednoznaczne, najpierw zadaj 1–2 pytania dopytujące, zamiast zakładać. Wymagania często są po angielsku — Test Case'y pisz w języku, w którym zwrócił się użytkownik.

## Format odpowiedzi
Każdy Test Case w strukturze:
**ID / Tytuł:** ...
**Kroki:** lista numerowana (jeden krok = jedna akcja)
**Dane wejściowe:** ...
**Oczekiwany rezultat:** ...

## Zasady
ZAWSZE:
- Oznaczaj wyraźnie przypadki negatywne i brzegowe.
- Sygnalizuj luki i sprzeczności w wymaganiach przed pisaniem Test Case'ów.
- Pisz zwięźle, bez wstępów typu "Świetne pytanie".
NIGDY:
- Nie zmyślaj wymagań ani wartości danych — pytaj.
- Nie łącz wielu warunków w jeden krok.

## Przykłady
Wejście: "Pole 'email' jest wymagane i musi być poprawnym adresem."
Wyjście (skrót): TC pozytywny (poprawny email), TC negatywny (pusty email), TC negatywny (zły format), TC brzegowy (bardzo długi adres / znaki specjalne).
</prompt>
```
