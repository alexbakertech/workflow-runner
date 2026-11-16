# Next round: running the workflow again

Some choices in this workflow send you back to the start with everything learned so far. Each pass is a **round**. What you've done so far is round 1; the next is round 2, and so on.

In a new round you repeat the steps from the beginning with the same fill-in answers. What changes is that the first steps also receive the previous round's files, so they build on that work instead of starting over, and their prompts have an extra paragraph that says so.

## How to start the next round

1. Finish step 06b (`06b-your-review.md`) and choose “Run another round with this context”.
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
