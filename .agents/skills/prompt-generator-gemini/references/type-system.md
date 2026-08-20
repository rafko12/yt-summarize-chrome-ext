# Type: SYSTEM — reusable system instruction for a tool / agent / API

**Purpose.** A persistent system instruction that configures Gemini's behaviour across every request in a project, tool, agent, or Gemini API integration. Unlike a chat prompt, it is written once and applied repeatedly, so it must be self-contained and unambiguous.

## Backbone

Use **one** consistent structure. XML-style tags are recommended for system prompts because they give the model clean boundaries between instructions and data:

- `<role>` — who the model is (persona + expertise). Keep it unambiguous; Gemini adheres strongly to personas.
- `<objective>` — the single primary goal of the system.
- `<capabilities>` / `<instructions>` — what it does and how; step-by-step workflow if multi-phase.
- `<output_format>` — exact structure of every response.
- `<examples>` — 1–3 input→output examples, identical format (only for non-trivial behaviour).
- `<error_handling>` — what to do when required input is missing.
- `<constraints>` — NEVER / ALWAYS rules. **Place this block last**, since Gemini can drop early constraints. Put negative constraints here.

(Markdown headings are an acceptable alternative — but never mix tags and headings in one prompt.)

## Apply the Gemini rules (see gemini-guidelines.md)

- Critical and negative constraints at the **end**.
- Verbosity opt-in: if the tool should be terse, say so; if verbose, say so.
- Explicit anti-fabrication clause in `<error_handling>`.
- For strict JSON output, recommend the API's structured-output feature rather than describing JSON only in prose.

## IMPROVE mode

Restructure the existing system prompt: enforce one consistent delimiter style, fill gaps (missing output format, missing error handling, ambiguous persona), and move critical/negative constraints to the end. Preserve the original purpose.

## CREATE mode

Build from the described tool/agent purpose. Scope capabilities explicitly — state what the system does **and** what it must not do.

## Template (XML-style)

Deliver inside `<prompt></prompt>` tags (see SKILL.md → Output format); the inner structure uses the tags below.

```
<prompt>
<role>
You are <role + expertise>.
</role>

<objective>
<the single primary goal>
</objective>

<instructions>
<how it operates; numbered steps if multi-phase>
</instructions>

<output_format>
<exact structure of every response>
</output_format>

<error_handling>
If required input is missing or ambiguous, ask for it or state what is missing. Never fabricate data, sources, or numbers.
</error_handling>

<constraints>
ALWAYS:
- <...>
NEVER:
- <...>
</constraints>
</prompt>
```

## Config note (output it AFTER the closing `</prompt>` tag, only if Gemini API is the target)

This is the one thing allowed outside the `<prompt></prompt>` tags. One line, only when relevant:

- Keep `temperature` at the default 1.0 for Gemini 3 models; lowering it can cause looping/degraded reasoning.
- For strict JSON, use the API's structured-output / response-schema feature instead of relying on the prompt alone.

## Example — CREATE (Polish input → Polish output)

Input: `typ: system — system prompt dla narzędzia, które z opisu buga generuje zgłoszenie w formacie kroki/dane wejściowe/oczekiwany rezultat`

Output:

```
<prompt>
<rola>
Jesteś asystentem QA, który przekształca surowe opisy błędów w ustrukturyzowane zgłoszenia.
</rola>

<cel>
Na podstawie opisu błędu od użytkownika wygeneruj jedno kompletne zgłoszenie buga.
</cel>

<instrukcje>
1. Wyodrębnij z opisu: tytuł, środowisko, kroki reprodukcji, dane wejściowe, rezultat oczekiwany, rezultat rzeczywisty.
2. Jeśli któregoś elementu brakuje, oznacz go jako "Brak — do uzupełnienia", zamiast zgadywać.
3. Kroki numeruj; jeden krok = jedna akcja.
</instrukcje>

<format_odpowiedzi>
**Tytuł:** ...
**Środowisko:** ...
**Kroki reprodukcji:** lista numerowana
**Dane wejściowe:** ...
**Rezultat oczekiwany:** ...
**Rezultat rzeczywisty:** ...
</format_odpowiedzi>

<obsluga_brakow>
Jeśli opis jest pusty lub niejednoznaczny, poproś o brakujące informacje. Nigdy nie zmyślaj kroków, danych ani wartości.
</obsluga_brakow>

<ograniczenia>
ZAWSZE:
- Pisz zwięźle, bez komentarza spoza formatu zgłoszenia.
- Zachowaj dokładnie sekcje z <format_odpowiedzi>.
NIGDY:
- Nie dodawaj rozwiązania ani diagnozy przyczyny, jeśli użytkownik o to nie poprosił.
- Nie łącz wielu błędów w jedno zgłoszenie.
</ograniczenia>
</prompt>
```

Config (Gemini API): trzymaj `temperature` na domyślnym 1.0 dla modeli Gemini 3.
