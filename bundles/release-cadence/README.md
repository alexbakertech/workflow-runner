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

1. Open `00-fill-in.md` and write down your answers. You'll need them in the prompts.
2. Go through the steps below in order. For each AI step, open a **fresh chat**, a new conversation in any AI tool. Never continue an earlier chat: keeping steps apart is the point of the workflow.
3. Attach or paste **only** the files that step lists, nothing else. Then paste the step's prompt. Replace each marker such as `[YOUR …]` with your own answer first.
4. Save each reply, complete and with nothing added, under the file name the step gives. Keep all saved files together in one folder, because later steps ask for them.
5. Review steps are done by you, with no AI. Their file is a worksheet; fill it in and save it under the name it gives.
6. If a step's result tells you more work is needed, `extras/next-round.md` explains how to run another round, and `extras/follow-up-research.md` has the prompt for a follow-up research session.

## Steps

| # | Step | Who | Inputs → output |
|---|---|---|---|
| 01 | [Researcher](01-researcher.md) | AI chat | your fill-in answers → `01_research.md` |
| 02 | [Source Checker](02-source-checker.md) | AI chat | `01_research.md` → `02_check.md` |
| 02b | [Your Review](02b-your-review.md) | You | `01_research.md`, `02_check.md` → `review_answers.md` |
| 03 | [Recommender](03-recommender.md) | AI chat | `01_research.md`, `02_check.md`, `review_answers.md` → `03_recommendation.md` |

## What you lose without the app

- **No enforced isolation.** In the app each step sees only the files it is meant to see. By hand, nothing stops you pasting the wrong file, or carrying on in an old chat. The workflow works because each step is kept apart, so be strict about it.
- **Verdicts aren't acted on automatically.** The app reads the verdict lines (gate results, recommendations), warns you, and offers the fix. By hand, you have to find those lines yourself and follow the instructions in each step file.
- **No run record or hashes.** The app saves one run file with the workflow, every prompt, every output, and integrity hashes. Here you only have the files you saved; nothing proves which prompt text or inputs produced them.
- **More copying.** You assemble each message yourself: fill in the markers, attach the right files, save each reply under the right name, and repeat for every step and every round.

This bundle was exported from Workflow Runner, the app that runs these workflows for you. More about it: https://github.com/alexbakertech/workflow-runner
