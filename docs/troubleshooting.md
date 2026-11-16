# Troubleshooting

## Port 3000 is already in use

The app fails to start because port 3000 is in use (`EADDRINUSE`). Docker, `npm run dev` and `npm start` all use port 3000. Run only one at a time, or pick another port:

```bash
npm run dev -- -p 3001     # dev server
PORT=3001 npm start        # production server
```

For Docker, change the port mapping as described in [Configuration: Ports](configuration.md#ports).

## The app asks for an access token

The app shows a sign-in page asking for an access token. `npm run build && npm start` (production mode) turns the access token on. The token is printed in the terminal when the app starts and is saved in `data/access-token.txt`. To turn the check off, start with `ACCESS_TOKEN=off`. In Docker the check is off by default because the app only listens on this computer.

## Node.js version errors during npm install

`npm install` fails with version errors. The app needs Node.js 24 or newer. Check with `node --version`. If you use nvm, run `nvm use` in the project folder (there is an `.nvmrc`).

## Claude shows as not signed in

**Settings** shows Claude as not signed in. Open **Settings**; it shows the exact command. Without Docker, run `claude auth login`. In Docker, run `docker exec -it workflow-runner claude auth login`, or share your computer's Claude Code sign-in with the override file (see [Permission errors with the Docker override file](#permission-errors-with-the-docker-override-file)). Or set `ANTHROPIC_API_KEY` (in Docker: in a `.env` file next to `docker-compose.yml`, copied from `.env.example`). Then press **Check again** in **Settings**.

## Codex shows as not signed in

**Settings** shows Codex as not signed in. Without Docker, run `codex login`. In Docker, run `docker exec -it workflow-runner codex login --device-auth` and open the link it prints. Or set `OPENAI_API_KEY`; the app signs Codex in with it once when it checks the status.

## Local models: no providers found

No local model providers are offered. The app only offers model servers listed in pi's `models.json` (in `~/.pi/agent/`, or the folder in `PI_CODING_AGENT_DIR`). In Docker, either add the file in the `pi-agent` volume or share your computer's `~/.pi/agent` with the override file (see [Permission errors with the Docker override file](#permission-errors-with-the-docker-override-file)).

## Permission errors with the Docker override file

The app can't write to shared folders when using the override file. `docker-compose.override.example.yml` shares your computer's `~/.claude` and `~/.pi/agent` with the container. Copy it to `docker-compose.override.yml`. If those folders don't exist yet, Docker creates them owned by root and the app can't write to them. Create them first:

```bash
mkdir -p ~/.claude ~/.pi/agent
```

If they were already created by Docker as root, fix the owner:

```bash
sudo chown -R "$(id -u):$(id -g)" ~/.claude ~/.pi/agent
```

Then `docker compose up -d` again.

## You've hit a usage limit

A step fails with a usage limit error. The provider's plan limit was reached. Wait for it to reset and run the step again, or do the step by hand. The app never retries on its own. If a provider says a request would be billed as extra usage, the app stops so nothing is charged.

## A reply looks cut off (local models)

A local model's reply stops mid-sentence. Local models have an output limit (`maxTokens` in pi's `models.json`). The app warns when a reply hit it. Raise `maxTokens` for that model, or use another provider.

## A step says an earlier step changed

A step warns that an earlier step changed. You edited or redid an earlier step after this one was done, so this step was built on old input. Use **Redo** on it if the change matters.

## An agent step is waiting

An agent step stays queued. Only one step runs at a time across the whole app; others wait in a queue. Job logs are in `data/jobs/`.

## Sample runs didn't load

Sample runs do not appear. The home page's **Load sample runs** button and `npm run seed` both skip samples that are already loaded or whose hashes don't match, and say why.

## Still stuck?

Check the output in your terminal, or run `docker compose logs -f`. Open an issue at https://github.com/alexbakertech/workflow-runner/issues with the error text, how you run the app (Docker or Node), and your operating system.
