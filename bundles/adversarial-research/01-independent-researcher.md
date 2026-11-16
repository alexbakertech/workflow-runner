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

Replace the `[YOUR …]` markers with your answers from `00-fill-in.md`.

## Save the reply as `01_research.md`

Save the complete reply as `01_research.md` (Research report), with nothing before or after it.

## Check the reply

- [ ] The report actually addresses your question and scope
- [ ] Claims are numbered R1, R2… with links you can open
- [ ] Sourced facts are separated from assumptions and illustrative calculations
- [ ] You opened one or two important links and they look relevant
