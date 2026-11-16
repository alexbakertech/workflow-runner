# Independent Adversarial Research — all in one file

This is the whole prompt bundle for `adversarial-research` in a single document. Each section below is one file of the folder version. Save replies under the file names the steps give.

## Contents

- [Independent Adversarial Research](#independent-adversarial-research)
- [Before you start: fill in your details](#before-you-start-fill-in-your-details)
- [Step 01 — Independent Researcher](#step-01--independent-researcher)
- [Step 02 — Research Source Verifier](#step-02--research-source-verifier)
- [Step 03 — Benefits Synthesizer](#step-03--benefits-synthesizer)
- [Step 04 — Adversarial Critic](#step-04--adversarial-critic)
- [Step 05 — Critique Source Verifier](#step-05--critique-source-verifier)
- [Step 06 — Cautions Synthesizer](#step-06--cautions-synthesizer)
- [Step 06b — Your Review (you do this one)](#step-06b--your-review-you-do-this-one)
- [Step 07 — Decision Synthesizer](#step-07--decision-synthesizer)
- [Next round: running the workflow again](#next-round-running-the-workflow-again)
- [Follow-up research](#follow-up-research)

---

# Independent Adversarial Research

Seven isolated AI sessions plus one human review. A researcher argues for the decision, a critic argues against it, two verifiers check that cited sources say what is claimed, and a final session combines everything with your own answers into a short decision brief. If the first pass leaves too many gaps, you can run another round that builds on it.

This is a prompt bundle for the workflow `adversarial-research` (version 3.7.0). It lets you follow the whole workflow by hand in any chat app, without running Workflow Runner.

## About this workflow

- Every session happens in a brand-new chat. Use any AI tool you like (ChatGPT, Claude, Gemini…) and switch models between sessions if you want — just never continue a previous chat.
- For each session this guide gives you two things to copy: the context (the reports produced by earlier sessions) and the prompt. Paste both into the new chat as one message and send it.
- Copy the full reply back into this guide. It becomes the input for later sessions, so you never have to manage files yourself.
- Verification sessions only check that sources say what was claimed — not that the claims are true. If a verifier asks for a revision, you decide whether to fix it first or carry the flag forward.
- After Step 06 you review both summaries, answer their questions in your own words, and decide what happens next: get the decision brief, pause, stop, or run another round that starts again at Step 01 with everything gathered so far. Nothing here makes the decision for you.

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
| 01 | [Independent Researcher](#step-01--independent-researcher) | AI chat | your fill-in answers → `01_research.md` |
| 02 | [Research Source Verifier](#step-02--research-source-verifier) | AI chat | `01_research.md` → `02_source_verification.md` |
| 03 | [Benefits Synthesizer](#step-03--benefits-synthesizer) | AI chat | `01_research.md`, `02_source_verification.md` → `03_benefits_summary.md` |
| 04 | [Adversarial Critic](#step-04--adversarial-critic) | AI chat | `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md` → `04_critique.md` |
| 05 | [Critique Source Verifier](#step-05--critique-source-verifier) | AI chat | `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`, `04_critique.md` → `05_critique_verification.md` |
| 06 | [Cautions Synthesizer](#step-06--cautions-synthesizer) | AI chat | `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`, `04_critique.md`, `05_critique_verification.md` → `06_cautions_summary.md` |
| 06b | [Your Review](#step-06b--your-review-you-do-this-one) | You | `03_benefits_summary.md`, `06_cautions_summary.md` → `user_responses.md` |
| 07 | [Decision Synthesizer](#step-07--decision-synthesizer) | AI chat | `03_benefits_summary.md`, `06_cautions_summary.md`, `02_source_verification.md`, `05_critique_verification.md`, `user_responses.md`, `01_research.md` (optional), `04_critique.md` (optional) → `07_decision_brief.md` |

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

Phrase it as a decision you are considering, not a universal claim.

Example: *Is replacing a gas furnace with a heat pump worthwhile for a typical household?*

Marker in the prompts: `[YOUR DECISION TO INVESTIGATE]`

**Your answer:** ________________________________________

### 2. Scenario / constraints (optional)

Any baseline facts the researcher should assume. Leave blank to have it document assumptions and ask you later.

Example: *Detached house in a cold-winter climate, planning to stay 10+ years, would pay upfront.*

Marker in the prompts: `[YOUR SCENARIO / CONSTRAINTS (OPTIONAL)]`

**Your answer:** ________________________________________

---

# Step 01 — Independent Researcher

Researches the question and lists up to five potential benefits, each backed by numbered claims (R1, R2…) with source links.

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

None. This step starts from the prompt alone.

## Prompt

```text
# Step 01 — Independent Researcher

**Input:** Research question and any explicitly provided scenario constraints. Start a **fresh chat**.

Investigate this decision:

> [YOUR DECISION TO INVESTIGATE]

Scenario constraints / scope supplied by the user:

> [YOUR SCENARIO / CONSTRAINTS (OPTIONAL)]

Your goal is to identify **potential benefits** and the circumstances under which they may be achieved. Produce a self-contained report for independent review, not a definitive universal verdict.

1. Prioritize **up to five** consequential benefits or advantages.
2. Label supporting external factual claims **R1, R2, ...**, provide accessible, specific links and pinpoint source passages/sections where possible.
3. Clearly distinguish directly sourced statements, assumptions, illustrative calculations, and user-dependent scenarios.
4. Include major comparison boundaries (e.g., operating versus acquisition cost), plausible alternatives, and limitations without conducting the adversarial critic's job.
5. Include **up to three questions** for the user whose answers could materially alter the expected benefits. Explain why each matters. Don't request answers in this chat.
6. Don't invent user circumstances or claim to have inspected sources you cannot access. If a necessary external source is inaccessible, say so.

**Output:** `01_research.md` with: question/scope; benefits and numbered claims; evidence/source links; illustrative calculations/assumptions; alternatives/boundaries; unresolved information and prioritized user questions; readiness for source verification.

Keep the report focused rather than encyclopedic. Do not ask interactive follow-up questions.
```

Replace the `[YOUR …]` markers with your answers from “Before you start: fill in your details”.

## Save the reply as `01_research.md`

Save the complete reply as `01_research.md` (Research report), with nothing before or after it.

## Check the reply

- [ ] The report actually addresses your question and scope
- [ ] Claims are numbered R1, R2… with links you can open
- [ ] Sourced facts are separated from assumptions and illustrative calculations
- [ ] You opened one or two important links and they look relevant

---

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
- **Revise**: the check found problems. Fix them before going on. Start a fresh chat, attach `01_research.md` (step 01's earlier output) and `02_source_verification.md` (this report), paste step 01's prompt (“Step 01 — Independent Researcher”) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over `01_research.md`, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.
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

---

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

---

# Step 04 — Adversarial Critic

Independently challenges the benefits — hidden costs, risks, failure conditions and alternatives — as numbered objections (C1, C2…).

## Start a fresh chat

Open a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.

## Attach or paste these files

- `01_research.md` — Research report, from step 01
- `02_source_verification.md` — Research source verification, from step 02
- `03_benefits_summary.md` — Benefits summary, from step 03

Attach each file, or paste its full text, before the prompt.

## Prompt

```text
# Step 04 — Independent Adversarial Critic

**Input:** `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`. Start a **fresh chat**.

Independently challenge whether the **proposed benefits apply and are worth pursuing**. Your objective is not to force a "no" answer; it is to uncover material omissions, risks, hidden costs, alternative explanations, tradeoffs, and failure conditions.

1. Prioritize **up to five** meaningful objections and label them **C1, C2, ...**.
2. For each: name the affected benefit/claim, the concern, why it matters, when it applies, and whether it could alter the decision.
3. Cite specific accessible evidence for **new external factual counterclaims**. Clearly mark **logical objections**, **hypothetical scenarios**, and **unverified conjectures** as such.
4. Identify any well-supported benefits that remain persuasive; do not manufacture symmetrical opposition.
5. Give **up to three questions for the user** that could materially change the severity/applicability of the cautions. Don't request answers in this chat.
6. Respect the findings of the source verifier without assuming source correspondence proves the researcher's conclusion.

**Output:** `04_critique.md`: concise numbered objections with supporting citations, surviving benefits, unresolved information, and prioritized user questions. Do **not** rewrite the original research or impose a final decision.
```

## Save the reply as `04_critique.md`

Save the complete reply as `04_critique.md` (Adversarial critique), with nothing before or after it.

## Check the reply

- [ ] Objections are numbered C1, C2… and are substantive, not cosmetic
- [ ] New factual counterclaims have sources; logical objections are labeled as such
- [ ] It names the benefits that still hold up

---

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
- **Revise**: the check found problems. Fix them before going on. Start a fresh chat, attach `04_critique.md` (step 04's earlier output) and `05_critique_verification.md` (this report), plus step 04's own input files (`01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`), paste step 04's prompt (“Step 04 — Adversarial Critic”) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over `04_critique.md`, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.
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

---

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

---

# Step 06b — Your Review (you do this one)

Read both summaries, answer their questions in your own words, add any context, and decide what to do next. No AI is involved in this step.

## Read these first

- `03_benefits_summary.md` — Benefits summary, from step 03
- `06_cautions_summary.md` — Cautions summary, from step 06

## Fill in each part

### 1. Benefits summary — your answers

Write freely. Skipping a question is fine — the next session treats it as unknown.

Copy the questions from `03_benefits_summary.md` (the numbered list under its questions heading), then write your answers underneath them.

Hint: *Answer whichever questions apply, in any order, and add anything else relevant to the benefits.*

### 2. Cautions summary — your answers

Write freely. Skipping a question is fine — the next session treats it as unknown.

Copy the questions from `06_cautions_summary.md` (the numbered list under its questions heading), then write your answers underneath them.

Hint: *Answer whichever questions apply, in any order, and add anything else relevant to the cautions.*

### 3. Additional context or corrections

Facts you add here are treated as your scenario, not as independently verified evidence.

Hint: *Constraints, existing equipment, budget, usage, preferences… or leave blank for none.*

### 4. What would you like to do?

Choose one:

- **Proceed to Step 07**: Get a conditional decision brief that combines both summaries with your answers. Next: go on to step 07 (“Step 07 — Decision Synthesizer”).
- **Run another round with this context**: Continue this run with another round: back to Step 01 with everything from this round — the reports, verifications, and your answers — as input, so the new research builds on it instead of starting over. This round stays in the run and can be viewed from its summary. Next: start another round (see “Next round: running the workflow again”).
- **Pause**: Stop here for now to clarify something or re-verify a claim. You can resume this run later. Next: stop for now and come back to this later.
- **Stop the investigation**: End the run here. The summary page will show everything gathered so far. Next: end the workflow here.

## Save your answers as `user_responses.md`

Copy the text below into a new file, replace each marker in square brackets with your answer, tick one choice with an `x`, and save it as `user_responses.md`.

```text
# Human Review — [YOUR DECISION TO INVESTIGATE]

## Benefits summary answers
Questions raised:
[COPY THE QUESTIONS FROM 03_benefits_summary.md, NUMBERED]

Answer:

[BENEFITS SUMMARY — YOUR ANSWERS]

## Cautions summary answers
Questions raised:
[COPY THE QUESTIONS FROM 06_cautions_summary.md, NUMBERED]

Answer:

[CAUTIONS SUMMARY — YOUR ANSWERS]

## Additional context / corrections
- [ADDITIONAL CONTEXT OR CORRECTIONS: ONE POINT PER LINE, OR "None"]

## Authorization
- [ ] Proceed to Step 07
- [ ] Run another round with this context
- [ ] Pause
- [ ] Stop the investigation
```

---

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
- **Investigate further**: the reply says more research is needed. You can do a short follow-up research session (“Follow-up research”) or a full new round (“Next round: running the workflow again”), or accept the result as it stands.
- **Do not proceed**: no action needed; this is the final result. Any conditions it names still apply.
- **Proceed**: no action needed; this is the final result. Any conditions it names still apply.

---

# Next round: running the workflow again

Some choices in this workflow send you back to the start with everything learned so far. Each pass is a **round**. What you've done so far is round 1; the next is round 2, and so on.

In a new round you repeat the steps from the beginning with the same fill-in answers. What changes is that the first steps also receive the previous round's files, so they build on that work instead of starting over, and their prompts have an extra paragraph that says so.

## How to start the next round

1. Finish step 06b (“Step 06b — Your Review (you do this one)”) and choose “Run another round with this context”.
2. Keep this round's files, renamed with a `round-1_` prefix so they can't be mistaken for the new round's files:

   - `01_research.md` → `round-1_01_research.md`
   - `02_source_verification.md` → `round-1_02_source_verification.md`
   - `03_benefits_summary.md` → `round-1_03_benefits_summary.md`
   - `04_critique.md` → `round-1_04_critique.md`
   - `05_critique_verification.md` → `round-1_05_critique_verification.md`
   - `06_cautions_summary.md` → `round-1_06_cautions_summary.md`
   - `user_responses.md` → `round-1_user_responses.md`

3. Start again at the first step. Do every step as before, with fresh chats. Save the new replies under the normal file names.
4. Step 01 also receives the carried files (listed first, before the usual files) and uses the round-2 version of the prompt below.
5. For a third round, repeat this with `round-2_` as the prefix, and so on. Each round only carries the previous round's files.

### Round 2: step 01 — Independent Researcher

Attach or paste these files (carried files first): `round-1_01_research.md`, `round-1_02_source_verification.md`, `round-1_03_benefits_summary.md`, `round-1_04_critique.md`, `round-1_05_critique_verification.md`, `round-1_06_cautions_summary.md`, `round-1_user_responses.md`.

```text
# Step 01 — Independent Researcher

**Input:** Research question and any explicitly provided scenario constraints. Start a **fresh chat**.

Investigate this decision:

> [YOUR DECISION TO INVESTIGATE]

Scenario constraints / scope supplied by the user:

> [YOUR SCENARIO / CONSTRAINTS (OPTIONAL)]

This is **round 2** of this investigation. The attached `round-1_*` files are the previous round's reports, verifications, and the user's answers (including any decision brief, follow-up research, and answers to its open questions). Treat the user's answers and context as their scenario. Build on the earlier work rather than repeating it: re-check claims that were disputed, close the gaps and open questions it left, and look for evidence the earlier round missed. Don't ask the user questions they already answered.

Your goal is to identify **potential benefits** and the circumstances under which they may be achieved. Produce a self-contained report for independent review, not a definitive universal verdict.

1. Prioritize **up to five** consequential benefits or advantages.
2. Label supporting external factual claims **R1, R2, ...**, provide accessible, specific links and pinpoint source passages/sections where possible.
3. Clearly distinguish directly sourced statements, assumptions, illustrative calculations, and user-dependent scenarios.
4. Include major comparison boundaries (e.g., operating versus acquisition cost), plausible alternatives, and limitations without conducting the adversarial critic's job.
5. Include **up to three questions** for the user whose answers could materially alter the expected benefits. Explain why each matters. Don't request answers in this chat.
6. Don't invent user circumstances or claim to have inspected sources you cannot access. If a necessary external source is inaccessible, say so.

**Output:** `01_research.md` with: question/scope; benefits and numbered claims; evidence/source links; illustrative calculations/assumptions; alternatives/boundaries; unresolved information and prioritized user questions; readiness for source verification.

Keep the report focused rather than encyclopedic. Do not ask interactive follow-up questions.
```

For round 3, change `round-1_` to `round-2_` and `round 2` to `round 3` where they appear in the prompt. Save the reply as `01_research.md`, as usual.

---

# Follow-up research

Some steps end by recommending that you **investigate further**. Before you start a whole new round (see “Next round: running the workflow again”), you can run one short research session on just the open questions, then repeat that step with the findings. Skip this if you'd rather accept the result as it stands.

## After step 07 — Decision Synthesizer

### 1. Write down your answers

Make a file `follow-up_answers.md` with the open questions from `07_decision_brief.md` (the numbered list under its questions heading) and your answers or any new facts:

```text
# Follow-up: your answers

## Open questions

1. [COPY THE FIRST QUESTION]
2. [COPY THE NEXT QUESTION]

## Answers and new facts from the user

[YOUR ANSWERS. WRITE “NONE” IF YOU HAVE NOTHING TO ADD]
```

### 2. Research the open questions

Start a fresh chat in a tool that can browse the web. Attach `07_decision_brief.md` and `follow-up_answers.md`, then paste:

```text
# Follow-up research

The investigation:
- Decision to investigate: [YOUR DECISION TO INVESTIGATE]
- Scenario / constraints: [YOUR SCENARIO / CONSTRAINTS (OPTIONAL)]

07_decision_brief.md ("Decision Synthesizer") recommends investigating further before deciding. Research only its open questions; follow-up_answers.md lists them with anything the user added.

1. For each open question, find what reliable sources say and cite them with links. Use your web search and fetch tools.
2. Where the user has answered a question, treat the answer as their stated scenario (not verified evidence) and research what it implies.
3. Keep verified source statements, reasoned inference and assumptions clearly apart.
4. Say plainly when a question can't be settled by research and only the user can answer it.
5. Do not redo the rest of the investigation or make the final decision.

**Output:** `follow-up_research.md`, **600 words maximum**, titled **Follow-up Research**: one section per question with the finding, its sources and how confident it is, then a short **What this changes** section naming the parts of 07_decision_brief.md these findings affect.
```

Save the reply as `follow-up_research.md`.

### 3. Run step 07 again

Start another fresh chat. Rename your earlier `07_decision_brief.md` to `follow-up_previous_07_decision_brief.md`. Attach step 07's usual files (`03_benefits_summary.md`, `06_cautions_summary.md`, `02_source_verification.md`, `05_critique_verification.md`, `user_responses.md`) plus `follow-up_previous_07_decision_brief.md`, `follow-up_answers.md` and `follow-up_research.md`. Paste this version of the prompt, which tells the chat how to use the new files:

```text
# Step 07 — User-Informed Decision Synthesizer

**Input:** `03_benefits_summary.md`, `06_cautions_summary.md`, `02_source_verification.md`, `05_critique_verification.md`, and `user_responses.md`. Provide `01_research.md` and `04_critique.md` as well if claim-level context is needed. Start a **fresh chat**.

You are combining **two independently developed perspectives and the user's answers** into a brief, user-specific decision aid. The user has already reviewed the summaries and chosen to proceed.

**Follow-up:** An earlier version of this brief recommended investigating further. Since then: `follow-up_previous_*` is the latest earlier version of this brief, `follow-up_answers.md` holds what the user added, and `follow-up_research.md` (if present) holds findings from research on its open questions. Write an updated brief that takes them into account, and say briefly what changed and why. Treat the user's answers as their stated scenario, not as independently verified evidence. Research findings count as sourced only where they cite a source.

Only recommend **Investigate further** again if more research could still settle a critical question. If what remains can only be answered by the user (their own quotes, bills, plans, approvals, or preferences), recommend **Proceed conditionally** or **Do not proceed** instead, and state those answers as the conditions.

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

Save the new reply as `07_decision_brief.md`.

You can skip the research session and do step 07 again with only `follow-up_previous_07_decision_brief.md` and `follow-up_answers.md`, if your own answers are all that was missing. Doing this more than once rarely helps: if the step still says to investigate further, either accept its result or start a full new round.
