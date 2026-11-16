# Release Cadence Review — all in one file

This is the whole prompt bundle for `release-cadence` in a single document. Each section below is one file of the folder version. Save replies under the file names the steps give.

## Contents

- [Release Cadence Review](#release-cadence-review)
- [Before you start: fill in your details](#before-you-start-fill-in-your-details)
- [Step 01 — Researcher](#step-01--researcher)
- [Step 02 — Source Checker](#step-02--source-checker)
- [Step 02b — Your Review (you do this one)](#step-02b--your-review-you-do-this-one)
- [Step 03 — Recommender](#step-03--recommender)
- [Next round: running the workflow again](#next-round-running-the-workflow-again)
- [Follow-up research](#follow-up-research)

---

# Release Cadence Review

A small example workflow: research a decision, check the sources, review the findings yourself, then get a recommendation. Shows every feature of the workflow format.

This is a prompt bundle for the workflow `release-cadence` (version 1.1.0). It lets you follow the whole workflow by hand in any chat app, without running Workflow Runner.

## About this workflow

- Step 01 researches the decision and lists open questions for you.
- Step 02 checks that the cited sources say what the research claims.
- You review both, answer the questions, and choose to continue, run another round, pause or stop.
- Step 03 writes a short recommendation. If it says to investigate further, you can do a quick follow-up or a new round.

In these notes, “this guide” means this bundle, and “copy it back into this guide” means save the reply as the file the step names.

## How to use this bundle

1. Open “Before you start: fill in your details” and write down your answers. You'll need them in the prompts.
2. Go through the steps below in order. For each AI step, open a **fresh chat**, a new conversation in any AI tool. Never continue an earlier chat: keeping steps apart is the point of the workflow.
3. Attach or paste **only** the files that step lists, nothing else. Then paste the step's prompt. Replace each marker such as `[YOUR …]` with your own answer first.
4. Save each reply, complete and with nothing added, under the file name the step gives. Keep all saved files together in one folder, because later steps ask for them.
5. Review steps are done by you, with no AI. Their file is a worksheet; fill it in and save it under the name it gives.
6. If a step's result tells you more work is needed, “Next round: running the workflow again” explains how to run another round, and “Follow-up research” has the prompt for a follow-up research session.

## Steps

| # | Step | Who | Inputs → output |
|---|---|---|---|
| 01 | [Researcher](#step-01--researcher) | AI chat | your fill-in answers → `01_research.md` |
| 02 | [Source Checker](#step-02--source-checker) | AI chat | `01_research.md` → `02_check.md` |
| 02b | [Your Review](#step-02b--your-review-you-do-this-one) | You | `01_research.md`, `02_check.md` → `review_answers.md` |
| 03 | [Recommender](#step-03--recommender) | AI chat | `01_research.md`, `02_check.md`, `review_answers.md` → `03_recommendation.md` |

## What you lose without the app

- **No enforced isolation.** In the app each step sees only the files it is meant to see. By hand, nothing stops you pasting the wrong file, or carrying on in an old chat. The workflow works because each step is kept apart, so be strict about it.
- **Verdicts aren't acted on automatically.** The app reads the verdict lines (gate results, recommendations), warns you, and offers the fix. By hand, you have to find those lines yourself and follow the instructions in each step file.
- **No run record or hashes.** The app saves one run file with the workflow, every prompt, every output, and integrity hashes. Here you only have the files you saved; nothing proves which prompt text or inputs produced them.
- **More copying.** You assemble each message yourself: fill in the markers, attach the right files, save each reply under the right name, and repeat for every step and every round.

This bundle was exported from Workflow Runner, the app that runs these workflows for you. More about it: https://github.com/alexbakertech/workflow-runner

---

# Before you start: fill in your details

The prompts contain markers in square brackets, such as `[YOUR DECISION TO INVESTIGATE]`. Write your answers below (or in your own notes). Before you paste a prompt into a chat, replace each marker, **including the square brackets**, with your answer.

If you leave an optional item blank, also delete the sentence or paragraph around its marker so the prompt doesn't end up with a gap.

## Your details

### 1. Decision to investigate (required)

One sentence, phrased as a question.

Example: *Should our team move from weekly to biweekly releases?*

Marker in the prompts: `[YOUR DECISION TO INVESTIGATE]`

**Your answer:** ________________________________________

### 2. Background (optional)

Team size, product, constraints. Leave blank if none.

Marker in the prompts: `[YOUR BACKGROUND (OPTIONAL)]`

**Your answer:** ________________________________________

---

# Step 01 — Researcher

Researches the decision and lists the strongest arguments on each side, with sources.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

None. This step starts from the prompt alone.

## Prompt

```text
# Step 01 — Researcher

Decision to investigate: [YOUR DECISION TO INVESTIGATE]
Background: [YOUR BACKGROUND (OPTIONAL)]

Research this decision using reliable sources.

**Output:** `01_research.md`, 500 words maximum, titled **Research Report**:
1. Up to four numbered claims (R1, R2, …) for and against, each with a source link.
2. A section titled **Open questions**: at most three numbered questions for the user whose answers would change the conclusion.
```

Replace the `[YOUR …]` markers with your answers from “Before you start: fill in your details”.

## Save the reply as `01_research.md`

Save the complete reply as `01_research.md` (Research report), with nothing before or after it. The prompt asks for at most 500 words; if the reply is much longer, ask the chat to shorten it.

## Check the reply

- [ ] Every claim has a source link
- [ ] Ends with open questions

---

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
- **Revise**: the check found problems. Fix them before going on. Start a fresh chat, attach `01_research.md` (step 01's earlier output) and `02_check.md` (this report), paste step 01's prompt (“Step 01 — Researcher”) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over `01_research.md`, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.
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

---

# Step 02b — Your Review (you do this one)

Read the research and the source check, answer the open questions, and decide what happens next.

This step is a worksheet for you to fill in yourself. No AI chat is involved.

## Read these first

- `01_research.md` — Research report, from step 01
- `02_check.md` — Source check, from step 02

## Fill in each part

### 1. Your answers

Answer whichever questions apply, in any order.

Copy the questions from `01_research.md` (the numbered list under its questions heading), then write your answers underneath them.

Hint: *Answer the questions above, and add anything else relevant.*

### 2. Additional context or corrections

Hint: *Constraints, facts the research missed… or leave blank.*

### 3. What would you like to do?

Choose one:

- **Get the recommendation**: Continue to Step 03. Next: go on to step 03 (“Step 03 — Recommender”).
- **Run another round with this context**: Back to Step 01 with everything from this round as input. Next: start another round (see “Next round: running the workflow again”).
- **Pause**: Come back to this run later. Next: stop for now and come back to this later.
- **Stop here**: End the run; the summary shows what was gathered. Next: end the workflow here.

## Save your answers as `review_answers.md`

Copy the text below into a new file, replace each marker in square brackets with your answer, tick one choice with an `x`, and save it as `review_answers.md`.

```text
# Review: [YOUR DECISION TO INVESTIGATE]

## Answers to the open questions

Questions raised:
[COPY THE QUESTIONS FROM 01_research.md, NUMBERED]

Answer:

[YOUR ANSWERS]

## Additional context

- [ADDITIONAL CONTEXT OR CORRECTIONS: ONE POINT PER LINE, OR "None"]

## Decision

- [ ] Get the recommendation
- [ ] Run another round with this context
- [ ] Pause
- [ ] Stop here
```

---

# Step 03 — Recommender

Combines the research, the source check and your answers into a short recommendation.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01
- `02_check.md` — Source check, from step 02
- `review_answers.md` — Your review, from step 02b

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 03 — Recommender

Write a short recommendation for: [YOUR DECISION TO INVESTIGATE]

Use only the attached files. Treat the user's answers in `review_answers.md` as their scenario, not as verified evidence, and mention any claims the source check did not support.

**Output:** `03_recommendation.md`, 300 words maximum, titled **Recommendation**:
- Current assessment (2–3 sentences)
- **Suggested next action:** Proceed / Proceed conditionally / Investigate further / Do not proceed — with a brief reason
- A section titled **Open questions**: at most three numbered questions that remain.
```

Replace the `[YOUR …]` markers with your answers from “Before you start: fill in your details”.

## Save the reply as `03_recommendation.md`

Save the complete reply as `03_recommendation.md` (Recommendation), with nothing before or after it. The prompt asks for at most 300 words; if the reply is much longer, ask the chat to shorten it.

## What to look for

### Suggested next action

Find the line that contains “next action”, followed by a colon or dash and the verdict. It should be one of: **Proceed**, **Proceed conditionally**, **Investigate further**, **Do not proceed**. If you can't find one, ask the chat to state it, or judge from the report yourself.

- **Proceed**: no action needed; this is the final result. Any conditions it names still apply.
- **Proceed conditionally**: no action needed; this is the final result. Any conditions it names still apply.
- **Investigate further**: the reply says more research is needed. You can do a short follow-up research session (“Follow-up research”) or a full new round (“Next round: running the workflow again”), or accept the result as it stands.
- **Do not proceed**: no action needed; this is the final result. Any conditions it names still apply.

---

# Next round: running the workflow again

Some choices in this workflow send you back to the start with everything learned so far. Each pass is a **round**. What you've done so far is round 1; the next is round 2, and so on.

In a new round you repeat the steps from the beginning with the same fill-in answers. What changes is that the first steps also receive the previous round's files, so they build on that work instead of starting over, and their prompts have an extra paragraph that says so.

## How to start the next round

1. Finish step 02b (“Step 02b — Your Review (you do this one)”) and choose “Run another round with this context”.
2. Keep this round's files, renamed with a `round-1_` prefix so they can't be mistaken for the new round's files:

   - `01_research.md` → `round-1_01_research.md`
   - `02_check.md` → `round-1_02_check.md`
   - `review_answers.md` → `round-1_review_answers.md`

3. Start again at the first step. Do every step as before, with fresh chats. Save the new replies under the normal file names.
4. Step 01 also receives the carried files (listed first, before the usual files) and uses the round-2 version of the prompt below.
5. For a third round, repeat this with `round-2_` as the prefix, and so on. Each round only carries the previous round's files.

### Round 2: step 01 — Researcher

Attach or paste these files (carried files first): `round-1_01_research.md`, `round-1_02_check.md`, `round-1_review_answers.md`.

```text
# Step 01 — Researcher

This is round 2 of this investigation. The attached `round-1_*` files are the previous round's reports and the user's answers. Treat the user's answers as their scenario. Build on the earlier work: re-check disputed claims and close the gaps it left.

Decision to investigate: [YOUR DECISION TO INVESTIGATE]
Background: [YOUR BACKGROUND (OPTIONAL)]

Research this decision using reliable sources.

**Output:** `01_research.md`, 500 words maximum, titled **Research Report**:
1. Up to four numbered claims (R1, R2, …) for and against, each with a source link.
2. A section titled **Open questions**: at most three numbered questions for the user whose answers would change the conclusion.
```

For round 3, change `round-1_` to `round-2_` and `round 2` to `round 3` where they appear in the prompt. Save the reply as `01_research.md`, as usual.

---

# Follow-up research

Some steps end by recommending that you **investigate further**. Before you start a whole new round (see “Next round: running the workflow again”), you can run one short research session on just the open questions, then repeat that step with the findings. Skip this if you'd rather accept the result as it stands.

## After step 03 — Recommender

### 1. Write down your answers

Make a file `follow-up_answers.md` with the open questions from `03_recommendation.md` (the numbered list under its questions heading) and your answers or any new facts:

```text
# Follow-up: your answers

## Open questions

1. [COPY THE FIRST QUESTION]
2. [COPY THE NEXT QUESTION]

## Answers and new facts from the user

[YOUR ANSWERS. WRITE “NONE” IF YOU HAVE NOTHING TO ADD]
```

### 2. Research the open questions

Start a fresh chat in a tool that can browse the web. Attach `03_recommendation.md` and `follow-up_answers.md`, then paste:

```text
# Follow-up research

The investigation:
- Decision to investigate: [YOUR DECISION TO INVESTIGATE]
- Background: [YOUR BACKGROUND (OPTIONAL)]

03_recommendation.md ("Recommender") recommends investigating further before deciding. Research only its open questions; follow-up_answers.md lists them with anything the user added.

1. For each open question, find what reliable sources say and cite them with links. Use your web search and fetch tools.
2. Where the user has answered a question, treat the answer as their stated scenario (not verified evidence) and research what it implies.
3. Keep verified source statements, reasoned inference and assumptions clearly apart.
4. Say plainly when a question can't be settled by research and only the user can answer it.
5. Do not redo the rest of the investigation or make the final decision.

**Output:** `follow-up_research.md`, **600 words maximum**, titled **Follow-up Research**: one section per question with the finding, its sources and how confident it is, then a short **What this changes** section naming the parts of 03_recommendation.md these findings affect.
```

Save the reply as `follow-up_research.md`.

### 3. Run step 03 again

Start another fresh chat. Rename your earlier `03_recommendation.md` to `follow-up_previous_03_recommendation.md`. Attach step 03's usual files (`01_research.md`, `02_check.md`, `review_answers.md`) plus `follow-up_previous_03_recommendation.md`, `follow-up_answers.md` and `follow-up_research.md`. Paste this version of the prompt, which tells the chat how to use the new files:

```text
# Step 03 — Recommender

Write a short recommendation for: [YOUR DECISION TO INVESTIGATE]

Use only the attached files. Treat the user's answers in `review_answers.md` as their scenario, not as verified evidence, and mention any claims the source check did not support.

**Follow-up:** An earlier version of this recommendation suggested investigating further. `follow-up_previous_*` is that earlier version, `follow-up_answers.md` holds what the user added, and `follow-up_research.md` (if present) holds research findings. Write an updated recommendation and say briefly what changed. Only suggest **Investigate further** again if more research could still settle a critical question; if what remains can only be answered by the user, suggest **Proceed conditionally** and state those answers as the conditions.

**Output:** `03_recommendation.md`, 300 words maximum, titled **Recommendation**:
- Current assessment (2–3 sentences)
- **Suggested next action:** Proceed / Proceed conditionally / Investigate further / Do not proceed — with a brief reason
- A section titled **Open questions**: at most three numbered questions that remain.
```

Save the new reply as `03_recommendation.md`.

You can skip the research session and do step 03 again with only `follow-up_previous_03_recommendation.md` and `follow-up_answers.md`, if your own answers are all that was missing. Doing this more than once rarely helps: if the step still says to investigate further, either accept its result or start a full new round.
