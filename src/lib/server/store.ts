import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { RunListItem, TemplateEntry, WorkflowRun, WorkflowTemplate } from "../types";
import { computeProgress, templateTag, validateTemplate } from "../workflow";
import { hashTemplate, sealRun } from "./hash";

const ROOT = process.cwd();
const BUILTIN_DIR = path.join(ROOT, "templates");
// DATA_DIR lets a second instance (e.g. a dev server next to the container) use its own folder.
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
const TEMPLATE_DIR = path.join(DATA_DIR, "templates");
const RUN_DIR = path.join(DATA_DIR, "runs");

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/i;

async function readJsonDir<T>(dir: string): Promise<{ file: string; data: T }[]> {
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const out: { file: string; data: T }[] = [];
  for (const file of names) {
    try {
      out.push({ file, data: JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as T });
    } catch {
      // Skip unreadable files rather than breaking the whole list.
    }
  }
  return out;
}

// ---------- Templates ----------

function entry(template: WorkflowTemplate, sourceFile: string, builtIn: boolean): TemplateEntry {
  const hash = hashTemplate(template);
  return { template, hash, tag: templateTag(template, hash), sourceFile, builtIn };
}

export async function listTemplates(): Promise<TemplateEntry[]> {
  const builtIns = (await readJsonDir<{ template: WorkflowTemplate; sourceFile: string }>(BUILTIN_DIR)).map(
    ({ file, data }) => ({ file, data: { template: data as unknown as WorkflowTemplate, sourceFile: file } }),
  );
  const uploaded = await readJsonDir<{ template: WorkflowTemplate; sourceFile: string }>(TEMPLATE_DIR);
  const seen = new Set<string>();
  const out: TemplateEntry[] = [];
  for (const [list, builtIn] of [
    [builtIns, true],
    [uploaded, false],
  ] as const) {
    for (const { data } of list) {
      const { template } = validateTemplate(data.template);
      if (!template) continue;
      const e = entry(template, data.sourceFile, builtIn);
      if (seen.has(e.hash)) continue;
      seen.add(e.hash);
      out.push(e);
    }
  }
  return out;
}

export async function getTemplate(hash: string): Promise<TemplateEntry | null> {
  return (await listTemplates()).find((t) => t.hash === hash) ?? null;
}

export async function saveTemplate(template: WorkflowTemplate, sourceFile: string): Promise<TemplateEntry> {
  const e = entry(template, sourceFile, false);
  const existing = (await listTemplates()).find((t) => t.hash === e.hash);
  if (existing) return existing;
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
  const file = `${template.id.replace(/[^a-z0-9-]/gi, "-")}-${e.hash.slice(7, 15)}.json`;
  await fs.writeFile(path.join(TEMPLATE_DIR, file), JSON.stringify({ sourceFile, template }, null, 2));
  return e;
}

/** Removes an uploaded workflow. Built-in workflows and existing runs are untouched. */
export async function deleteTemplate(hash: string): Promise<boolean> {
  for (const { file, data } of await readJsonDir<{ template: WorkflowTemplate }>(TEMPLATE_DIR)) {
    const { template } = validateTemplate(data.template);
    if (template && hashTemplate(template) === hash) {
      await fs.rm(path.join(TEMPLATE_DIR, file), { force: true });
      return true;
    }
  }
  return false;
}

// ---------- Runs ----------

export function newRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listRuns(): Promise<RunListItem[]> {
  const runs = await readJsonDir<WorkflowRun>(RUN_DIR);
  return runs
    .map(({ data: r }) => ({
      id: r.id,
      title: r.title,
      tag: r.tag,
      status: r.status,
      updatedAt: r.updatedAt,
      templateTitle: r.template?.title ?? "",
      templateHash: r.template?.hash ?? "",
      inputsText: Object.values(r.variables ?? {}).join("\n"),
      round: r.round,
      progress: r.progress,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getRun(id: string): Promise<WorkflowRun | null> {
  if (!SAFE_ID.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(RUN_DIR, `${id}.json`), "utf8")) as WorkflowRun;
  } catch {
    return null;
  }
}

/** Writes the run as-is (used for imports, keeping the original integrity block). */
export async function writeRunRaw(run: WorkflowRun): Promise<void> {
  if (!SAFE_ID.test(run.id)) throw new Error("Invalid run id");
  await fs.mkdir(RUN_DIR, { recursive: true });
  const target = path.join(RUN_DIR, `${run.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(run, null, 2));
  await fs.rename(tmp, target);
}

// Run files are written by the browser's autosave and by agent jobs; serialize read-modify-write per run.
const runLocks = new Map<string, Promise<unknown>>();

/** Reads the run, applies fn and saves the result, one update per run at a time. Returns null if not found. */
export function updateRun(id: string, fn: (run: WorkflowRun) => WorkflowRun | Promise<WorkflowRun>): Promise<WorkflowRun | null> {
  const prev = runLocks.get(id) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      const current = await getRun(id);
      if (!current) return null;
      const updated = await fn(current);
      return saveRun({ ...updated, progress: computeProgress(updated) });
    });
  runLocks.set(id, next);
  void next.finally(() => runLocks.get(id) === next && runLocks.delete(id));
  return next;
}

export async function saveRun(run: WorkflowRun): Promise<WorkflowRun> {
  const sealed = sealRun({ ...run, updatedAt: new Date().toISOString() });
  await writeRunRaw(sealed);
  return sealed;
}

export async function deleteRun(id: string): Promise<void> {
  if (!SAFE_ID.test(id)) return;
  await fs.rm(path.join(RUN_DIR, `${id}.json`), { force: true });
}
