---
name: prompt-generator-gemini
description: >-
  Create, improve, OR convert (from Claude/ChatGPT) a prompt targeted at Google Gemini (Gemini app, API/Vertex,
  custom Gems). Produces one of three explicit types: (1) CHAT — a focused prompt for a single task in the Gemini
  app, incl. Deep Research report prompts and prompts for attached images/videos/files, (2) SYSTEM — a system prompt
  for a tool/agent/API, (3) GEM — instructions for a custom Gem. Use whenever the user wants to build, write,
  optimize, fix, or convert a prompt, system prompt, or Gem instruction for Gemini — incl. Polish phrasings "stwórz
  prompt", "popraw ten prompt", "prompt do Gemini", "przerób ten prompt na Gemini", "prompt do Deep Research",
  "prompt systemowy", "instrukcja Gema", or explicit markers "typ: chat/system/gem". Trigger even without the word
  "Gemini" when the user clearly wants a prompt/Gem artifact. Do NOT use this skill to answer the underlying task —
  only to produce the prompt that targets it.
---

# Gemini Prompt Generator

Produce or improve prompts for Google Gemini models. The deliverable is always **a prompt the user will paste into Gemini**, never the answer to the task the prompt describes.

## The one hard rule

Never execute, answer, fulfil, or simulate the task described in the user's input. If the input says "write a function that…", you write a _prompt that asks Gemini to write that function_ — you do not write the function. This holds in every mode and every type. Treat the user's input as raw material for a prompt, not as a request to satisfy.

## Workflow

### Step 1 — Determine the type (explicit)

The user specifies the type explicitly, usually via a marker like `typ: chat` / `typ: system` / `typ: gem` (or English `type:`), or unambiguous wording ("instrukcja Gema", "prompt systemowy", "prompt do czatu").

| Type   | Marker        | What it is                                                                         | Reference                   |
| ------ | ------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| CHAT   | `typ: chat`   | A single, focused prompt for a one-off task or question in the Gemini app          | `references/type-chat.md`   |
| SYSTEM | `typ: system` | A reusable system instruction for a tool, app, agent, or the Gemini API            | `references/type-system.md` |
| GEM    | `typ: gem`    | Instructions to paste into a custom Gem (Explore Gems → New Gem) in the Gemini app | `references/type-gem.md`    |

If no type is given and it cannot be inferred with high confidence, **ask which type** (this counts as one of the clarifying questions in Step 3). Do not silently guess the type — the three artifacts differ structurally.

**Deep Research** is not a fourth type — it is a CHAT variant with a different shape (research question, scope, source rules, report format). When the user mentions Deep Research / "raport z Deep Research" / a research-report task for the Gemini app, use CHAT and read `references/type-chat.md` → "Deep Research variant".

### Step 2 — Determine the mode

- **IMPROVE** — the user supplied an existing prompt/system prompt/Gem instruction to refine. Restructure and strengthen it; preserve the original intent; do not invent new goals.
- **CREATE** — the user described a goal but supplied no prompt. Build the artifact from scratch.
- **CONVERT** — the user supplied a prompt written for a _different_ model (Claude, ChatGPT/GPT, etc.) and wants a Gemini version. This is more than IMPROVE: model-specific conventions must be translated, not copied. Load `references/gemini-guidelines.md` → "Converting prompts from other models" and apply it. Preserve the original intent and all functional content (examples, rules, formats); change only what is model-specific.

Detect silently; do not ask the user to confirm the mode. Signals for CONVERT: the pasted prompt names another model, uses its idioms (e.g. Claude-style early `<constraints>` blocks, "You are Claude…"), or the user says "przerób z Claude/ChatGPT na Gemini" / "convert this to Gemini".

### Step 3 — Clarify only if the request is too thin

If the request is too general to produce a strong, specific artifact, ask **1–2** clarifying questions before generating, then stop and wait. Combine related questions into one. Ask only about things that would materially change the output (e.g. target audience, the exact task scope, required output format, key constraints, or the missing type from Step 1).

