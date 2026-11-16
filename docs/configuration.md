# Configuration

Everything you can configure: environment variables, the Settings page, the Docker setup, the data folder,
the npm scripts, and what each workflow can tune. For the HTTP API see [api.md](api.md). For workflow files
see [workflow-format.md](workflow-format.md).

## Contents

1. [Environment variables](#environment-variables)
2. [Settings page](#settings-page)
3. [Local models (pi)](#local-models-pi)
4. [Docker](#docker)
5. [The data folder](#the-data-folder)
6. [npm scripts](#npm-scripts)
7. [Workflows](#workflows)

## Environment variables

How you set them depends on how you run the app:

- **`npm run dev` and `npm start`:** export the variables in your shell before starting, for example
  `export ACCESS_TOKEN=off` then `npm run dev`.
- **Docker Compose:** copy `.env.example` to `.env` next to `docker-compose.yml`. Compose reads `.env` on
  its own. Only the variables that `docker-compose.yml` passes into the container reach the app:
  `ACCESS_TOKEN`, `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. The others are set in the Dockerfile
  (see the last rows).

| Variable | Default | What it does | Where it's read |
|---|---|---|---|
| `ACCESS_TOKEN` | Unset: a token is created in `data/access-token.txt` (`npm start`, Docker with an empty value). `npm run dev`: off. Docker Compose: `off` when unset. | Controls the access check for other devices. See the values below. | `src/lib/server/token.ts` (`tokenSource`, `getToken`); `src/instrumentation.ts` (prints the token at startup); `docker-compose.yml` (default `off`) |
| `DATA_DIR` | `data` in the folder the app starts from. In the image: `/app/data`. | Folder for runs, uploaded workflows, settings, jobs and the token file. See [The data folder](#the-data-folder). | `src/lib/server/store.ts`; `src/lib/server/token.ts`; `scripts/seed.mjs` |
| `PORT` | `3000` (see `.env.example`). The image sets `3000`. | Port `npm start` listens on. Docker always listens on 3000 inside the container; the host port is set in `docker-compose.yml`. | Not read by app code. Read by Next.js's server (see `.env.example` and the Dockerfile). |
| `HOSTNAME` | Set to `0.0.0.0` in the image. Not set by the repo otherwise. | Address the server listens on. `0.0.0.0` means all interfaces inside the container. | Not read by app code. Read by Next.js's standalone server (`server.js`) (see Dockerfile). |
| `ANTHROPIC_API_KEY` | Unset. | Used by the Claude provider instead of a `claude auth login` sign-in. An empty value is ignored, so it can't shadow a sign-in. | `src/lib/server/agents/claude.ts` (`envWithoutEmpty`); passed through by `docker-compose.yml` |
| `OPENAI_API_KEY` | Unset. | For Codex. If set and Codex isn't signed in, the app runs `codex login --with-api-key` with it once per server process, the first time Codex's status is checked (for example when Settings or a run's agent panel loads). The key is never logged. An empty value is ignored. Codex runs also get the key from this variable. | `src/lib/server/agents/codex.ts` (`loginWithApiKey`, `run`); passed through by `docker-compose.yml` |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent`. In the image: `/home/node/.pi/agent`. | Folder holding pi's `models.json`. See [Local models (pi)](#local-models-pi). | `src/lib/server/agents/pi.ts` |
| `NODE_ENV` | Set by Next.js (`development` for `npm run dev`, `production` for `npm start` and the image). | Not for you to set. In `development` the access check is off unless `ACCESS_TOKEN` is set. | `src/lib/server/token.ts` (`tokenSource`) |
| `NEXT_RUNTIME` | Set by Next.js. | Not for you to set. The startup code (token printing, loading saved jobs) runs only in the Node runtime. | `src/instrumentation.ts` |
| `CLAUDE_AGENT_SDK_CLIENT_APP` | Set by the app. | Identifies the app to the Claude Agent SDK. Not configurable. | `src/lib/server/agents/claude.ts` |
| `NEXT_TELEMETRY_DISABLED` | `1` in the image. | Turns off Next.js telemetry during the build and at run time. | `Dockerfile` |
| `NEXT_OUTPUT_STANDALONE` | `1` in the image's build stage. | Builds the self-contained server the Docker image runs (`node server.js`). Leave it unset for `npm run build` / `npm start`. | `next.config.ts`; `Dockerfile` |
| `CODEX_HOME` | `/home/node/.codex` in the image. | The Codex CLI's folder for sign-in and its SQLite databases. See [Docker volumes](#volumes). | `Dockerfile`; used by the Codex CLI |
| `HOME` | `/home/node` in the image. | Home folder inside the container. The default `~/.pi/agent` and the Claude and Codex folders are under it. | `Dockerfile` |
| `DISABLE_AUTOUPDATER` | `1` in the image. | Turns off auto-updates of the Claude Code CLI. The Dockerfile says auto-updates are off and the agent CLI versions are pinned on purpose. | `Dockerfile` |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1` in the image. | Set in the Dockerfile. The repo doesn't document it further (see Dockerfile). | `Dockerfile` |
| `USERPROFILE` | Unset. | Only in `docker-compose.override.example.yml`: the Windows home folder used to find `.claude` and `.pi/agent`. Falls back to `~`. Not read by the app. | `docker-compose.override.example.yml` |

**`ACCESS_TOKEN` values** (see [Access token](#access-token)):

- `off`, `none`, `false`, `0`, `disable` or `disabled` (any case): the access check is off.
- Empty, or only spaces: same as unset. In production (`npm start`, Docker) the token file is used. In
  `npm run dev` the check is off.
- Any other value: that value is the token. Surrounding spaces are trimmed, and matching ignores case.

## Settings page

Open **Settings** in the app. Choices are saved as you make them, in `data/settings.json` under the key
`agents`, and apply without a restart. See [The data folder](#the-data-folder).

### Agents

Each provider has a card: Claude (Claude Code subscription), Codex (ChatGPT subscription) and Local
(models from pi). Each card shows **Ready**, **Not signed in** (Claude, Codex), **Not set up** (Local, when pi has no model providers) or **Not available**, the CLI version, and
the account if known. When something is wrong, the card shows the fix commands, with a copy button.
**Check again** re-runs the checks; results are cached for 5 minutes.

| Option | Choices | Default | What it does |
|---|---|---|---|
| Default provider | Claude, Codex, Local, or none. Set with **Make default** on a ready provider's card. | None (`defaultProvider: null`) | Pre-selected when an agent panel opens, if that provider is ready. Also used by **Fix with the agent** when the step has no earlier provider. |
| Default model | The provider's model list, shown when the provider is ready. | Claude: `sonnet` if the SDK lists it, else the first model. Codex: the first visible model from `codex debug models`, sorted by its priority. Local: the first model from `pi --list-models`. | Model used for that provider. Stored as `models.<provider>`. |
| Keep going automatically | On or off (checkbox). | Off (`autoAdvance: false`) | After an agent finishes a step, starts the next AI step too. It always stops at review steps, at a `Block` verdict and on any failure. Each run's agent panel has its own checkbox, which starts from this setting. |
| When a source check says "Revise" | One of the three choices below. | Pause so I can decide (`onRevise: "pause"`) | What a run that keeps going automatically does when a check flags claims to correct. Blocking verdicts always pause. |

The three choices for **When a source check says "Revise"**, with their help text from `REVISE_POLICIES`:

| Choice | Value | Help text |
|---|---|---|
| Pause so I can decide | `pause` | Stop on the check’s result and wait for you. |
| Have the agent fix it | `fix` | Send the check’s report back to the step it checked, correct the flagged claims, then run the check again. Pauses if it still asks for revisions. |
| Carry the flag and keep going | `continue` | Record the verdict and continue; later steps are told about the flagged claims. |

The Revise choice only matters for a signal that has a `fix` in its workflow (see [Signals](workflow-format.md#signals)).

Starting an agent from a run's agent panel also saves that run's provider, model and keep-going choice as
the new defaults.

### Access token

This section appears when the access check is on. It shows:

- **Token**: hidden until you press **Show**. **Copy token** copies it.
- **Copy sign-in link**: a link to this app with `?token=…`. Opening it signs a device in without typing the
  token. Treat it like the token.
- Where the token comes from. If it's set by `ACCESS_TOKEN`, the page says so. If it's in
  `data/access-token.txt`, the page shows that path. Editing or deleting that file changes the token; a
  missing or empty file gets a new token the next time it's needed.
- **Make a new token** (only when the token is in the file): writes a new token. Other devices must sign in
  again. This device stays signed in.
- **Sign out of this device**: clears this device's sign-in cookie.

Devices that sign in stay signed in for a year.

**When you can't make a new token:**

- `ACCESS_TOKEN` is set to a value. The button isn't shown, and the API refuses with
  `The token is set by ACCESS_TOKEN in the environment, so it can’t be changed here.` (HTTP 409). Change the
  variable and restart instead.
- The check is off (`ACCESS_TOKEN=off`, `disable`, and so on, or `npm run dev` without a value). There is no
  token, so the section shows a warning instead. It is fine while only this computer can reach the app.

## Local models (pi)

Local models come from pi. The app reads only the provider names in pi's `models.json` (the file in
`PI_CODING_AGENT_DIR`, default `~/.pi/agent/models.json`). Each provider listed there is offered as a Local
model, and the app asks pi for that provider's models with `pi --list-models --offline`. Local providers need
no sign-in. Subscription logins for pi (Anthropic, OpenAI and similar) are never offered.

Every other setting in `models.json`, including `maxTokens`, belongs to pi, and the app doesn't read it. If a
reply stops because it hit the model's output limit, the app shows this warning:
`The reply hit this model’s output limit and is probably cut off. Raise maxTokens for it in pi’s models.json, or use another provider.`
Raise `maxTokens` for that model in `models.json`, or pick another provider.

In Docker, `models.json` lives in the `pi-agent` volume unless you use the override file (see
[Docker volumes](#volumes)).

## Docker

The compose file is `docker-compose.yml`. It builds the image from `Dockerfile` as `workflow-runner:latest`,
names the container `workflow-runner`, and restarts it with `unless-stopped`.

```bash
cp .env.example .env          # optional: API keys, ACCESS_TOKEN
docker compose up -d --build
```

### Ports

| Setting | Meaning |
|---|---|
| `127.0.0.1:3000:3000` (default) | Only this computer can reach the app, at `http://localhost:3000`. |
| `3000:3000` | Other devices on the network can reach it. |

To open the app to other devices:

1. In `docker-compose.yml`, change the port line to `"3000:3000"`.
2. Turn the access check on. It's off by default in Docker (`ACCESS_TOKEN` defaults to `off`). In `.env`, set
   `ACCESS_TOKEN=` (empty) to use `data/access-token.txt`, or set a token of your own.
3. Run `docker compose up -d`.

To use another host port, change the left-hand number, for example `"127.0.0.1:3001:3000"`. You can do this
in `docker-compose.override.yml` instead of editing `docker-compose.yml`, but Compose adds `ports` from an
override to the existing ones rather than replacing them, so use `!override`:

```yaml
services:
  workflow-runner:
    ports: !override
      - "127.0.0.1:3001:3000"
```

The image's health check calls `GET /api/health` every 30 seconds.

### Volumes

| Mount | Holds |
|---|---|
| `./data` → `/app/data` | The data folder: runs, uploaded workflows, `settings.json`, `access-token.txt`, agent jobs. The same folder the dev server uses, so existing runs carry over and stay on this machine. |
| `claude-home` → `/home/node/.claude` (named volume) | The Claude Code sign-in. |
| `pi-agent` → `/home/node/.pi/agent` (named volume) | pi's folder, including `models.json`. |
| `codex-home` → `/home/node/.codex` (named volume) | The Codex sign-in and its SQLite databases. It is not shared with the host, because those databases must not be opened from two machines at once. |

Sign in to Codex inside the container with:

```bash
docker exec -it workflow-runner codex login --device-auth
```

Sign in to Claude with `docker exec -it workflow-runner claude auth login`, or use `ANTHROPIC_API_KEY`.

### Override file: host sign-ins

To share your host's `~/.claude` and `~/.pi/agent` instead of the named volumes:

```bash
mkdir -p ~/.claude ~/.pi/agent                    # create them first, or Docker may create them as root
cp docker-compose.override.example.yml docker-compose.override.yml
```

Compose loads `docker-compose.override.yml` automatically. The override bind-mounts the host folders at the
same paths as the `claude-home` and `pi-agent` volumes. On Windows it uses `%USERPROFILE%`; elsewhere it uses
`~`. The app loads none of the host's Claude settings, hooks or plugins. `docker-compose.override.yml` is
git-ignored.

### Build arguments

| Build argument | Default | What it pins |
|---|---|---|
| `CODEX_VERSION` | `0.163.0` | The Codex CLI (`@openai/codex`), installed globally in the image. |
| `PI_VERSION` | `1.2.0` | pi (`@earendil-works/pi-coding-agent`), installed globally in the image. |

The Claude Code binary comes from the `@anthropic-ai/claude-agent-sdk` package in `node_modules`, which
`package-lock.json` pins. It has no build argument; to change it, update the package.

Pass a version at build time:

```bash
docker compose build --build-arg CODEX_VERSION=0.163.0 --build-arg PI_VERSION=1.2.0
docker compose up -d
```

`docker-compose.yml` doesn't set build arguments, so without the flag the Dockerfile defaults are used. The
Dockerfile comment says to bump these versions deliberately.

### Auto-updates

`DISABLE_AUTOUPDATER=1` is set in the image, so the Claude Code CLI doesn't update itself. The agent CLI
versions change only when you rebuild with new build arguments. See the [environment variables](#environment-variables)
for the other image settings.

## The data folder

Outside Docker the data folder is `./data` in the folder you start the app from. Set `DATA_DIR` to put it
elsewhere. In Docker it's `./data` on the host, mounted at `/app/data`. The app creates folders and files as
it needs them.

```
data/
├── access-token.txt     Access token (only when the token is in a file). A secret.
├── settings.json        Settings page choices, under the key "agents".
├── runs/                One <run-id>.json per run: the investigation, every output, rounds, follow-ups and hashes.
├── templates/           Uploaded workflows: <id>-<hash8>.json, each {"sourceFile", "template"}.
├── jobs/                One <job-id>.json per agent job: status, activity log, partial reply, usage.
└── work/                Scratch folder per running agent job (pi writes its instructions.md here).
```

Files ending in `.tmp` are written first and renamed into place; you may see one briefly while the app runs.

| Path | Written by | Safe to delete? |
|---|---|---|
| `access-token.txt` | `src/lib/server/token.ts` | Yes, but every device signs out. A new token is made the next time it's needed. |
| `settings.json` | `src/lib/server/agents/index.ts` (`saveSettings`) | Yes. Settings go back to their defaults. |
| `runs/` | `src/lib/server/store.ts` (`writeRunRaw`), sample loading, `scripts/seed.mjs` | Only if you don't need those runs. Deleting a run file deletes that investigation. |
| `templates/` | `src/lib/server/store.ts` (`saveTemplate`) | Only for uploaded workflows you don't need. Built-in workflows in `templates/` in the repo aren't affected. |
| `jobs/` | `src/lib/server/jobs.ts` | Yes, when no agent is running. Removes the activity logs and partial replies. Each run keeps its own outputs. The app loads at most the newest 300 jobs at startup; it never deletes them itself. |
| `work/` | `src/lib/server/jobs.ts` | Yes. Each job removes its folder when it finishes, and the whole folder is removed at startup. |

Stop the app before deleting anything in `data/` while an agent is running.

### Backup

Stop the app first, so no file is half-written:

```bash
docker compose stop                        # or stop `npm start` / `npm run dev`
tar -czf workflow-runner-data.tgz data     # run from the folder that contains data/
docker compose start                       # or start the app again
```

To restore, stop the app, move `data/` back into place, and start it again. The sign-in volumes
(`claude-home`, `codex-home`, `pi-agent`) are not in `data/`; back them up separately or sign in again.
`data/access-token.txt` is a secret, so keep backups private.

## npm scripts

| Script | Command | What it does |
|---|---|---|
| `npm run dev` | `next dev` | Starts the development server. The access check is off unless `ACCESS_TOKEN` is set. |
| `npm run build` | `next build` | Builds the production app. Needed before `npm start`. |
| `npm start` | `next start` | Serves the built app. The access check uses the token file unless `ACCESS_TOKEN` says otherwise. |
| `npm run typecheck` | `tsc --noEmit` | Type-checks the project without writing files. |
| `npm run seed` | `node scripts/seed.mjs` | Loads the sample runs from `samples/runs/` into `data/runs/`. Skips runs already there and any whose hashes don't verify. |
| `npm run bundles` | `node scripts/export-bundles.ts` (with a Node warning switched off) | Writes each workflow in `templates/` as Markdown prompt bundles into `bundles/`. With `-- path/to/workflow.json [outDir]`, exports one workflow instead. |

## Workflows

A workflow is a JSON file that describes the steps, their prompts, and the checks the app reads from replies.
Everything below is set per workflow, in its JSON. The [workflow format reference](workflow-format.md) describes
every field. These sections cover what you can tune:

- **Top level** ([`#top-level`](workflow-format.md#top-level)): `id`, `title`, `version`, `description`,
  `intro` (the "How this works" card), `titleVariable` (suggests the run's title) and `variables`.
- **Variables** ([`#variables`](workflow-format.md#variables)): the questions asked before a run starts. Set
  the label, help text, placeholder, whether each is required, and whether it's multi-line.
- **Steps** ([`#steps`](workflow-format.md#steps)): `id`, `label`, `kind` (`ai` or `human`), `description`,
  `inputs` and `optionalInputs` (which earlier outputs a step receives), `output` (file name and title) and
  `feature` (shows the output on the summary page).
- **AI steps and prompts** ([`#ai-steps-and-prompts`](workflow-format.md#ai-steps-and-prompts)): the `prompt`
  (with [placeholders](workflow-format.md#placeholders)), a `wordLimit` (shows a counter and warns above 110 %,
  but never cuts the reply off) and a `checklist` of tick boxes.
- **Signals** ([details](workflow-format.md#signals)):
  the verdicts the app reads from a reply (`match`, `options`, and how each is found). Per signal you set:
  - `warnOn` and `warning`: a value that shows a warning and stops an agent that's running steps automatically.
  - `fix`: a value that offers **Fix with the agent** on an earlier step. Automatic runs correct it at most once
    before pausing, or follow the Revise setting above.
  - `followUp`: a value that offers further research on the step.
  See [How a value is found](workflow-format.md#how-a-value-is-found) for the matching rules.
- **Review steps** ([details](workflow-format.md#review-steps)): the form `fields`
  ([field types](workflow-format.md#field-types)), and the `outputTemplate` that makes the Markdown output
  ([generated output](workflow-format.md#generated-output)). Their decision options are in
  [decision options and effects](workflow-format.md#decision-options-and-effects).
- **Rounds** ([details](workflow-format.md#rounds)):
  a `loop` decision starts another round. Its `carry` and `carryInto` options say which outputs carry forward and
  which steps receive them. The number of rounds is not limited.
- **Further research** ([details](workflow-format.md#further-research)):
  the follow-up choices after a recommendation. A quick follow-up and an answers-only update are each limited to
  once per step per round. A full new round is not limited.
- **Validation** ([`#validation-rules`](workflow-format.md#validation-rules)): what makes the app reject a
  workflow. Prompt and question wording that the app can parse is in
  [writing prompts the app can parse](workflow-format.md#writing-prompts-the-app-can-parse).
