# Step 07 — Decision Synthesizer

Combines both perspectives with your answers into a short, conditional decision brief with a suggested next action.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `03_benefits_summary.md` — Benefits summary, from step 03
- `06_cautions_summary.md` — Cautions summary, from step 06
- `02_source_verification.md` — Research source verification, from step 02
- `05_critique_verification.md` — Critique source verification, from step 05
- `user_responses.md` — Your responses, from step 06b
- `01_research.md` — Research report, from step 01 (optional: include it if you want this step to see it)
- `04_critique.md` — Adversarial critique, from step 04 (optional: include it if you want this step to see it)

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 07 — User-Informed Decision Synthesizer

**Input:** `03_benefits_summary.md`, `06_cautions_summary.md`, `02_source_verification.md`, `05_critique_verification.md`, and `user_responses.md`. Provide `01_research.md` and `04_critique.md` as well if claim-level context is needed. Start a **fresh chat**.

You are combining **two independently developed perspectives and the user's answers** into a brief, user-specific decision aid. The user has already reviewed the summaries and chosen to proceed.

1. Explain which potential benefits apply or fail to apply based on supplied user context.
2. Explain which cautions are applicable, reduced, increased, or still unresolved.
3. Maintain the distinction between **verified source correspondence**, reasoned inference, scenario assumptions, and factual claims the user supplied but no independent source checked.
4. Do not invent new research, silently treat user assertions as external verification, or assert certainty where source/reasoning gaps remain.
5. If critical questions cannot be resolved with the record, recommend further investigation instead of deciding by fiat.
6. Refer back to report IDs/claim IDs where it materially improves traceability.

**Output:** `07_decision_brief.md`, **400 words maximum**, titled **User-Informed Decision Brief**:
- Current assessment (2–3 sentences)
- Relevant benefits and their conditions
- Relevant cautions and remaining uncertainties
- **Suggested next action:** Proceed / Proceed conditionally / Investigate further / Do not proceed — with brief rationale
- At most three material unanswered questions

This is **decision support**. The human remains the final decision-maker. Do not launch another iteration or ask interactive questions.
```

## Save the reply as `07_decision_brief.md`

Save the complete reply as `07_decision_brief.md` (Decision brief), with nothing before or after it. The prompt asks for at most 400 words; if the reply is much longer, ask the chat to shorten it.

## Check the reply

- [ ] Titled “User-Informed Decision Brief” and roughly 400 words or fewer
- [ ] Gives a suggested next action with a rationale
- [ ] Your own facts are not presented as independently verified

## What to look for

### Suggested next action

Find the line that contains “next action”, followed by a colon or dash and the verdict. It should be one of: **Proceed conditionally**, **Investigate further**, **Do not proceed**, **Proceed**. If you can't find one, ask the chat to state it, or judge from the report yourself.

- **Proceed conditionally**: no action needed; this is the final result. Any conditions it names still apply.
- **Investigate further**: the reply says more research is needed. You can do a short follow-up research session (`extras/follow-up-research.md`) or a full new round (`extras/next-round.md`), or accept the result as it stands.
- **Do not proceed**: no action needed; this is the final result. Any conditions it names still apply.
- **Proceed**: no action needed; this is the final result. Any conditions it names still apply.
