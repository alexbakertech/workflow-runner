# Step 02 — Source Checker

Checks each numbered claim against its source.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 02 — Source Checker

For each numbered claim in `01_research.md`, open its source and say whether the source supports it: Supported, Partly supported, or Not supported, with one sentence of explanation.

**Output:** `02_check.md`, 400 words maximum, titled **Source Check**. End with a heading line in exactly this form: `## Gate result: Pass`, `## Gate result: Revise` or `## Gate result: Block`.
```

## Save the reply as `02_check.md`

Save the complete reply as `02_check.md` (Source check), with nothing before or after it. The prompt asks for at most 400 words; if the reply is much longer, ask the chat to shorten it.

## What to look for

### Source gate

Find the line that contains “gate”, followed by a colon or dash and the verdict. It should be one of: **Pass**, **Revise**, **Block**. If you can't find one, ask the chat to state it, or judge from the report yourself.

- **Pass**: no action needed; carry on with step 02b.
- **Revise**: the check found problems. Fix them before going on. Start a fresh chat, attach `01_research.md` (step 01's earlier output) and `02_check.md` (this report), paste step 01's prompt (`01-researcher.md`) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over `01_research.md`, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.
- **Block**: stop and read the report before going on. If the flagged claims can be corrected, follow the steps for **Revise** above; otherwise decide whether to carry on, knowing that later steps rely on this report.

Correction request to paste after step 01's prompt:

```text
--- CORRECTION REQUEST ---
The task above has already been done once. 01_research.md (attached) is that output. A separate check then reviewed it, and its report, 02_check.md (attached), asks for revisions.

Make the targeted corrections 02_check.md requires, and nothing more:
1. Go through every correction it lists, one by one. For each flagged claim, either correct it to match what the source says, cite a source that does support it, or remove it. Check sources where that helps. Don't skip any.
2. Keep everything it did not flag as it is: same structure, numbering and wording. Do not add new claims.
3. Reply with the complete corrected 01_research.md and nothing else: no notes about what you changed before or after it.
```
