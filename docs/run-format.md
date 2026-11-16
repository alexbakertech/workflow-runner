# Run format (`workflow-run`)

A run file is everything one investigation produced:
- the workflow it followed (embedded in full),
- the setup answers,
- every reply and review,
- earlier rounds,
- follow-up research,
- two hashes that show whether anything was changed outside the app.

A run file stands alone: it can be summarized, resumed or verified on any machine.

- JSON Schema: [`schemas/workflow-run.schema.json`](schemas/workflow-run.schema.json)
- Real example, made by the app: [`examples/example-run.run.json`](examples/example-run.run.json)
  (two rounds, a source-check verdict, a review, and a follow-up)
- Parser and verifier (Python, standard library only): [`examples/parse_run.py`](examples/parse_run.py)

## Where run files come from

- The app saves each run as `data/runs/<id>.json` on every change.
- **Download run JSON** (summary page, or the download icon while running) gives the same content,
  named `<title-slug>.run.json`.
- `GET /api/runs/<id>` returns `{ "run": …, "verification": … }` (see [api.md](api.md)).

## Contents

1. [Top level](#top-level)
2. [Steps](#steps)
3. [Rounds](#rounds)
4. [Follow-ups](#follow-ups)
5. [File naming conventions](#file-naming-conventions)
6. [Reading a run: recipes](#reading-a-run-recipes)
7. [Verifying a run](#verifying-a-run)
8. [Compatibility](#compatibility)

## Top level

```jsonc
{
  "format": "workflow-run",
  "formatVersion": 1,
  "id": "run-mve3k2a1-x7qp",
  "title": "Weekly or biweekly releases?",
  "tag": "release-cadence@1.0.0#885e6960",
  "status": "completed",
  "createdAt": "2026-10-18T17:52:10.112Z",
  "updatedAt": "2026-10-18T18:20:44.905Z",
  "completedAt": "2026-10-18T18:20:44.880Z",
  "variables": { "question": "Should our team move from weekly to biweekly releases?", "context": "…" },
  "template": { "id": "release-cadence", "title": "…", "version": "1.0.0", "sourceFile": "example-workflow.json",
                "hash": "sha256:885e6960…", "definition": { /* the whole workflow */ } },
  "position": 3,
  "progress": { "completed": 4, "total": 4 },
  "steps": [ /* the current round, one entry per workflow step */ ],
  "round": 2,
  "roundStartedAt": "…",
  "carryOver": { "files": [ … ], "into": ["01"] },
  "rounds": [ /* earlier rounds */ ],
  "followUps": [ /* this round's follow-ups */ ],
  "agentBreakpoints": ["03"],
  "integrity": { "algorithm": "sha256", "contentHash": "sha256:…", "computedAt": "…" },
  "importVerification": { /* only on imported runs */ }
}
```

| Field | Type | Notes |
|---|---|---|
| `format` | `"workflow-run"` | Use this to recognize run files. |
| `formatVersion` | `1` | |
| `id` | string | `run-<base-36 time>-<4 random characters>`. Unique within one app instance. |
| `title` | string | Chosen at setup (suggested from the workflow's `titleVariable`). |
| `tag` | string | `<workflow id>@<version>#<first 8 hex of template.hash>`. Runs with the same tag used the identical workflow. |
| `status` | string | See [Statuses](#statuses). |
| `createdAt`, `updatedAt` | ISO 8601 string | `updatedAt` changes on every save. |
| `completedAt` | ISO string or `null` | When the run was finished or stopped. `null` while it's going. |
| `variables` | object | Setup answers, keyed by the workflow's variable `key`. Values are strings, possibly empty. |
| `template` | object | `id`, `title`, `version`, `sourceFile` (the workflow's file name when it was loaded), `hash`, and `definition`: the complete [workflow](workflow-format.md) as it was when the run started. Later edits to the workflow don't change it. |
| `position` | integer | Index of the step the user was last on. |
| `progress` | object | `completed` = steps with status `done` in the current round; `total` = number of steps. |
| `steps` | array | The **current round**, in workflow order (same length and order as `template.definition.steps`). See [Steps](#steps). |
| `round` | integer | Current round number. Missing means 1. |
| `roundStartedAt` | ISO string | When the current round started. Missing in round 1 (use `createdAt`). |
| `carryOver` | object | What the current round was given from the previous one. See [Rounds](#rounds). |
| `rounds` | array | Earlier rounds, oldest first. Missing or empty for single-round runs. |
| `followUps` | array | Follow-ups in the current round. See [Follow-ups](#follow-ups). |
| `agentBreakpoints` | string[] | Step ids where an automatically running agent stops. |
| `integrity` | object | The content seal. See [Verifying a run](#verifying-a-run). |
| `importVerification` | object | Added when a run file is imported: `templateHashOk`, `contentHashOk` (`null` if it had no seal), `importedAt`, `sourceFile`. Not part of the seal. |

### Statuses

| `status` | Meaning |
|---|---|
| `setup` | Created; the setup questions aren't answered yet. |
| `in_progress` | Being worked on (also while an agent runs a step or a follow-up). |
| `paused` | The user chose a `pause` decision at a review. |
| `stopped` | The user chose `stop` at a review; later steps are `skipped`. |
| `completed` | The last step was finished. |

A run continues into a new round in place: when a round ends with "run another round", the status
goes back to `in_progress` and the ended round moves into `rounds`.

## Steps

Each entry in `steps` (and in `rounds[].steps`) records one workflow step:

```jsonc
{
  "id": "02",
  "label": "Source Checker",
  "kind": "ai",
  "outputFile": "02_check.md",
  "status": "done",
  "response": "# Source Check\n\n…\n\n## Gate result: Pass\n",
  "responseSource": "agent",
  "prompt": "# Session 02 — Source Checker\n\nFor each numbered claim…",
  "inputFiles": ["01_research.md"],
  "inputsDigest": "9c1d33e0",
  "signals": { "gate": "Pass" },
  "wordCount": 61,
  "savedAt": "2026-10-18T18:02:31.004Z",
  "agent": { "jobId": "job-…", "provider": "claude", "model": "…", "startedAt": "…", "finishedAt": "…",
             "durationMs": 180000, "toolCalls": 6, "usage": { "inputTokens": 12000, "outputTokens": 900 } }
}
```

| Field | Type | Notes |
|---|---|---|
| `id`, `label`, `kind`, `outputFile` | | Copied from the workflow step (`outputFile` = `output.file`). |
| `status` | `pending` / `done` / `skipped` | `skipped` only after a `stop` decision, or for steps after the review in a round that ended with "run another round". |
| `response` | string | The output, in Markdown. AI steps: the reply. Review steps: Markdown generated from the answers (see [workflow-format.md → Generated output](workflow-format.md#generated-output)). Empty until done. |
| `responseSource` | `agent` / `paste` / `upload` / `form` | How the response got there. `form` = a review step. |
| `uploadedFileName` | string | When `responseSource` is `upload`. |
| `prompt` | string | AI steps: the exact prompt used, placeholders filled in. |
| `promptOverride` | string | Set when the user edited the prompt for this run. |
| `includedOptional` | string[] | `optionalInputs` the user switched on. |
| `inputFiles` | string[] | Names of the input files the step was given, in order (including carried and follow-up files). |
| `inputsDigest` | string | 8-hex FNV-1a fingerprint of the inputs and prompt when the step was done. The app compares it with the current inputs to warn that a step is out of date. Not cryptographic. |
| `signals` | object | Verdicts found in the reply (or picked by hand), keyed by the signal's `key`. Example: `{ "gate": "Revise" }`. |
| `wordCount` | integer | |
| `fields` | object | Review steps: answers keyed by field `key`. `text` → string; `decision` → the chosen option's `value`; `questions` → `{ "questions": [...], "answers": [...] }`. |
| `checklist` | boolean[] | Spot-check ticks, in the order of the step's `checklist`. |
| `savedAt` | ISO string | When the step was completed. |
| `editedAt` | ISO string | Set when a recorded reply was edited by hand afterwards. |
| `agent` | object | Set when an agent wrote the reply: `jobId`, `provider` (`claude`, `codex` or `pi`), `model`, `sessionId` (the tool's own session id), `startedAt`, `finishedAt`, `durationMs`, `toolCalls` (web searches and fetches), `usage` (token counts if reported), `trimmed` (`true` if chat around the document was removed). |
| `followUpClosed` | boolean | The user kept this step's "investigate further" result as final. |

To get the workflow's own definition of a step (its prompt template, signals, review fields), use the
same index in `template.definition.steps`.

## Rounds

A round ends when the user chooses "run another round" at a review, or starts a new round from a
recommendation that says to investigate further. The app then:

1. moves the ended round into `rounds` as
   `{ "round": 1, "startedAt": …, "endedAt": …, "carryOver": …, "steps": [...], "followUps": [...] }`.
   The steps are exactly as they were; steps after the deciding step are `skipped` if they weren't done;
2. resets `steps` to `pending`, increments `round` and sets `roundStartedAt`;
3. sets `carryOver` to the files the new round receives.

```jsonc
"carryOver": {
  "into": ["01"],                          // step ids that receive these files as extra inputs
  "files": [
    { "name": "round-1_01_research.md", "content": "…", "fromStepId": "01" },
    { "name": "round-1_review_answers.md", "content": "…", "fromStepId": "review" }
  ]
}
```

`fromStepId` is the step the file came from. For follow-up material it is `followup:research` or
`followup:answers`.

`rounds[n].carryOver` is what **that** round received, so you can trace any round's inputs. Each round
only carries the previous round's files; earlier rounds are reachable through `rounds`.

## Follow-ups

When a step's verdict recommends more research (a signal value listed in the workflow's `followUp`),
the user can run a quick follow-up or update the step with their own answers. Each one is recorded in
`followUps` for the current round and moves into `rounds[n].followUps` when the round ends.

```jsonc
{
  "n": 1,                         // 1, 2, … within the round
  "kind": "research",             // "research" (research session, then the step again) or "answers" (the step again)
  "stepId": "03",                 // the step that recommended more research
  "createdAt": "…",
  "questions": ["How much of QA could be automated?", "…"],   // its open questions at the time
  "answers": "Hotfixes ship the same day, outside the cycle.", // what the user added ("" if nothing)
  "previous": "# Recommendation\n…",                         // the step's output before this follow-up
  "status": "done",               // "running", "done" or "failed"
  "research": "# Follow-up Research\n…",                       // research findings (kind "research" only)
  "agent": { … }                  // who did the research (same shape as steps[].agent)
}
```

A missing `kind` means `research`. After a follow-up, the step itself (`steps[i]`) holds the **updated**
output; `previous` keeps the earlier one. Per round, a step can have at most one follow-up of each kind.

## File naming conventions

Every output has a file name (`outputFile`), and the same names are used as input-file names, in
downloads, and inside AI sessions (`--- BEGIN FILE: <name> ---`). The app adds these derived names:

| Name | What it is |
|---|---|
| `<outputFile>` | A step's output in the current round, e.g. `01_research.md`. |
| `round-<N>_<outputFile>` | Round N's output carried into round N+1, e.g. `round-1_01_research.md`. Also the download name for earlier rounds' files. |
| `round-<N>_follow-up_research.md` | Round N's follow-up research, carried into round N+1. |
| `round-<N>_follow-up_answers.md` | All of round N's follow-up answers in one file, carried into round N+1. |
| `follow-up_previous_<outputFile>` | Input to a step re-run after a follow-up: its latest earlier output. |
| `follow-up_answers.md` | Input to that re-run: all the user's answers to its open questions this round. |
| `follow-up_research.md` | Input to that re-run: the research findings, if a research follow-up ran. |

## Reading a run: recipes

The examples use `jq`; [`parse_run.py`](examples/parse_run.py) does all of this in Python.

**The final result.** The last step marked `feature: true` in the workflow that is `done`:

```bash
jq -r '. as $r
  | [range(0; .steps|length)
     | select($r.template.definition.steps[.].feature and $r.steps[.].status == "done")]
  | last as $i | $r.steps[$i].response' run.json
```

**All verdicts in the current round**, as `step.key = value`:

```bash
jq -r '.steps[] | select(.signals) | .id as $id | .signals | to_entries[] | "\($id).\(.key) = \(.value)"' run.json
```

**The user's review answers and decision:**

```bash
jq '.steps[] | select(.kind == "human") | {id, fields}' run.json
```

The decision field's value is an option `value`; look up its label and effect in
`template.definition.steps[i].fields[]`.

**Every round, oldest first, as one list:**

```bash
jq '[(.rounds // [])[], {round: (.round // 1), steps, followUps, carryOver}]' run.json
```

**Is it finished?**
- `status` is `completed` (the last step was done) or `stopped` (ended at a review).
- `paused` and `in_progress` aren't finished.
- Earlier rounds always ended by continuing into the next round.

**What a step was given.**
- `inputFiles` lists the names.
- The content of an earlier step's file is that step's `response` in the same round.
- `round-N_…` files are in `carryOver.files`.
- `follow-up_…` files are rebuilt from `followUps`: `previous`, `answers` and `research`.

Keep in mind:
- Look steps up by `id` rather than index when comparing runs of different workflow versions.
- `response` is Markdown written by a model or generated from a form. To pull structured values out,
  use `signals` (already extracted) or the workflow's own conventions (numbered claims, question sections).
- Ignore fields you don't recognize. Newer versions of the app add fields; they don't remove or rename
  the ones documented here within `formatVersion` 1.

## Verifying a run

Two hashes show whether a run file is intact:

| Check | How |
|---|---|
| **Workflow fingerprint** | `template.hash == sha256(stableJSON(template.definition))` |
| **Content seal** | `integrity.contentHash == sha256(stableJSON(run without "integrity" and "importVerification"))` |

- `stableJSON` is JSON with object keys sorted (by UTF-16 code units, the same as sorting plain ASCII
  keys), no whitespace, and properties whose value is `undefined` left out. Strings are escaped like
  JavaScript's `JSON.stringify` (non-ASCII characters as-is). Arrays keep their order.
- `sha256(…)` is the hex digest of the UTF-8 bytes, written as `"sha256:<64 hex>"`.
- The app re-seals on every save, so a mismatch means the file was edited outside the app after its
  last save. A fingerprint mismatch means the embedded workflow was edited.
- These are integrity checks, not signatures: anyone can recompute them after editing. They catch
  accidental or casual edits and show that a run matches the workflow version in its tag.

JavaScript:

```js
import { createHash } from "node:crypto";
const stable = (v) =>
  v === null || typeof v !== "object" ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
const sha = (s) => "sha256:" + createHash("sha256").update(s, "utf8").digest("hex");

const { integrity, importVerification, ...rest } = run;
const fingerprintOk = sha(stable(run.template.definition)) === run.template.hash;
const sealOk = integrity ? sha(stable(rest)) === integrity.contentHash : null;
```

Python: see `verify()` in [`parse_run.py`](examples/parse_run.py).

The workflow fingerprint is the same hash the app uses to identify workflows, so you can match a run
to a workflow file by hashing the workflow (in its normalized form, as downloaded with **Workflow JSON**).

## Compatibility

- Runs saved before rounds existed have no `round`, `rounds` or `carryOver`; treat them as round 1.
- Runs saved before follow-ups existed have no `followUps`.
- Importing a run file (drop it on the home page) keeps its original seal and records the result of the
  checks in `importVerification`. If its `id` is already taken, it gets a new one; that changes the content, so
  the seal stops matching until the run is next saved in the app.
