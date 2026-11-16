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

Replace the `[YOUR …]` markers with your answers from `00-fill-in.md`.

## Save the reply as `03_recommendation.md`

Save the complete reply as `03_recommendation.md` (Recommendation), with nothing before or after it. The prompt asks for at most 300 words; if the reply is much longer, ask the chat to shorten it.

## What to look for

### Suggested next action

Find the line that contains “next action”, followed by a colon or dash and the verdict. It should be one of: **Proceed**, **Proceed conditionally**, **Investigate further**, **Do not proceed**. If you can't find one, ask the chat to state it, or judge from the report yourself.

- **Proceed**: no action needed; this is the final result. Any conditions it names still apply.
- **Proceed conditionally**: no action needed; this is the final result. Any conditions it names still apply.
- **Investigate further**: the reply says more research is needed. You can do a short follow-up research session (`extras/follow-up-research.md`) or a full new round (`extras/next-round.md`), or accept the result as it stands.
- **Do not proceed**: no action needed; this is the final result. Any conditions it names still apply.