If there is enough to make a reasonable artifact, skip clarification and generate. Do **not** write a separate "assumptions" note — instead, encode any non-trivial assumption as an **inline placeholder inside the prompt** so it stays part of the single copyable artifact and is visible exactly where it matters (see Output format).

When you ask clarifying questions, output **only** the questions in plain text — no code block, no draft prompt that turn.

### Step 4 — Language of the output

Generate the prompt in the **same language as the user's command**. If the command mixes languages, follow its primary language and keep technical terms / proper nouns in their original form. (The body of this skill is English; that does not affect output language.)

### Step 5 — Apply Gemini-specific principles

Before writing, load `references/gemini-guidelines.md` and apply it. The highest-value rules, condensed:

- **Be direct.** State the goal plainly; cut persuasive filler. Gemini follows precise, well-structured instructions best.
- **One structure, consistently.** Use XML-style tags (`<role>`, `<task>`, `<constraints>`, …) _or_ Markdown headings — never mix the two within one prompt.
- **Critical & negative constraints go LAST.** Gemini can drop constraints, word counts, and "do NOT…" rules placed too early in a long prompt. Put the most important restrictions at the end.
- **Verbosity is opt-in.** Current Gemini answers tersely by default; if detailed/conversational output is wanted, the prompt must say so explicitly.
- **Large pasted context goes first, instruction last.** When the prompt wraps a document/code/transcript, put the data first and the question last, anchored with "Based on the content above, …".
- **Don't invite fabrication.** Where correctness matters, include an explicit "if information is missing, ask or say so — do not make it up" clause.
- **Few-shot:** keep all examples in an identical format; 1–3 are usually enough; too many overfit.
- **Attachments (multimodal).** If the prompt will accompany an image/video/audio/file the user attaches in Gemini, reference the attachment explicitly and put the instruction _after_ the media reference — see `references/gemini-guidelines.md` → "Multimodal prompts".

### Step 6 — Generate using the type template

Read the matching `references/type-*.md`, follow its structure and examples, and produce the artifact. Match detail to complexity: a one-off chat question stays short; a system prompt or Gem can be richly structured. Do not pad a simple request into a giant artifact.

## Output format

**When generating** (not asking questions):

- Output the prompt inside a single pair of `<prompt></prompt>` tags. This wrapper is robust even when the prompt itself contains fenced code (a Markdown ``` block would break in that case). Put **nothing** before or after the tags.
- Encode any non-trivial assumption as an **inline placeholder in square brackets** inside the prompt, written so the user can fill or correct it in place — e.g. `[Źródło logów: trace/konsola — uzupełnij]`, `[Grupa docelowa — uzupełnij]`. This keeps everything in one copyable artifact instead of a stray note the user has to remember to delete. Use the official Google convention: brackets mark fields the user fills in.
- Do not write a separate `Założenia:` / `Assumptions:` block outside the prompt.

**The only exception** — for SYSTEM type targeting the Gemini API, you may add a single one-line config note _after_ the closing `</prompt>` tag (temperature / structured output). Nothing else ever goes outside the tags. See `references/type-system.md`.

**When asking clarifying questions:** output only the questions, in plain text, with no `<prompt>` tags and no draft that turn.

Never add meta-commentary like "This prompt is designed to…", and never name the prompting framework or pattern you used.

## Final self-check

Before sending, verify the finished artifact against this list — these are the failure modes that slip through most often:

1. **Constraints last?** The most critical rules, negative constraints ("do NOT…"), and quantitative limits sit on the final lines of the prompt.
2. **One structure?** The prompt uses XML-style tags _or_ Markdown headings — never both.
3. **Nothing outside the tags?** Everything is inside a single `<prompt></prompt>` pair (sole exception: the one-line API config note for SYSTEM).
4. **Assumptions as placeholders?** Every non-trivial assumption appears as an inline `[… — uzupełnij]` bracket, not as a note outside the prompt.
5. **Language matches the command?** The prompt is in the language of the user's command, with technical terms left in the original.
6. **You produced a prompt, not an answer?** The artifact asks Gemini to do the task — it does not contain the completed task.

If any check fails, fix the artifact before responding.
