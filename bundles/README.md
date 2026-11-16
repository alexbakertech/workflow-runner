# Prompt bundles

A prompt bundle is a set of Markdown files that lets you follow a Workflow Runner workflow by hand, in any AI chat app, without installing anything. It is for people who want to go through the steps themselves. The rule is **one fresh chat per step**: never continue an earlier conversation, because keeping steps apart is what makes the workflow work.

| Workflow | What it's for | Steps | Single file |
|---|---|---|---|
| [Independent Adversarial Research](adversarial-research/README.md) | Seven isolated AI sessions plus one human review. | 7 AI steps, 1 review | [adversarial-research.md](adversarial-research.md) |
| [Release Cadence Review](release-cadence/README.md) | A small example workflow: research a decision, check the sources, review the findings yourself, then get a recommendation. | 3 AI steps, 1 review | [release-cadence.md](release-cadence.md) |

These bundles are generated from `templates/` with `npm run bundles`. To change one, edit its workflow and regenerate rather than editing these files.
