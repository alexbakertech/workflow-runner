# Follow-up research

Some steps end by recommending that you **investigate further**. Before you start a whole new round (see `extras/next-round.md`), you can run one short research session on just the open questions, then repeat that step with the findings. Skip this if you'd rather accept the result as it stands.

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
