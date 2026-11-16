# Step 02 — Research Source Verifier

Checks whether each cited source really says what the research report claims. It does not judge whether the decision is good.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 02 — Research Source Verifier

**Input:** `01_research.md`. Start a **fresh chat**.

Your **only** responsibility is **source-to-claim correspondence**: does each cited source actually say or substantiate what Report 01 attributes to it?

For each material claim R1, R2, etc.:
- Open the cited source if possible and locate the relevant supporting material.
- Identify any qualification, misquotation, wrong number, inaccessible citation, or unsupported leap in what is attributed to that source.
- Classify **Supported / Partially Supported / Unsupported / Contradicted / Unverifiable**. These labels refer to correspondence, **not overall factual truth**.
- Cite the specific passage/section you inspected; do not pretend to have accessed a blocked source.

**Do not** decide whether the proposed choice is worthwhile, evaluate the study's underlying methodology, introduce new research, or audit the overall decision. If a claim is an expressly labeled scenario assumption rather than source-attributed fact, mark it out of scope.

**Output:** `02_source_verification.md`: concise per-claim table (ID, result, source location, explanation), material discrepancies, and gate result **Pass / Revise / Block**. Request targeted correction rather than rewriting the original report. Do not ask the user questions.
```

## Save the reply as `02_source_verification.md`

Save the complete reply as `02_source_verification.md` (Research source verification), with nothing before or after it.

## Check the reply

- [ ] There is a per-claim table with a result for each R claim
- [ ] The report ends with a gate result: Pass, Revise or Block
- [ ] If any important claim is Unsupported or Contradicted, you have decided whether to correct Step 01 first

## What to look for

### Source gate

Find the line that contains “gate”, followed by a colon or dash and the verdict. It should be one of: **Pass**, **Revise**, **Block**. If you can't find one, ask the chat to state it, or judge from the report yourself.

- **Pass**: no action needed; carry on with step 03.
- **Revise**: the check found problems. Fix them before going on. Start a fresh chat, attach `01_research.md` (step 01's earlier output) and `02_source_verification.md` (this report), paste step 01's prompt (`01-independent-researcher.md`) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over `01_research.md`, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.
- **Block**: stop and read the report before going on. If the flagged claims can be corrected, follow the steps for **Revise** above; otherwise decide whether to carry on, knowing that later steps rely on this report.

Correction request to paste after step 01's prompt:

```text
--- CORRECTION REQUEST ---
The task above has already been done once. 01_research.md (attached) is that output. A separate check then reviewed it, and its report, 02_source_verification.md (attached), asks for revisions.

Make the targeted corrections 02_source_verification.md requires, and nothing more:
1. Go through every correction it lists, one by one. For each flagged claim, either correct it to match what the source says, cite a source that does support it, or remove it. Check sources where that helps. Don't skip any.
2. Keep everything it did not flag as it is: same structure, numbering and wording. Do not add new claims.
3. Reply with the complete corrected 01_research.md and nothing else: no notes about what you changed before or after it.
```
