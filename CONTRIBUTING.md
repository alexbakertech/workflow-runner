# Contributing

## Setup

You need Node.js 24 (`.nvmrc`). Run `npm ci`, then `npm run dev`. Use a scratch data folder so you don't touch your own runs:

```bash
DATA_DIR=../scratch npm run dev
```

Load the sample runs into it with `DATA_DIR=../scratch npm run seed`.

## Before you open a pull request

Run `npm run typecheck` and `npm run build`. CI also checks the workflow and run JSON files against the schemas in `docs/schemas/` and runs `docs/examples/parse_run.py`. There is no automated test suite: check changes by running real workflows against scratch data.

## Next.js version

The app uses Next.js 16, which differs from older versions. Read `AGENTS.md` and the docs in `node_modules/next/dist/docs/` before changing framework code.

## Code style

Match the surrounding code: TypeScript, 2-space indentation, double quotes, small focused changes. Plain words in UI text.

## Workflows and prompt bundles

Workflow files are documented in `docs/workflow-format.md`. If you change a workflow in `templates/`, bump its `version` and run `npm run bundles` to regenerate the prompt bundles in `bundles/`, and commit both.

## Where things are

See [docs/README.md](docs/README.md) for the file formats, and the code map in the [README](README.md).
