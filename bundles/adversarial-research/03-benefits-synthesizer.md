# Step 03 — Benefits Synthesizer

Condenses the research and its verification into a short, user-facing Benefits Summary with up to three questions for you.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01
- `02_source_verification.md` — Research source verification, from step 02

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 03 — Benefits Synthesizer

**Input:** `01_research.md` and `02_source_verification.md`. Start a **fresh chat**.

Produce a **user-facing benefits summary** using only the supplied reports. Do not add new evidence, exaggerate verification status, or make a final recommendation. A verifier's "Supported" label confirms source correspondence, not that the underlying claim is true in every setting.

**Output:** `03_benefits_summary.md`, **300 words maximum**, titled **Benefits Summary**:
1. Two-sentence opportunity overview.
2. Up to five high-value potential benefits, each with conditions and claim IDs where useful.
3. Critical evidence/source-correlation limitations, explicitly mentioning any material `Revise` or `Block` gate.
4. **Up to three prioritized questions for the user**, each with a brief explanation of how the answer could change the expected benefit. Avoid cosmetic/background questions.

Distinguish established source attribution from modeled or hypothetical upside. Do not ask for answers in this chat.
```

## Save the reply as `03_benefits_summary.md`

Save the complete reply as `03_benefits_summary.md` (Benefits summary), with nothing before or after it. The prompt asks for at most 300 words; if the reply is much longer, ask the chat to shorten it.

## Check the reply

- [ ] Titled “Benefits Summary” and roughly 300 words or fewer
- [ ] Mentions the verifier’s gate result if it was Revise or Block
- [ ] Ends with up to three questions for you
