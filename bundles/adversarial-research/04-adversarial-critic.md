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
