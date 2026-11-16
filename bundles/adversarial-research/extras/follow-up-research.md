# Follow-up research

Some steps end by recommending that you **investigate further**. Before you start a whole new round (see `extras/next-round.md`), you can run one short research session on just the open questions, then repeat that step with the findings. Skip this if you'd rather accept the result as it stands.

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
