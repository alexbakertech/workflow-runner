import fs from "node:fs";
import path from "node:path";
import { slugify, validateTemplate } from "../src/lib/workflow.ts";
import { bundleFiles } from "../src/lib/bundle.ts";
import type { WorkflowTemplate } from "../src/lib/types.ts";

// ---------- Index page (bundles/README.md) ----------

interface IndexRow {
  id: string;
  title: string;
  description: string;
  ai: number;
  reviews: number;
}

const cell = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");

function indexRow(t: WorkflowTemplate): IndexRow {
  const text = (t.description ?? "").replace(/\s+/g, " ").trim();
  return {
    id: t.id,
    title: t.title,
    description: text.split(/(?<=[.!?])\s+/)[0] ?? "",
    ai: t.steps.filter((s) => s.kind === "ai").length,
    reviews: t.steps.filter((s) => s.kind !== "ai").length,
  };
}

function indexPage(rows: IndexRow[]): string {
  const table = rows.map((r) => {
    const folder = slugify(r.id);
    const steps = `${r.ai} AI ${r.ai === 1 ? "step" : "steps"}, ${r.reviews} ${r.reviews === 1 ? "review" : "reviews"}`;
    return `| [${cell(r.title)}](${folder}/README.md) | ${cell(r.description)} | ${steps} | [${folder}.md](${folder}.md) |`;
  });
  return [
    "# Prompt bundles",
    "A prompt bundle is a set of Markdown files that lets you follow a Workflow Runner workflow by hand, in any AI chat app, without installing anything. It is for people who want to go through the steps themselves. The rule is **one fresh chat per step**: never continue an earlier conversation, because keeping steps apart is what makes the workflow work.",
    `| Workflow | What it's for | Steps | Single file |\n|---|---|---|---|\n${table.join("\n")}`,
    "These bundles are generated from `templates/` with `npm run bundles`. To change one, edit its workflow and regenerate rather than editing these files.",
  ].join("\n\n") + "\n";
}

// ---------- CLI ----------

function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const [input, outArg] = process.argv.slice(2);
  const outDir = path.resolve(outArg ?? path.join(repoRoot, "bundles"));
  const files = input
    ? [path.resolve(input)]
    : fs
        .readdirSync(path.join(repoRoot, "templates"))
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => path.join(repoRoot, "templates", f));
  let failed = false;
  const rows: IndexRow[] = [];
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error(`${file}: ${(e as Error).message}`);
      failed = true;
      continue;
    }
    const { template, errors } = validateTemplate(raw);
    if (!template) {
      console.error(`${file} is not a valid workflow:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
      failed = true;
      continue;
    }
    const files = bundleFiles(template);
    fs.rmSync(path.join(outDir, slugify(template.id)), { recursive: true, force: true });
    for (const file of files) {
      const target = path.join(outDir, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
    }
    rows.push(indexRow(template));
    const written = files;
    console.log(`${path.relative(process.cwd(), file)} -> ${written.length} files in ${path.relative(process.cwd(), outDir) || "."}`);
  }
  if (failed) process.exit(1);
  if (!input) {
    // All workflows: also write the index. Sorted by workflow id so the output doesn't depend on file order.
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "README.md"), indexPage(rows));
    console.log(`index -> ${path.relative(process.cwd(), path.join(outDir, "README.md")) || "README.md"}`);
  }
}

main();
