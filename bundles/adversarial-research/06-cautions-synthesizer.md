# Step 06 — Cautions Synthesizer

Condenses the critique and its verification into a short Cautions Summary with up to three more questions for you.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01
- `02_source_verification.md` — Research source verification, from step 02
- `03_benefits_summary.md` — Benefits summary, from step 03
- `04_critique.md` — Adversarial critique, from step 04
- `05_critique_verification.md` — Critique source verification, from step 05

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 06 — Cautions Synthesizer

**Input:** All preceding five reports (`01_research.md` through `05_critique_verification.md`). Start a **fresh chat**.

Produce the human-facing caution summary from the supplied record. Do not introduce new facts or treat an unsupported sourced objection as proven. A logical objection can matter even when source verification is not applicable.

**Output:** `06_cautions_summary.md`, **300 words maximum**, titled **Cautions Summary**:
1. Up to five high-consequence risks, pitfalls, or alternative considerations.
2. For each, note which proposed benefit it changes, when it matters, and whether evidence was source-correlated, partly verified, unverifiable, or logically conditional (cite C IDs).
3. Briefly distinguish genuine potential dealbreakers from manageable tradeoffs; do not force a negative outcome.
4. Flag material verifier `Revise` or `Block` outcomes still outstanding.
5. **Up to three prioritized questions for the user** whose answers would materially change the cautions. Avoid repeating questions from the Benefits Summary unless necessary; when unavoidable, consolidate them.

No definitive recommendation, new external research, or request for immediate conversational answers.
```

## Save the reply as `06_cautions_summary.md`

Save the complete reply as `06_cautions_summary.md` (Cautions summary), with nothing before or after it. The prompt asks for at most 300 words; if the reply is much longer, ask the chat to shorten it.

## Check the reply

- [ ] Titled “Cautions Summary” and roughly 300 words or fewer
- [ ] Separates potential dealbreakers from manageable tradeoffs
- [ ] Ends with up to three questions for you
