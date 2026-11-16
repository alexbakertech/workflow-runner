# Architecture

Next.js 16 (App Router) and TypeScript, with no database: runs and workflows are JSON files in `data/`.
Note `AGENTS.md`: this Next.js version differs from older ones, and its docs are in
`node_modules/next/dist/docs/`.

## Code map

| Where | What |
|---|---|
| `src/lib/types.ts` | Workflow, run, step, round and follow-up types: start here. |
| `src/lib/workflow.ts` | Validating workflows, placeholders and prompts, which files each step gets, verdict parsing, rounds and follow-up helpers. Shared by the browser and the server. |
| `src/lib/agents.ts` | Agent settings, job types, and the messages sent to agents (including corrections and follow-ups). |
| `src/lib/bundle.ts` | Turns a workflow into prompt bundle Markdown. |
| `src/lib/server/runs.ts`, `store.ts`, `hash.ts` | Reading and writing run and workflow files in `data/`, hashing and sealing, starting new rounds. |
| `src/lib/server/samples.ts` | Loading the sample runs, with their hashes checked. |
| `src/lib/server/jobs.ts` | The agent job queue: one step at a time, auto-advance, corrections, follow-ups. |
| `src/lib/server/agents/` | One adapter per agent (`claude.ts`, `codex.ts`, `pi.ts`). |
| `src/lib/server/token.ts`, `src/proxy.ts` | The access token check. |
| `src/app/` | Pages (home, run, summary, settings, login) and `api/` routes. |
| `src/app/api/samples` | The route behind **Load sample runs**. |
| `src/app/api/templates/bundle` | The route behind **Export prompt bundle**. |
| `src/components/` | UI: `AiStep`, `HumanStep`, `AgentPanel`, `FollowUp`, shared bits in `ui.tsx`. |
| `scripts/` | `seed.mjs` (`npm run seed`) and `export-bundles.ts` (`npm run bundles`). |
| `templates/` | Built-in workflows. |
| `samples/` | Finished example runs. |
| `bundles/` | Generated prompt bundles for the built-in workflows. |
| `docs/` | File formats, API, schemas and examples. |
| `.github/workflows/ci.yml` | CI checks. |
| `data/` (gitignored) | Your runs, uploaded workflows, settings, agent job logs, access token. |

## How a step runs

1. The browser loads a run and autosaves every change, debounced, with a `PUT /api/runs/:id`. The server
   writes it to `data/runs/<id>.json` (`store.ts`). A save from a stale copy can't overwrite a step an
   agent has since filled in, or a later round.
2. Doing a step by hand is just editing the run in the browser: you paste the reply and the autosave
   stores it.
3. Running a step with an agent starts a job in `jobs.ts`. Jobs go in a queue, and only one runs at a
   time. The job builds the message from the step's prompt and input files (`src/lib/agents.ts`), and the
   adapter for the chosen provider (`src/lib/server/agents/`) runs it as a fresh session.
4. When the reply arrives, `jobs.ts` saves it into the run as that step's output, with the provider,
   model and duration. If "Keep going automatically" is on and nothing warns, it starts the next AI step.
5. Every write to a run goes through `hash.ts`: the run is sealed with a SHA-256 content hash, and the
   workflow carries its own hash, so a file edited outside the app is detected on import.

Tests: there's no automated test suite. See [CONTRIBUTING.md](../CONTRIBUTING.md) for how changes are
checked.
