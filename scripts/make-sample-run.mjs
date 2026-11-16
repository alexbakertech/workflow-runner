#!/usr/bin/env node
// Drives a running Workflow Runner (scratch data dir!) over its HTTP API to make a sample run,
// the same way the UI does. Usage:
//   BASE=http://localhost:3940 node scripts/make-sample-run.mjs <command> ...
//   start  <title> <question> <scope> <model>   create run, fill setup, start Codex chain; prints run id
//   status <id>                                  step statuses + latest job
//   show   <id> <stepIndex>                      print a step's response
//   review <id> <answers.json>                   save the human review ({bq,cq,ctx}), choose "proceed"
//   final  <id> <model>                          start the last AI step with Codex
//   fix    <id> <verifierIndex> <model>          start a fix job
//   next   <id> <stepIndex> <model>              start a normal job (autoAdvance) at a step
//   finish <id>                                  mark completed, as the UI does after the last step
//   save   <id> <file>                           write the run (pretty) after checking hashes
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3940";
const api = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
};
const getRun = async (id) => (await api("GET", `/api/runs/${id}`)).run;
const putRun = (run) => api("PUT", `/api/runs/${run.id}`, { run });

// Same extraction the UI uses (src/lib/workflow.ts extractQuestions), for the "Questions raised" block.
const stripMd = (s) => s.replace(/\*\*|__|`/g, "").trim();
function extractQuestions(md, max = 5) {
  const lines = md.split("\n"); const sections = []; let cur = null;
  for (const line of lines) {
    if (/^\s{0,3}#{1,6}\s/.test(line) || /^\s{0,3}(\*\*|__)[^*_]+\1:?\s*$/.test(line)) { cur = /question/i.test(line) ? [] : null; if (cur) sections.push(cur); continue; }
    if (!cur) continue;
    const m = line.match(/^\s{0,1}(?:\d+[.)]|[-*+])\s+(.+)/);
    if (m) cur.push(stripMd(m[1]));
    else if (cur.length && /^\s{2,}\S/.test(line) && !/^\s*(?:\d+[.)]|[-*+])\s/.test(line)) cur[cur.length - 1] += " " + stripMd(line);
  }
  const best = [...sections].reverse().find((s) => s.length);
  if (best) return best.slice(0, max);
  return lines.map((l) => l.match(/^\s*(?:\d+[.)]|[-*+])\s+(.+\?)\s*$/)?.[1]).filter(Boolean).map(stripMd).slice(-max);
}
const renderTemplate = (tpl, vars) => {
  const has = (k) => Boolean(vars[k] && vars[k].trim());
  return tpl.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, i) => (has(k) ? i : ""))
    .replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, i) => (has(k) ? "" : i))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? "").trim());
};
function renderHuman(step, run, values) {
  const vars = { ...run.variables };
  for (const f of step.fields) {
    const v = values[f.key];
    if (f.type === "text" && f.questionsFrom) {
      const qs = extractQuestions(run.steps.find((s) => s.id === f.questionsFrom)?.response ?? "", 5);
      const answer = String(v ?? "").trim() || "No answer given.";
      vars[f.key] = `${qs.length ? `Questions raised:\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n` : ""}Answer:\n\n${answer}`;
    } else if (f.type === "text") {
      const lines = String(v ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      vars[f.key] = lines.length ? lines.map((l) => (/^[-*]\s/.test(l) ? l : `- ${l}`)).join("\n") : "- None";
    } else vars[f.key] = f.options.map((o) => `- [${o.value === v ? "x" : " "}] ${o.label}`).join("\n");
  }
  return renderTemplate(step.outputTemplate, vars).trim() + "\n";
}

function digest(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === "start") {
  const [title, question, scope, model] = a;
  const { templates } = await api("GET", "/api/templates");
  const t = templates.find((x) => x.template.id === "adversarial-research");
  const { id } = await api("POST", "/api/runs", { templateHash: t.hash });
  const run = await getRun(id);
  // What the SetupScreen + "start" button do: variables, title, status in_progress, position 0.
  await putRun({ ...run, variables: { question, scope }, title, status: "in_progress", position: 0 });
  const { job } = await api("POST", `/api/runs/${id}/agent`, { stepIndex: 0, provider: "codex", model, autoAdvance: true });
  console.log(id, job.id);
} else if (cmd === "status") {
  const run = await getRun(a[0]);
  console.log(run.status, "position", run.position, run.steps.map((s) => `${s.id}:${s.status}${s.signals ? JSON.stringify(s.signals) : ""}`).join(" "));
  const { jobs } = await api("GET", `/api/runs/${a[0]}/agent`);
  for (const j of jobs.slice(0, 3)) console.log(" job", j.id, "step", j.stepIndex, j.status, j.fix ? "fix" : "", j.stoppedBecause ?? "", j.error ?? "", j.startedAt, j.endedAt ?? "");
} else if (cmd === "show") {
  console.log((await getRun(a[0])).steps[Number(a[1])].response);
} else if (cmd === "review") {
  const run = await getRun(a[0]);
  const answers = JSON.parse(fs.readFileSync(a[1], "utf8"));
  const idx = run.steps.findIndex((s) => s.kind === "human");
  const step = run.template.definition.steps[idx];
  const fields = { bq: answers.bq, cq: answers.cq, ctx: answers.ctx ?? "", auth: "proceed" };
  const now = new Date().toISOString();
  // Same as HumanStep: free-text answers only (no "questions" fields in this workflow), then render the output.
  const rendered = renderHuman(step, run, fields);
  const files = (step.inputs ?? []).map((sid) => run.steps.find((s) => s.id === sid)).map((rs) => ({ name: rs.outputFile, content: rs.response }));
  const ctx = files.length
    ? `The following ${files.length === 1 ? "file is" : `${files.length} files are`} the input for this session:\n\n` +
      files.map((f) => `--- BEGIN FILE: ${f.name} ---\n${f.content.trim()}\n--- END FILE: ${f.name} ---`).join("\n\n") + "\n"
    : "";
  const steps = run.steps.map((s, i) =>
    i === idx ? { ...s, fields, response: rendered, responseSource: "form", inputFiles: files.map((f) => f.name), inputsDigest: digest(ctx + "\n\u0000\n"), savedAt: now, status: "done" } : s.status === "skipped" ? { ...s, status: "pending" } : s,
  );
  // "continue" effect, not last step: status in_progress, completedAt null, position view + 1.
  await putRun({ ...run, steps, status: "in_progress", completedAt: null, position: idx + 1 });
  console.log("review saved at step", idx);
} else if (cmd === "final" || cmd === "next") {
  const [id, i, model] = cmd === "final" ? [a[0], null, a[1]] : [a[0], Number(a[1]), a[2]];
  const run = await getRun(id);
  const stepIndex = i ?? run.steps.length - 1;
  const { job } = await api("POST", `/api/runs/${id}/agent`, { stepIndex, provider: "codex", model, autoAdvance: cmd === "next" });
  console.log(job.id);
} else if (cmd === "fix") {
  const { job } = await api("POST", `/api/runs/${a[0]}/agent`, { fixFrom: Number(a[1]), provider: "codex", model: a[2], autoAdvance: true });
  console.log(job.id);
} else if (cmd === "finish") {
  // The UI's "Finish & see summary" on the last AI step: completeAiStep, then status completed.
  const { completeAiStep } = await import("../src/lib/workflow.ts"); // Node strips the types
  const run = await getRun(a[0]);
  const last = run.steps.length - 1;
  const now = new Date().toISOString();
  const next = run.steps[last].status === "done" ? run : completeAiStep(run, last, now);
  await putRun({ ...next, status: "completed", completedAt: now });
} else if (cmd === "save") {
  const { run, verification } = await api("GET", `/api/runs/${a[0]}`);
  if (!verification.templateHashOk || !verification.contentHashOk) throw new Error("verification failed " + JSON.stringify(verification));
  fs.writeFileSync(a[1], JSON.stringify(run, null, 2) + "\n");
  console.log("saved", a[1], verification);
} else console.error("unknown command");
