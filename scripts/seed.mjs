import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = path.join(process.cwd(), "samples", "runs");
const target = path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data"), "runs");
function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}
const hash = (value) => "sha256:" + createHash("sha256").update(stable(value)).digest("hex");
for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith(".run.json")).sort()) {
  try {
    const run = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
    if (run?.format !== "workflow-run" || typeof run.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(run.id) || typeof run.title !== "string" || !run.template?.definition || !Array.isArray(run.steps)) throw new Error("Invalid run file");
    const dest = path.join(target, `${run.id}.json`);
    try { await fs.access(dest); console.log(`${file}: already there`); continue; } catch (error) { if (error.code !== "ENOENT") throw error; }
    const { integrity, importVerification, ...content } = run;
    if (hash(run.template.definition) !== run.template.hash || !integrity || hash(content) !== integrity.contentHash) throw new Error("Hash verification failed");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(dest, JSON.stringify({ ...run, importVerification: { templateHashOk: true, contentHashOk: true, importedAt: new Date().toISOString(), sourceFile: file } }, null, 2), { flag: "wx" });
    console.log(`${file}: loaded`);
  } catch (error) { console.log(`${file}: skipped (${error.message})`); }
}
