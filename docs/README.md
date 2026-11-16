# Workflow Runner documentation

Workflow Runner guides you through multi-session AI workflows: each step is a fresh AI session (done
by hand in any chat app, or by an agent) or a review you fill in yourself. Two JSON formats matter:

| Format | What it is | Reference |
|---|---|---|
| **Workflow** (`"format": "workflow-template"`) | The input: steps, prompts, which outputs feed which step, review forms, verdicts to watch for. | [workflow-format.md](workflow-format.md) |
| **Run** (`"format": "workflow-run"`) | The output: one investigation with its embedded workflow, every output, earlier rounds, follow-ups and integrity hashes. | [run-format.md](run-format.md) |

Also here:

| | |
|---|---|
| [quickstart.md](quickstart.md) | Install, a first run by hand, and signing in an agent. |
| [user-guide.md](user-guide.md) | The built-in workflow, running steps with an agent, what you can load, behaviour notes, sample runs. |
| [configuration.md](configuration.md) | Environment variables, Settings, Docker, the data folder, npm scripts. |
| [troubleshooting.md](troubleshooting.md) | Fixes for common problems. |
| [architecture.md](architecture.md) | Code map and how a step runs. |
| [api.md](api.md) | HTTP API for scripting: list and fetch runs, load workflows. |
| [schemas/workflow-template.schema.json](schemas/workflow-template.schema.json) | JSON Schema (draft 2020-12) for workflows. |
| [schemas/workflow-run.schema.json](schemas/workflow-run.schema.json) | JSON Schema for run files. It references the workflow schema, so load both. |
| [examples/example-workflow.json](examples/example-workflow.json) | A small workflow that uses every feature: variables, inputs, a source check with a verdict and correction, a review with a decision, rounds, and a final recommendation with follow-up research. |
| [examples/example-run.run.json](examples/example-run.run.json) | A run of that workflow, made by the app: two rounds and a follow-up. Its hashes verify. |
| [examples/parse_run.py](examples/parse_run.py) | Verifies a run's hashes and summarizes every round (Python 3.8+, standard library only). |

## I want to write a new workflow

1. Start from [`examples/example-workflow.json`](examples/example-workflow.json), or download an
   existing workflow with the **Workflow JSON** button on its card.
2. Read [Steps](workflow-format.md#steps), [AI steps and prompts](workflow-format.md#ai-steps-and-prompts)
   and [Writing prompts the app can parse](workflow-format.md#writing-prompts-the-app-can-parse).
3. Check it against the schema, e.g. `npx ajv-cli validate --spec=draft2020 -s schemas/workflow-template.schema.json -d my-workflow.json`.
   This catches structural problems.
4. Drop it on the app's home page. The app also checks that step references point at earlier steps,
   and lists every problem if any.

## I want to read the results of runs

1. Download a run (**Download run JSON**), or fetch it with `GET /api/runs/:id` ([api.md](api.md)).
2. `python examples/parse_run.py my-run.run.json` prints each round's verdicts and final result;
   add `--json` for a machine-readable summary.
3. For anything else, [run-format.md](run-format.md) describes every field and has
   [jq recipes](run-format.md#reading-a-run-recipes) and
   [hash verification](run-format.md#verifying-a-run) in JavaScript and Python.

## Concepts in one place

- **Step**: an AI session (`kind: "ai"`) or a review form (`kind: "human"`). Every step produces one
  Markdown output with a file name, such as `01_research.md`.
- **Inputs**: earlier outputs a step receives, pasted as files above its prompt.
- **Signal**: a verdict read from an AI reply, such as `Gate result: Revise`. It drives warnings,
  automatic stops, corrections and follow-ups.
- **Decision**: a review step's choice of what happens next: continue, pause, stop, or run another round.
- **Round**: the same run started again from the first step, with the previous round's outputs as
  extra inputs. Earlier rounds are kept inside the run file.
- **Follow-up**: after a step recommends investigating further, a short research session on its open
  questions (or just the user's answers), then that step again. Limited per round; new rounds aren't.
- **Tag and hashes**: every workflow has a SHA-256 fingerprint and a tag (`id@version#hash8`). Every run
  embeds its workflow and is sealed with a content hash, so you can tell which workflow produced it and
  whether it was edited outside the app.
