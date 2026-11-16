# Step 05 — Critique Source Verifier

Checks that the critic’s new factual counterclaims match their cited sources. Purely logical objections are marked Not Applicable.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01
- `02_source_verification.md` — Research source verification, from step 02
- `03_benefits_summary.md` — Benefits summary, from step 03
- `04_critique.md` — Adversarial critique, from step 04

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 05 — Critique Source Verifier

**Input:** `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`, `04_critique.md`. Start a **fresh chat**.

Your **only** responsibility is to check **source-to-claim correspondence** for the **new factual counterclaims** the critic attributes to cited sources.

For each numbered objection C1, C2, etc.:
- Identify any sourced external factual assertion and inspect the specific cited material where accessible.
- Classify that correspondence **Supported / Partially Supported / Unsupported / Contradicted / Unverifiable**.
- If an objection is purely logical, conditional, mathematical, or hypothetical with no attributed external source, classify source checking as **Not Applicable — Nonfactual**. This does **not** mean the objection is wrong.
- State what section/passage was inspected and note blocked sources honestly.

**Do not** adjudicate whether the critic wins, re-evaluate overall merit, or generate competing arguments. Do not expand into a general arithmetic/model audit.

**Output:** `05_critique_verification.md`: compact objection-by-objection source correspondence table; material discrepancies; **Pass / Revise / Block** source gate. Request targeted evidence correction when needed. Do not ask interactive questions.
```

## Save the reply as `05_critique_verification.md`

Save the complete reply as `05_critique_verification.md` (Critique source verification), with nothing before or after it.

## Check the reply

- [ ] There is a table covering each C objection
- [ ] The report ends with a source gate: Pass, Revise or Block
- [ ] If material citations failed, you have decided whether to correct Step 04 first

## What to look for

### Source gate

Find the line that contains “gate”, followed by a colon or dash and the verdict. It should be one of: **Pass**, **Revise**, **Block**. If you can't find one, ask the chat to state it, or judge from the report yourself.

- **Pass**: no action needed; carry on with step 06.
- **Revise**: the check found problems. Fix them before going on. Start a fresh chat, attach `04_critique.md` (step 04's earlier output) and `05_critique_verification.md` (this report), plus step 04's own input files (`01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`), paste step 04's prompt (`04-adversarial-critic.md`) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over `04_critique.md`, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.
- **Block**: stop and read the report before going on. If the flagged claims can be corrected, follow the steps for **Revise** above; otherwise decide whether to carry on, knowing that later steps rely on this report.

Correction request to paste after step 04's prompt:

```text
--- CORRECTION REQUEST ---
The task above has already been done once. 04_critique.md (attached) is that output. A separate check then reviewed it, and its report, 05_critique_verification.md (attached), asks for revisions.

Make the targeted corrections 05_critique_verification.md requires, and nothing more:
1. Go through every correction it lists, one by one. For each flagged claim, either correct it to match what the source says, cite a source that does support it, or remove it. Check sources where that helps. Don't skip any.
2. Keep everything it did not flag as it is: same structure, numbering and wording. Do not add new claims.
3. Reply with the complete corrected 04_critique.md and nothing else: no notes about what you changed before or after it.
```
