# Security

## Who this is for

The app is built for one person on their own computer. There are no user accounts. Do not put it on the public internet.

## Network access

The Docker setup only listens on this computer (`127.0.0.1:3000`). If you open it to other devices on your network, turn on the access token (`ACCESS_TOKEN=` empty to use `data/access-token.txt`, or your own value). Each device signs in once and stays signed in for a year. A sign-in link with `?token=` signs a device in. **Settings → Access token** can make a new token, which signs every other device out. Anyone with the token can use the app.

## Your sign-ins and API keys

Agents run with your Claude, Codex or API-key sign-ins. Anyone who can use the app can spend your usage. API keys go in `.env`, which git ignores.

## What agents can do

Each agent step runs as a fresh session in an empty folder under `data/work/`, deleted afterwards.

- Claude: only web search and web fetch tools. No shell and no file tools. None of your Claude Code settings, hooks, plugins, MCP servers or CLAUDE.md files are loaded.
- Codex: runs `codex exec` with web search and a read-only sandbox, ignoring your Codex config and rules. Read-only means it can still run commands that read files, and it can read any file the app's user can read. In Docker that is the container, including the mounted `data/` folder. Without Docker (`npm run dev` or `npm start`) it is every file your own user account can read. It cannot change files. If that matters to you, use Docker or another provider.
- Local models (pi): pi's built-in file and shell tools are turned off, and no context files, skills or prompt templates are loaded. Extension tools you installed in pi (for example a web search extension) stay available.

## Web content and prompt injection

Agents read web pages, and a page can contain text that tries to steer the model. Agent output is only text that is shown to you; the app takes no other action based on it. Read outputs critically, especially sources.

## Your data

Runs, answers and settings are stored as plain JSON files in `data/`, unencrypted. Back it up and protect it like any other personal files.

## Reporting a problem

Please don't report security problems in a public issue. Use **Report a vulnerability** on the repository's [Security tab](https://github.com/alexbakertech/workflow-runner/security/advisories/new) instead, which only the maintainer can see.
