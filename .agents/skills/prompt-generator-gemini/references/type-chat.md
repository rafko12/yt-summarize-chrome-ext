# Type: CHAT — focused one-off prompt for the Gemini app

**Purpose.** A single, self-contained prompt the user pastes into a normal Gemini chat (gemini.google.com or the app) to get one strong response to one task or question. It is _not_ persistent — optimise for the quality of a single answer, not for reuse.

**Keep it tight.** Gemini rewards directness. Do not inflate a one-off question into a system-prompt-sized artifact. Most chat prompts are a short structured block, not a multi-section document.

## Backbone

Use Google's four prompt areas, including only the ones that earn their place:

- **Persona** — only if a role measurably improves the answer (e.g. "Działasz jako senior QA engineer"). Skip for simple factual questions.
- **Task** — the specific, measurable thing to produce. This is mandatory.
- **Context** — the details Gemini needs and would otherwise guess.
- **Format** — structure, length, and tone of the answer.

Light Markdown or plain labelled lines. One consistent structure. Put any hard constraints (length caps, "do NOT…", exclusions) on the **last** lines.

## Deep Research variant

When the prompt targets Gemini's **Deep Research** mode (an autonomous research agent producing a structured, cited report), the shape changes — a four-line chat prompt wastes the tool. Grounded in Google's own guidance: Deep Research shows an editable research plan before executing and answers follow-up questions afterwards, so the prompt does not need to anticipate everything — it needs to nail the question, scope, and report format.

Structure the prompt around:

- **Research question, not a topic.** "Wpływ X na Y w latach 2024–2026" beats "coś o X". One primary question; sub-questions as a short list if needed.
- **Scope boundaries.** Temporal, geographic, thematic — what is in and what is explicitly out.
- **Source rules.** Preferred source types (official docs, peer-reviewed, filings) and an explicit citation instruction ("Cite all sources / podaj źródła przy każdym twierdzeniu") — this pushes the agent toward live retrieval instead of model memory, and makes the report verifiable.
- **Report format.** Sections, tables/comparisons, length, language. Conflicting-source handling if correctness matters ("gdy źródła są sprzeczne, pokaż oba stanowiska").

Keep persona out unless it genuinely shapes the report. Constraints still go last. Everything still ships inside `<prompt></prompt>`.

## IMPROVE mode

Rewrite the user's raw query: fix clarity and structure, surface the missing context/format slots, and make the intent unambiguous — without changing the goal and without bloating it. Replace vague wording with precise wording.

## CREATE mode

Build the prompt from the user's described goal, filling Task → Context → Format. If a key detail is genuinely missing, ask (per SKILL.md Step 3) rather than inventing it.

## Template

```
[Persona — optional, one line]
Zadanie: <specific task>
Kontekst: <relevant details, inputs, audience>
Format odpowiedzi: <structure / length / tone>
[Critical or negative constraints — last]
```

## Output wrapper

Deliver the finished prompt inside `<prompt></prompt>` tags (see SKILL.md → Output format). Encode missing details as inline `[... — uzupełnij]` placeholders, not as a separate note.

## Example — IMPROVE (Polish input → Polish output)

Input: `typ: chat — popraw: napisz coś o testowaniu API ale krótko i tak żeby junior zrozumiał`

Output:

```
<prompt>
Działasz jako doświadczony QA engineer tłumaczący temat osobie początkującej.
Zadanie: Wyjaśnij, na czym polega testowanie API.
Kontekst: Odbiorca to junior tester bez doświadczenia z API. Skup się na intuicji i jednym konkretnym przykładzie (np. request → response).
Format odpowiedzi: Maksymalnie 200 słów, prosty język, jeden przykład. Żargon tylko z krótkim wyjaśnieniem. Nie wchodź w szczegóły protokołu HTTP.
</prompt>
```

## Example — CREATE (English input → English output)

Input: `type: chat — a prompt that asks Gemini to review my Playwright test for flakiness`

Output:

```
<prompt>
Act as a senior test automation engineer specialising in Playwright + TypeScript.
Task: Review the Playwright test I paste below and identify causes of flakiness.
Context: The codebase uses the Page Object Model and getByTestId locators. I will paste one spec file.
Format: A numbered list. For each issue give: location, why it is flaky, and the concrete fix (prefer web-first assertions and auto-waiting over fixed timeouts).
Constraints: Do not rewrite the whole file. Do not suggest adding waitForTimeout or hardcoded sleeps. If the pasted test is empty or incomplete, say so and ask for it instead of guessing.

[Paste your Playwright test below this line.]
</prompt>
```
