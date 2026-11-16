# HTTP API

The app's web pages use a small JSON API, which you can also script against: list and fetch runs,
load workflows, and start runs. Everything below is relative to the app's address, for example
`http://localhost:3000`.

## Authentication

When the access check is on, every request except `/api/health` and `/api/auth/login` needs the
access token. The check is off by default on the dev server (`npm run dev`) and in the localhost-only
Docker setup, and on by default with `npm start`. `ACCESS_TOKEN=off` turns it off anywhere.
Settings → Access token shows whether it's on and what it is. Use either:

- a header: `Authorization: Bearer <your-token>`, or
- the sign-in cookie, which you get from `POST /api/auth/login` with `{"token": "<your-token>"}`.

Without it, API routes answer `401 {"error": "Sign in with the access token first."}`.

Keep the token out of scripts you share: read it from an environment variable.

```bash
export WR_URL=http://localhost:3000
export WR_TOKEN=…   # from Settings → Access token
curl -s -H "Authorization: Bearer $WR_TOKEN" "$WR_URL/api/runs"
```

Errors are JSON `{"error": "…"}` with a 4xx status. Request bodies are JSON. Some examples below use
[`jq`](https://jqlang.org/) to pick fields out of the responses.

## Pages

The web pages, for linking or bookmarking: `/` (home), `/runs/:id` (a run), `/runs/:id/summary` (its
summary), `/settings` and `/login`. They're rendered in the browser, so fetching them with `curl` returns
the page shell, not the run's content; use the API below for data.

## Runs

| Method and path | Body | Returns |
|---|---|---|
| `GET /api/samples` | | `{ samples: [{ file, id, title, loaded }], anyRuns }` lists available samples and whether any runs exist. |
| `POST /api/samples` | | Loads valid samples once; returns `{ loaded: string[], skipped: [{ file, reason }] }`. |
| `GET /api/runs` | | `{ runs: RunListItem[] }`, newest first. Each item: `id`, `title`, `tag`, `status`, `updatedAt`, `templateTitle`, `templateHash`, `inputsText` (setup answers joined), `progress`, `round`, and `agentStep` while an agent is working. |
| `POST /api/runs` | `{ templateHash }` | `{ id }` of a new run in `setup` status. |
| `GET /api/runs/:id` | | `{ run, verification }`. `run` is the [run file](run-format.md); `verification` is `{ templateHashOk, contentHashOk }` computed on the server. |
| `PUT /api/runs/:id` | `{ run }` | Saves the whole run and re-seals it. Returns `{ run, verification }`. `409` with the current run if the run has moved on to another round since you read it. The embedded workflow, rounds, carry-over and follow-ups can't be changed this way. |
| `DELETE /api/runs/:id` | | `{ ok: true }` |
| `POST /api/runs/:id/next-round` | `{ stepIndex, answers? }` | Starts the next round from a review whose chosen decision is `loop`, or from a step whose verdict recommends more research. Returns `{ id, round }`. |
| `POST /api/runs/:id/follow-up` | `{ stepIndex, answers?, kind?: "research" \| "answers", provider?, model? }` | Starts a follow-up on a step that recommends more research. Returns `{ job }`. `409` if this round already had one of that kind. |

### Exporting every finished run

```bash
mkdir -p runs
for id in $(curl -s -H "Authorization: Bearer $WR_TOKEN" "$WR_URL/api/runs" \
             | jq -r '.runs[] | select(.status == "completed" or .status == "stopped") | .id'); do
  curl -s -H "Authorization: Bearer $WR_TOKEN" "$WR_URL/api/runs/$id" | jq '.run' > "runs/$id.run.json"
done
```

## Workflows

| Method and path | Body | Returns |
|---|---|---|
| `GET /api/templates` | | `{ templates: [...] }`. Each entry: `template` (normalized workflow), `hash`, `tag`, `sourceFile`, `builtIn`, `runCount`. |
| `GET /api/templates/bundle?hash=sha256:…` | | Downloads the workflow prompt bundle as Markdown. `400` without `hash`, `404` if no workflow has that hash. |
| `DELETE /api/templates?hash=sha256:…` | | Removes an uploaded workflow (built-in ones can't be removed). |
| `POST /api/import` | `{ data, fileName? }` | Loads any supported file, the same as dropping it on the home page. A workflow returns `{ kind: "template", hash, tag, title }`, or `400 { error, details: [...] }` listing every validation problem. A run file returns `{ kind: "run", id, verification }`. |

Validating a workflow before sharing it:

```bash
jq -n --slurpfile w my-workflow.json '{data: $w[0], fileName: "my-workflow.json"}' \
  | curl -s -H "Authorization: Bearer $WR_TOKEN" -H "content-type: application/json" \
         -d @- "$WR_URL/api/import"
```

## Agents

| Method and path | Body | Returns |
|---|---|---|
| `GET /api/agents` | | `{ providers, settings }`: which agent tools are installed and signed in, with their models. Add `?refresh` to check again instead of using the cached result. |
| `GET /api/runs/:id/agent` | | `{ jobs }`: recent agent jobs for the run, newest first. |
| `POST /api/runs/:id/agent` | `{ stepIndex, provider, model?, autoAdvance? }`, or `{ fixFrom, provider, … }` to correct the step a check flagged | `{ job }`. Steps run one at a time across the app; others queue. |
| `DELETE /api/runs/:id/agent` | | Cancels the run's queued or running job. |
| `GET /api/runs/:id/agent/events` | | Server-sent events: the run's recent jobs, then each job update as it happens. |
| `GET /api/settings`, `PUT /api/settings` | `{ defaultProvider?, models?, autoAdvance?, onRevise? }` | Agent preferences. |

`provider` is `claude`, `codex` or `pi`. A job records `status` (`queued`, `running`, `succeeded`,
`failed`, `cancelled`), progress `events`, `toolCalls`, `usage`, and `stoppedBecause` when an automatic
chain stops. When a job succeeds, its output is already saved in the run.

## Other

| Method and path | Notes |
|---|---|
| `GET /api/health` | No token needed. `200 {"ok": true}` when the app is up. |
| `POST /api/auth/login` | Body `{"token": "<your-token>"}`. Sets the sign-in cookie; `401` for a wrong token. No token needed to call it. |
| `POST /api/auth/logout` | Clears the sign-in cookie. |
| `GET /api/auth/token` | `{ token, source, file }`: the current access token (`null` when the check is off), where it comes from (`env`, `file` or `off`), and the token file's path. |
| `POST /api/auth/token` | Makes a new token, which signs out every other device. This device stays signed in. `409` when the token is set by `ACCESS_TOKEN`. |
