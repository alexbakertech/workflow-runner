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

1. Open `00-fill-in.md` and write down your answers. You'll need them in the prompts.
2. Go through the steps below in order. For each AI step, open a **fresh chat**, a new conversation in any AI tool. Never continue an earlier chat: keeping steps apart is the point of the workflow.
3. Attach or paste **only** the files that step lists, nothing else. Then paste the step's prompt. Replace each marker such as `[YOUR …]` with your own answer first.
4. Save each reply, complete and with nothing added, under the file name the step gives. Keep all saved files together in one folder, because later steps ask for them.
5. Review steps are done by you, with no AI. Their file is a worksheet; fill it in and save it under the name it gives.
6. If a step's result tells you more work is needed, `extras/next-round.md` explains how to run another round, and `extras/follow-up-research.md` has the prompt for a follow-up research session.

## Steps

| # | Step | Who | Inputs → output |
|---|---|---|---|
| 01 | [Independent Researcher](01-independent-researcher.md) | AI chat | your fill-in answers → `01_research.md` |
| 02 | [Research Source Verifier](02-research-source-verifier.md) | AI chat | `01_research.md` → `02_source_verification.md` |
| 03 | [Benefits Synthesizer](03-benefits-synthesizer.md) | AI chat | `01_research.md`, `02_source_verification.md` → `03_benefits_summary.md` |
| 04 | [Adversarial Critic](04-adversarial-critic.md) | AI chat | `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md` → `04_critique.md` |
| 05 | [Critique Source Verifier](05-critique-source-verifier.md) | AI chat | `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`, `04_critique.md` → `05_critique_verification.md` |
| 06 | [Cautions Synthesizer](06-cautions-synthesizer.md) | AI chat | `01_research.md`, `02_source_verification.md`, `03_benefits_summary.md`, `04_critique.md`, `05_critique_verification.md` → `06_cautions_summary.md` |
| 06b | [Your Review](06b-your-review.md) | You | `03_benefits_summary.md`, `06_cautions_summary.md` → `user_responses.md` |
| 07 | [Decision Synthesizer](07-decision-synthesizer.md) | AI chat | `03_benefits_summary.md`, `06_cautions_summary.md`, `02_source_verification.md`, `05_critique_verification.md`, `user_responses.md`, `01_research.md` (optional), `04_critique.md` (optional) → `07_decision_brief.md` |

## What you lose without the app

- **No enforced isolation.** In the app each step sees only the files it is meant to see. By hand, nothing stops you pasting the wrong file, or carrying on in an old chat. The workflow works because each step is kept apart, so be strict about it.
- **Verdicts aren't acted on automatically.** The app reads the verdict lines (gate results, recommendations), warns you, and offers the fix. By hand, you have to find those lines yourself and follow the instructions in each step file.
- **No run record or hashes.** The app saves one run file with the workflow, every prompt, every output, and integrity hashes. Here you only have the files you saved; nothing proves which prompt text or inputs produced them.
- **More copying.** You assemble each message yourself: fill in the markers, attach the right files, save each reply under the right name, and repeat for every step and every round.

This bundle was exported from Workflow Runner, the app that runs these workflows for you. More about it: https://github.com/alexbakertech/workflow-runner
