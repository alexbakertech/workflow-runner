import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { WorkflowRun } from "@/lib/types";
import { verifyRun } from "./hash";
import { getRun, writeRunRaw } from "./store";

const dir = path.join(process.cwd(), "samples", "runs");
async function files() {
  try { return (await fs.readdir(dir)).filter((f) => f.endsWith(".run.json")).sort(); }
  catch { return []; }
}
async function read(file: string): Promise<WorkflowRun> {
  const run = JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as WorkflowRun;
  if (run?.format !== "workflow-run" || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(run.id) || typeof run.title !== "string" || !run.template?.definition || !Array.isArray(run.steps)) throw new Error("Invalid run file");
  return run;
}
export async function listSamples() {
  const samples: { file: string; id: string; title: string; loaded: boolean }[] = [];
  for (const file of await files()) {
    try { const run = await read(file); samples.push({ file, id: run.id, title: run.title, loaded: !!(await getRun(run.id)) }); } catch { /* Invalid samples are reported on load. */ }
  }
  return samples;
}
export async function loadSamples() {
  const loaded: string[] = [];
  const skipped: { file: string; reason: string }[] = [];
  for (const file of await files()) {
    try {
      const run = await read(file);
      if (await getRun(run.id)) { skipped.push({ file, reason: "Already loaded" }); continue; }
      const verification = verifyRun(run);
      if (!verification.templateHashOk || verification.contentHashOk !== true) throw new Error("Hash verification failed");
      await writeRunRaw({ ...run, importVerification: { ...verification, importedAt: new Date().toISOString(), sourceFile: file } });
      loaded.push(run.id);
    } catch (error) { skipped.push({ file, reason: error instanceof Error ? error.message : "Invalid run file" }); }
  }
  return { loaded, skipped };
}
