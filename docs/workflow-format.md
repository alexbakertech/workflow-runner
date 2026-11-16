# Workflow format (`workflow-template`)

A workflow is one JSON file that describes a sequence of steps. Each step is either an **AI session**
(a prompt plus earlier outputs as input files) or a **review** you fill in yourself. The app runs the
steps in order and records everything in a [run file](run-format.md).

- JSON Schema: [`schemas/workflow-template.schema.json`](schemas/workflow-template.schema.json)
- Complete example using every feature: [`examples/example-workflow.json`](examples/example-workflow.json)
- The built-in workflow (`templates/adversarial-research-v3.json` in the repo) is a larger real example.

## Contents

1. [Top level](#top-level)
2. [Variables](#variables)
3. [Steps](#steps)
4. [AI steps and prompts](#ai-steps-and-prompts)
5. [Signals: verdicts the app reads from replies](#signals)
6. [Review steps (`kind: "human"`)](#review-steps)
7. [Rounds: running the workflow again with what was learned](#rounds)
8. [Further research after a recommendation](#further-research)
9. [Validation rules](#validation-rules)
10. [Identity: hash, tag and versioning](#identity-hash-tag-and-versioning)
11. [Writing prompts the app can parse](#writing-prompts-the-app-can-parse)
12. [Loading, editing and removing workflows](#loading-editing-and-removing-workflows)

## Top level

```jsonc
{
  "format": "workflow-template",   // required, exactly this
  "formatVersion": 1,              // set to 1 by the app
  "id": "release-cadence",         // required; appears in the run tag
  "title": "Release Cadence Review",  // required
  "version": "1.0.0",              // defaults to "1"; appears in the run tag
  "description": "Shown on the workflow card on the home page.",
  "intro": ["Bullet points shown on the 'How this works' card when a run starts."],
  "titleVariable": "question",     // variable used to suggest the run's title
  "variables": [ /* see Variables */ ],
  "steps": [ /* see Steps; at least one */ ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `format` | `"workflow-template"` | yes | When uploading, a file with a `steps` array but no `format` is also accepted. |
| `formatVersion` | `1` | no | Always written as `1`. |
| `id` | string | yes | Short, stable identifier. Keep it the same across versions of the same workflow. |
| `title` | string | yes | |
| `version` | string | no | Free-form; semantic versions are conventional. Default `"1"`. |
| `description` | string | no | |
| `intro` | string[] | no | |
| `titleVariable` | string | no | Key of a variable. Its value (cut to 70 characters) is suggested as the run title. |
| `variables` | array | no | Defaults to `[]`. |
| `steps` | array | yes | At least one step. Order is the order the user goes through them. |

Unknown keys are kept (and placed after the known ones) but have no effect.

## Variables

Variables are the questions asked before a run starts. Their values fill `{{key}}` placeholders in
prompts and review output templates.

```json
{ "key": "question", "label": "Decision to investigate", "help": "One sentence.",
  "placeholder": "Should we…", "required": true, "multiline": true }
```

| Field | Type | Notes |
|---|---|---|
| `key` | string | Placeholder name: letters, digits and `_` (it must match `\w+`). |
| `label` | string | Shown above the input. |
| `help` | string | Small text under the label. |
| `placeholder` | string | Greyed example text in the input. |
| `required` | boolean | The run can't start until it's filled in. |
| `multiline` | boolean | Text area instead of a single line. |

The keys `round`, `prevRound`, `priorRound` and `followUp` are set by the app (see
[Rounds](#rounds) and [Further research](#further-research)). Don't use them as variable keys.

## Steps

Fields shared by both kinds of step:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique within the workflow. Used by `inputs`, `fromStep`, `carryInto` and so on. Short ids such as `"01"` work well. |
| `label` | string | yes | Step name shown in the progress bar and headings. |
| `kind` | `"ai"` or `"human"` | yes | |
| `description` | string | no | Plain-language explanation shown under the step title. |
| `inputs` | string[] | no | Earlier steps whose outputs this step receives, in this order. Each entry is an earlier step's `id` or its `output.file`; file names are converted to ids. |
| `optionalInputs` | string[] | no | Earlier steps the user can switch on as extra input. Same rules as `inputs`. |
| `output` | object | yes | `{ "file": "01_research.md", "title": "Research report" }`. `file` is required and is the name the output goes by everywhere (input files, downloads, carried files). `title` is optional; without it a title is made from the file name (`07_decision_brief.md` → "Decision brief"). |
| `feature` | boolean | no | Show this step's output prominently on the summary page. The **last** featured step that's done is the run's "Outcome"; the others appear as tabs. |

AI-step fields: `prompt` (required), `wordLimit`, `checklist`, `signals`.
Review-step fields: `fields` (required), `outputTemplate`.

Output file names should be unique within a workflow, end in `.md`, and contain no spaces. Names
starting with `round-` or `follow-up` are best avoided because the app uses those prefixes for
[carried and follow-up files](run-format.md#file-naming-conventions).

## AI steps and prompts

```json
{
  "id": "02",
  "label": "Source Checker",
  "kind": "ai",
  "description": "Checks that each cited source says what the research claims.",
  "inputs": ["01"],
  "prompt": "Check every numbered claim in 01_research.md against its source…\n\nEnd with a line `Gate result: Pass`, `Gate result: Revise` or `Gate result: Block`.",
  "output": { "file": "02_check.md", "title": "Source check" },
  "wordLimit": 400,
  "checklist": ["Every claim has a verdict", "Ends with a gate result"]
}
```

| Field | Notes |
|---|---|
| `prompt` | The instructions. Supports [placeholders](#placeholders). |
| `wordLimit` | Shows a word counter; the count turns into a warning above 110 % of the limit. Nothing is cut off. Say the limit in the prompt too. |
| `checklist` | Optional tick boxes for a quick spot-check of the reply. Ticks are saved in the run (`steps[].checklist`). |
| `signals` | Verdicts the app reads from the reply. See [Signals](#signals). |

### What the AI session receives

The input files and the prompt go into one message, files first:

```text
The following 2 files are the input for this session:

--- BEGIN FILE: 01_research.md ---
…content…
--- END FILE: 01_research.md ---

--- BEGIN FILE: 02_check.md ---
…content…
--- END FILE: 02_check.md ---

<the prompt, with placeholders filled in>
```

The files come in this order:
1. files carried in from the previous round (only for `carryInto` steps),
2. `inputs`,
3. `optionalInputs` the user switched on,
4. follow-up files (only when the step is re-run after a follow-up).

When you do a step by hand, the app gives you exactly this text to paste into any chat. When an agent
runs it, the agent also gets standing instructions:
- each step is an isolated session;
- input files are inline;
- when asked to "produce" or "save" a file, reply with that file's complete Markdown and nothing around it;
- use web search to cite sources;
- don't ask questions.

So prompts can talk about "attached files" and "save as `02_check.md`" naturally.

The app strips common wrapping from agent replies before recording them:
- lead-ins such as "Here is the report:",
- a file-name heading,
- a code fence around the whole document,
- closing pleasantries.

### Placeholders

Prompts (and review `outputTemplate`s) use a small Mustache-like syntax:

| Syntax | Result |
|---|---|
| `{{key}}` | The value, trimmed. Empty if not set. |
| `{{#key}}…{{/key}}` | The text inside, only if `key` has a non-blank value. |
| `{{^key}}…{{/key}}` | The text inside, only if `key` is blank or missing. |

Sections can't be nested with the same key. Keys are `\w+` (letters, digits, `_`). Available keys:
- every workflow variable;
- `round`: the current round number, `"1"`, `"2"`, …;
- `prevRound`: the previous round number, empty in round 1;
- `priorRound`: `"yes"` only in a step that receives carried files from the previous round;
- `followUp`: `"yes"` only when the step is being re-run with follow-up files.

```text
Investigate: {{question}}
{{#scope}}Scope: {{scope}}
{{/scope}}{{#priorRound}}This is round {{round}}. The round-{{prevRound}}_* files are the previous round's work; build on them.
{{/priorRound}}
```

Users can edit a prompt for a single run; the run records the edited text (`steps[].promptOverride`)
and the prompt actually used (`steps[].prompt`).

## Signals

A signal is a verdict the app reads out of an AI reply, such as `Gate result: Revise` or
`Suggested next action: Investigate further`. Signals drive warnings, automatic stops, corrections and
follow-up research, and they're shown on the summary page.

```json
"signals": [{
  "key": "gate",
  "label": "Source gate",
  "match": "gate",
  "options": ["Pass", "Revise", "Block"],
  "warnOn": ["Revise", "Block"],
  "warning": "The checker flagged claims. Correct them in “Researcher” and run the check again, or continue and carry the flag forward.",
  "fix": { "step": "01", "on": ["Revise"] }
}]
```

| Field | Type | Notes |
|---|---|---|
| `key` | string | Name under which the value is stored (`steps[].signals.gate`). |
| `label` | string | Shown with the value, e.g. "Source gate: Revise". |
| `match` | string | Case-insensitive regular expression for the words that come before the verdict on the same line (e.g. `gate`, `next action`). Without it, any line of the form `…: <option>` counts. |
| `options` | string[] | Possible values. Matching ignores case; the stored value uses the casing given here. |
| `warnOn` | string[] | Values that show a warning callout and stop an agent that's running steps automatically (except as allowed by `fix` and the user's settings, below). |
| `warning` | string | Callout text for `warnOn` values. Supports placeholders. |
| `fix` | object | `{ "step": "<earlier AI step id>", "on": ["Revise"] }`. For these values the step offers **Fix with the agent**: the checked step gets this reply and corrects only the flagged claims, then this step runs again. When an agent is running steps automatically, it corrects at most once before pausing for the user. |
| `followUp` | string[] | Values that recommend more research, such as `["Investigate further"]`. The step then offers [further research](#further-research). |

### How a value is found

For each line of the reply, the app looks for:
1. the `match` expression;
2. up to 40 more characters;
3. a separator (`:`, `-`, `—` or `–`);
4. optional Markdown emphasis (`*`, `_`, `` ` ``);
5. one of the `options` as a whole word.

Longer options are tried first, so "Proceed conditionally" wins over "Proceed". A matching **heading**
line (starting with `#`) takes priority over body text; otherwise the first match wins. These all work
with `"match": "gate"`:

```text
## Gate result: **Revise**
Gate result — Pass
**Gate:** Block
```

If nothing matches, the user can pick the value by hand. That choice is stored in `steps[].signals`
like a detected one.

When an agent runs steps automatically, a `warnOn` value stops the chain. One exception: for a value
listed in `fix.on`, the user's setting "When a source check says Revise" can make the agent correct it
automatically, once, or carry the flag forward and continue.

## Review steps

A review step (`"kind": "human"`) is a form the user fills in. Its `inputs` are shown as readable tabs
above the form. Its output is Markdown generated from the answers, which later steps can use as input
like any other output.

```json
{
  "id": "review",
  "label": "Your Review",
  "kind": "human",
  "inputs": ["01", "02"],
  "output": { "file": "review_answers.md" },
  "fields": [
    { "key": "answers", "type": "text", "label": "Your answers", "questionsFrom": "01",
      "placeholder": "Answer whichever questions apply." },
    { "key": "notes", "type": "text", "label": "Extra context" },
    { "key": "next", "type": "decision", "label": "What next?", "options": [
      { "value": "go",    "label": "Continue to the recommendation", "effect": "continue" },
      { "value": "again", "label": "Run another round with this context", "effect": "loop", "carryInto": ["01"] },
      { "value": "pause", "label": "Pause", "effect": "pause" },
      { "value": "stop",  "label": "Stop here", "effect": "stop" }
    ]}
  ],
  "outputTemplate": "# Review\n\n## Answers\n{{answers}}\n\n## Extra context\n{{notes}}\n\n## Decision\n{{next}}"
}
```

### Field types

All fields have `key` (used in `outputTemplate` and stored in `steps[].fields`), `type`, `label` and
an optional `help`.

| Type | Extra fields | What the user sees | Stored value |
|---|---|---|---|
| `text` | `placeholder`, `questionsFrom` | A text box. With `questionsFrom` (an earlier step id or output file), the questions raised in that step's reply (up to 5) are listed above the box. | string |
| `questions` | `fromStep` (required), `count` (default 3) | One answer box per question found in `fromStep`'s reply. A blank answer is recorded as "Unknown". | `{ "questions": [...], "answers": [...] }` |
| `decision` | `options` (required) | Radio choices. | the chosen option's `value` |

Questions are found by [the question rules](#writing-prompts-the-app-can-parse). Prefer `text` with
`questionsFrom` for new workflows: one free-text answer reads better than a fixed number of boxes.

### Decision options and effects

Only the **first** `decision` field of a step controls what happens next. A step without one simply
continues.

| `effect` | What happens when the user saves the step |
|---|---|
| `continue` | Goes on to the next step (or finishes the run if this is the last step). |
| `pause` | Saves the run as `paused` and returns to the home page. |
| `stop` | Marks the remaining steps `skipped` and finishes the run as `stopped`. It can be reopened from the summary. |
| `loop` | Starts the next [round](#rounds) of the same run. |

Option fields: `value` (stored), `label`, `description` (small text under the label), and for `loop`
only, `carry` and `carryInto`.

### Generated output

With `outputTemplate`, the output is that template filled in from the run's variables plus one
placeholder per field. Without it, the output is `# <step label>` followed by `## <field label>` and
the formatted value for each field.

How each field type is formatted:

````markdown
<!-- text: one bullet per line; "- None" if empty -->
- First line of the answer
- Second line

<!-- text with questionsFrom -->
Questions raised:
1. What is your budget?
2. Who maintains it?

Answer:

The user's answer as written. ("No answer given." if empty)

<!-- questions -->
- Q1: What is your budget?
  - **Answer:** About 5k
- Q2: Who maintains it?
  - **Answer:** Unknown

<!-- decision: a checklist with the chosen option ticked -->
- [x] Continue to the recommendation
- [ ] Run another round with this context
- [ ] Pause
- [ ] Stop here
````

## Rounds

A `loop` decision continues the **same run** as a new round. The app does three things:

1. The round that just ended is archived inside the run (`rounds[]` in the run file) exactly as it was.
2. Every step is reset, and the run starts again at the first step with the same variables.
3. This round's outputs are given to the next round as extra input files, named
   `round-<N>_<output file>` (for example `round-1_01_research.md`).

| Option field | Default | Meaning |
|---|---|---|
| `carry` | every step up to and including this one | Step ids whose outputs are carried forward. |
| `carryInto` | the first AI step | Step ids that receive the carried files. |

In a receiving step, `{{#priorRound}}…{{/priorRound}}` sections are shown and `{{round}}` and
`{{prevRound}}` are set, so the prompt can say how to use the earlier work. A typical paragraph:

```text
{{#priorRound}}This is round {{round}} of this investigation. The attached round-{{prevRound}}_* files are the
previous round's reports and the user's answers. Treat the user's answers as their scenario. Build on the
earlier work rather than repeating it: re-check disputed claims and close the gaps it left.

{{/priorRound}}
```

There's no limit on the number of rounds. Each round carries only the previous round's files, so input
size doesn't grow from round to round.

## Further research

When a step's signal value is listed in `followUp` (for example a final recommendation that says
`Suggested next action: Investigate further`), the step and the summary page show the step's open
questions, a box for the user's answers, and these choices:

| Choice | What runs | Limit |
|---|---|---|
| **Quick follow-up** | One research session on just the open questions, then this step runs again with the findings. | Once per step per round |
| **Update with my answers** | This step runs again with the user's answers only; no research. Offered after the quick follow-up. | Once per step per round |
| **Full new round** | The next [round](#rounds) of the run, carrying in every output up to this step, plus any follow-up research and all of the user's answers. It goes to the `carryInto` steps of the workflow's `loop` option, or else the first AI step. | Unlimited |
| **Keep this result as final** | Hides the choices (can be undone). | — |

When the step runs again after a follow-up, it receives at most three extra input files, however many
follow-ups there were, and `{{#followUp}}…{{/followUp}}` sections in its prompt are shown:

| File | Content |
|---|---|
| `follow-up_previous_<output file>` | The step's latest earlier output. |
| `follow-up_answers.md` | All of the user's answers to its open questions this round. |
| `follow-up_research.md` | Findings from the research session, if one ran. |

The prompt should say what to do with them. In particular, tell the step to recommend more research
again only when research could still settle something. Otherwise it will keep asking. For example:

```text
{{#followUp}}

**Follow-up:** An earlier version of this brief recommended investigating further. follow-up_previous_* is
that earlier version, follow-up_answers.md holds what the user added, and follow-up_research.md (if present)
holds the research findings. Write an updated brief and say briefly what changed.

Only recommend **Investigate further** again if more research could still settle a critical question. If what
remains can only be answered by the user (their own quotes, bills, plans, approvals), recommend
**Proceed conditionally** instead and state those answers as the conditions.{{/followUp}}
```

The open questions are found with the same [question rules](#writing-prompts-the-app-can-parse) as
review steps, so give the step a numbered list under a heading containing "questions".

## Validation rules

A workflow is rejected (with a list of every problem) when:

- `format` isn't `"workflow-template"`, or `id` or `title` is missing;
- there are no steps;
- a step has no `id`, a duplicate `id`, no `label`, a `kind` other than `ai`/`human`, or no `output.file`;
- an AI step has no `prompt`, or a review step has no `fields`;
- an entry in `inputs` or `optionalInputs` isn't an **earlier** step's `id` or `output.file`;
- a `questions` field's `fromStep`, or a `text` field's `questionsFrom`, isn't an earlier step's `id` or `output.file`;
- a decision option's `effect` isn't `continue`, `pause`, `stop` or `loop`;
- a signal's `fix.step` isn't an earlier step.

Not checked, so take care:
- whether placeholder keys exist (a missing key renders as empty);
- unique field keys within a step;
- unique output file names;
- whether `fix.step` is an AI step (a `fix` pointing at a review step is ignored);
- whether `carry`/`carryInto` ids exist (unknown ids are ignored).

On load, step references by output file name are replaced by step ids, and keys are put in a fixed
order. The **Workflow JSON** button downloads this normalized form.

## Identity: hash, tag and versioning

Each workflow is identified by a SHA-256 hash of its normalized JSON (keys sorted, no whitespace; see
[run-format.md → Verifying a run](run-format.md#verifying-a-run)). The **tag** is
`<id>@<version>#<first 8 hex characters of the hash>`, for example
`release-cadence@1.0.0#3f2a9c1d`.

- Any change, even to one prompt word, gives a new hash. An uploaded file with the same hash as an
  existing workflow isn't added twice.
- Runs copy the whole workflow into the run file, so editing or removing a workflow never affects
  existing runs.
- Bump `version` when you change a workflow, so the tag shows it. Keep `id` and step ids stable across
  versions of the same workflow; tools that compare runs rely on them.

## Writing prompts the app can parse

Most of what the app does with a reply relies on a few conventions. Ask for them explicitly in the
prompt.

**Verdicts (signals).** Ask for a dedicated line in a fixed form, with the exact option words:

```text
End with a heading line in exactly this form: `## Gate result: Pass`, `## Gate result: Revise`
or `## Gate result: Block`.
```

**Questions for the user.** Review fields and follow-ups use the numbered (or bulleted) list under
the **last** heading whose text contains "question". A bold line on its own also counts as a heading.
Ask for a fixed structure:

```text
Finish with a section titled **Open questions**: at most three numbered questions for the user.
```

The rules:
- A heading is a Markdown heading (`#` to `######`) or a line that is only bold text (`**Open questions**`).
- List items are `1.`, `1)`, `-`, `*` or `+`. An indented line continues the previous item.
- Up to 3 questions are used for a `questions` field (`count` changes this); up to 5 for `questionsFrom`
  and follow-ups.
- With no such section, list items ending in `?` are used instead (the last few).

**Output files.** Name the output file in the prompt (`Output: 02_check.md, 400 words maximum, titled
"Source Check"`), and keep `output.file` the same.

**References between steps.** Refer to inputs by their file names (`01_research.md`); those are the
names in the `--- BEGIN FILE ---` markers.

## Loading, editing and removing workflows

- **Built-in workflows** live in the `templates/` folder of the app and can't be removed in the app.
- **Uploaded workflows**: drop a `.json` file on the home page. They're stored in `data/templates/` and
  can be removed with the trash icon. Runs started from them keep working.
- To start a new workflow, download an existing one with **Workflow JSON**, edit it, bump `version`, and
  drop it back in. Errors are listed if it doesn't validate.
