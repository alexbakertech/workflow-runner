# Sample runs

Finished example runs live in `runs/`. They are imported with their hashes checked.
To add one, drop a finished `.run.json` exported using **Download run JSON** into that folder.

The three adversarial-research samples were researched by Codex (`gpt-6.1-terra`) through the app's own
agent API, with a person's answers at the review step. `scripts/make-sample-run.mjs` is the helper that
drove them; see its header for usage. Run it only against a scratch `DATA_DIR`.
