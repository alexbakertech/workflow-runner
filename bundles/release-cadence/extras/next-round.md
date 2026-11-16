# Next round: running the workflow again

Some choices in this workflow send you back to the start with everything learned so far. Each pass is a **round**. What you've done so far is round 1; the next is round 2, and so on.

In a new round you repeat the steps from the beginning with the same fill-in answers. What changes is that the first steps also receive the previous round's files, so they build on that work instead of starting over, and their prompts have an extra paragraph that says so.

## How to start the next round

1. Finish step 02b (`02b-your-review.md`) and choose “Run another round with this context”.
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
