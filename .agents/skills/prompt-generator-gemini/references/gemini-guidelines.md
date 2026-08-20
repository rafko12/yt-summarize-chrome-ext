# Gemini-specific prompting guidelines

Grounded in Google's official guidance: Gemini API "Prompt design strategies" (ai.google.dev), the Gemini 3 prompting guide (Google Cloud), and Gemini Apps Help "Tips for creating custom Gems". Apply these to every type. They reflect the current Gemini generation (Gemini 3-era) and supersede generic, model-agnostic prompt habits.

## Core principles

1. **Directness over verbosity.** State the goal clearly and concisely. Avoid persuasive or padded language ("please be very thorough and amazing"). Gemini responds best to direct, well-structured instructions that define the task and constraints precisely.

2. **One consistent structure.** Use clear delimiters: either XML-style tags (`<context>`, `<task>`, `<constraints>`, `<output_format>`) **or** Markdown headings. Pick one and use it consistently inside a single prompt — do not mix XML and Markdown.

3. **Define ambiguous terms.** Explicitly define any jargon, acronym, or parameter the model could misread. Undefined domain terms degrade output.

4. **Verbosity is opt-in.** By default current Gemini models are terse and prioritise direct answers. If you want a conversational, detailed, or "chatty" response, the prompt must explicitly request it (e.g. "Explain this as a friendly, talkative assistant").

5. **Critical constraints go last.** On longer prompts Gemini may drop constraints that appear too early — especially negative constraints ("do NOT…") and quantitative limits (word counts, item counts, format rules). Place the core request and the most important restrictions as the **final** lines of the instruction. Negative constraints in particular belong at the end.

6. **Large context first, instruction last.** When the prompt wraps a big block of data (a document, codebase, transcript), put the data first and the actual question/instruction after it. Anchor the model with a phrase like "Based on the content above, …". This keeps reasoning tied to the provided data.

7. **Persona is taken seriously.** Gemini adheres strongly to an assigned persona and may even override other instructions to stay in character. Keep the persona unambiguous and consistent with the task; avoid persona descriptions that conflict with the required behaviour.

8. **Guard against fabrication.** The model may fall back on its own knowledge over provided context, and may invent answers when context is missing. Where correctness matters, add an explicit clause: "If required information is missing, ask for it or state that it is missing — do not fabricate." For retrieval-style tasks, a verify-then-answer pattern helps ("First confirm X is available; if not, say 'No info' and stop; otherwise answer").

9. **Few-shot examples.** Examples can steer format and length effectively. Keep the structure and formatting of all examples identical, or Gemini may produce inconsistent formats. 1–3 examples are usually enough; too many cause the model to overfit to the examples.

10. **Prompt hygiene.** Typos in task keywords, broken grammar, run-on fragments, and sloppy punctuation measurably hurt Gemini's interpretation. Keep the generated prompt clean.

## Multimodal prompts (attachments)

For prompts that will accompany an attachment the user adds in Gemini (image, video, audio, PDF/file):

- **Reference the attachment explicitly.** Name what is attached and what to look at ("Na załączonym zrzucie ekranu formularza logowania…"), instead of assuming the model will infer the connection.
- **Media first, instruction after.** Same principle as large text context: the instruction and constraints go after the media reference, anchored with "Based on the attached image/file, …".
- **Say what to extract, not just "analyse".** Specify the elements that matter (fields, error messages, timestamps, UI states) — vague "opisz obrazek" invites generic output.
- **Guard the missing-attachment case.** Add a clause: if no file is attached or it is unreadable, say so and ask for it — do not answer from general knowledge.
- Include a visible slot in the prompt when relevant: `[Załącz plik/zrzut ekranu przed wysłaniem]`.

## Converting prompts from other models (CONVERT mode)

When translating a prompt written for Claude, ChatGPT/GPT, or another model into a Gemini prompt, keep the intent and functional content; translate the model-specific conventions:

- **Move constraints to the end.** Claude-style prompts often front-load `<constraints>` or rule blocks; Gemini can drop early constraints, so relocate the critical/negative ones to the final lines.
- **Enforce one structure.** Prompts for other models often mix XML tags with Markdown headings. Pick one (XML-style for SYSTEM, Markdown or labelled lines otherwise) and normalise the whole prompt to it.
- **Strip other-model idioms.** Remove/replace "You are Claude/ChatGPT…", references to other vendors' features (Projects, Artifacts, canvas, custom GPT actions), and instructions that only make sense for that model's UI. Map features to Gemini equivalents where they exist (e.g. knowledge files → Gem "Knowledge", custom GPT → Gem) and flag with an inline placeholder where they don't.
- **Trim persuasive padding.** Politeness/emphasis padding ("please be extremely thorough…") tuned for other models is dead weight — replace with direct, precise instructions.
- **Re-check verbosity.** Other models may be chatty by default; Gemini is terse. If the original relied on default verbosity, make the desired detail level explicit.
- **Keep examples, normalise their format.** Few-shot examples survive conversion, but make all of them structurally identical.
- Do not silently drop functionality. If a piece of the original cannot be reproduced in Gemini, keep a placeholder noting it: `[Funkcja X nie ma odpowiednika w Gemini — zdecyduj czy usunąć]`.

## API / system-instruction extras (SYSTEM type only)

- **Structured output.** For strict/complex JSON, prompting alone is unreliable. Note that the Gemini API has a dedicated structured-output / response-schema feature and recommend it instead of describing the JSON shape only in prose.
- **Temperature.** For Gemini 3 models, keep `temperature` at its default of 1.0. Lowering it can cause looping or degraded reasoning, especially on math/reasoning tasks. This is a configuration note for the user, not text that goes inside the prompt.

## Gem extras (GEM type only)

- Google's official "four areas" for good Gem instructions are the same four as for any good prompt: **Persona, Task/Purpose, Context/Knowledge, Preferred Format/Style.** Use these as the backbone.
- Keep each Gem focused on a single role/task — separate Gems beat one do-everything Gem.
- Provide at least one concrete example (sample input + ideal response) for non-trivial Gems.
- Never put passwords, API keys, or personal/sensitive data in Gem instructions.
- Gems can take uploaded "Knowledge" files for grounding — mention this when the Gem's job depends on reference documents the user has.
