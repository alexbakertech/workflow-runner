// Pure workflow helpers — safe to use on both client and server.
import type {
  FieldValue,
  HumanField,
  QuestionsValue,
  RunStep,
  Signal,
  TemplateStep,
  WorkflowRun,
  WorkflowTemplate,
} from "./types";

// ---------- Templating ----------

/** Minimal mustache: {{var}}, {{#var}}shown if set{{/var}}, {{^var}}shown if empty{{/var}}. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  const has = (k: string) => Boolean(vars[k] && vars[k].trim());
  return tpl
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, inner) => (has(k) ? inner : ""))
    .replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, inner) => (has(k) ? "" : inner))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? "").trim());
}

/** Variables available to prompts: the run's answers plus round information for looped runs. */
export function promptVars(run: WorkflowRun): Record<string, string> {
  const round = run.round ?? 1;
  return {
    ...run.variables,
    round: String(round),
    prevRound: round > 1 ? String(round - 1) : "",
    // Truthy only for a step that actually receives carried files, via resolvedPrompt.
    priorRound: "",
  };
}

export function resolvedPrompt(run: WorkflowRun, step: TemplateStep): string {
  const rs = run.steps.find((s) => s.id === step.id);
  if (rs?.promptOverride != null) return rs.promptOverride;
  const vars = promptVars(run);
  if (run.carryOver?.into.includes(step.id) && run.carryOver.files.length) vars.priorRound = "yes";
  if (followUpFiles(run, step.id).length) vars.followUp = "yes";
  return renderTemplate(step.prompt ?? "", vars);
}

/** File name a carried output gets in the next round, so it can't be mistaken for this round's file. */
export const carriedName = (round: number, file: string) => `round-${round}_${file}`;

// ---------- Validation ----------

export function validateTemplate(raw: unknown): { template?: WorkflowTemplate; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { errors: ["File is not a JSON object."] };
  const t = structuredClone(raw) as WorkflowTemplate;
  if (t.format !== "workflow-template") errors.push('Missing "format": "workflow-template".');
  if (!t.id || typeof t.id !== "string") errors.push('Missing workflow "id".');
  if (!t.title) errors.push('Missing workflow "title".');
  if (!t.version) t.version = "1";
  t.formatVersion = 1;
  if (!Array.isArray(t.variables)) t.variables = [];
  if (!Array.isArray(t.steps) || t.steps.length === 0) {
    errors.push("The workflow needs at least one step.");
    return { errors };
  }

  const seen = new Map<string, number>();
  const byFile = new Map<string, string>();
  t.steps.forEach((s, i) => {
    const where = `Step ${i + 1}${s?.label ? ` (${s.label})` : ""}`;
    if (!s.id) errors.push(`${where}: missing "id".`);
    if (seen.has(s.id)) errors.push(`${where}: duplicate id "${s.id}".`);
    if (!s.label) errors.push(`${where}: missing "label".`);
    if (s.kind !== "ai" && s.kind !== "human") errors.push(`${where}: "kind" must be "ai" or "human".`);
    if (!s.output?.file) errors.push(`${where}: missing "output.file".`);
    if (s.kind === "ai" && !s.prompt) errors.push(`${where}: AI steps need a "prompt".`);
    if (s.kind === "human" && !s.fields?.length) errors.push(`${where}: human steps need "fields".`);

    // Inputs may reference a step id or an earlier output file name.
    const resolve = (ref: string) => {
      const id = seen.has(ref) ? ref : byFile.get(ref);
      if (!id) errors.push(`${where}: input "${ref}" must be an earlier step id or output file.`);
      return id ?? ref;
    };
    s.inputs = (s.inputs ?? []).map(resolve);
    s.optionalInputs = s.optionalInputs?.length ? s.optionalInputs.map(resolve) : undefined;
    for (const f of s.fields ?? []) {
      if (f.type === "questions" && !seen.has(f.fromStep) && !byFile.has(f.fromStep))
        errors.push(`${where}: field "${f.key}" reads questions from unknown step "${f.fromStep}".`);
      if (f.type === "questions" && byFile.has(f.fromStep)) f.fromStep = byFile.get(f.fromStep)!;
      if (f.type === "text" && f.questionsFrom) {
        if (byFile.has(f.questionsFrom)) f.questionsFrom = byFile.get(f.questionsFrom)!;
        else if (!seen.has(f.questionsFrom)) errors.push(`${where}: field "${f.key}" reads questions from unknown step "${f.questionsFrom}".`);
      }
      if (f.type === "decision")
        for (const o of f.options)
          if (!["continue", "pause", "stop", "loop"].includes(o.effect))
            errors.push(`${where}: option "${o.value}" has an unknown effect "${o.effect}".`);
    }
    for (const sig of s.signals ?? []) {
      if (!sig.fix) continue;
      if (byFile.has(sig.fix.step)) sig.fix.step = byFile.get(sig.fix.step)!;
      else if (!seen.has(sig.fix.step)) errors.push(`${where}: signal "${sig.key}" fixes unknown step "${sig.fix.step}"; it must be an earlier step.`);
    }
    seen.set(s.id, i);
    if (s.output?.file) byFile.set(s.output.file, s.id);
  });

  return errors.length ? { errors } : { template: canonicalTemplate(t), errors };
}

/** Rebuild an object with keys in a fixed order, dropping undefined; unknown keys go last. */
function ordered<T extends object>(obj: T, keys: string[]): T {
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of [...keys, ...Object.keys(src).filter((k) => !keys.includes(k))])
    if (src[k] !== undefined) out[k] = src[k];
  return out as T;
}

const TEMPLATE_KEYS = ["format", "formatVersion", "id", "title", "version", "description", "intro", "titleVariable", "variables", "steps"];
const STEP_KEYS = ["id", "label", "kind", "description", "inputs", "optionalInputs", "prompt", "output", "wordLimit", "feature", "checklist", "signals", "fields", "outputTemplate"];

/** Same content, predictable layout, so downloaded workflow files read consistently. */
export function canonicalTemplate(t: WorkflowTemplate): WorkflowTemplate {
  return ordered({ ...t, steps: t.steps.map((s) => ordered(s, STEP_KEYS)) }, TEMPLATE_KEYS);
}

/** "07_decision_brief.md" → "Decision brief" */
export function humanizeFile(file: string): string {
  const base = file.replace(/\.[a-z0-9]+$/i, "").replace(/^\d+[_\-\s]*/, "").replace(/[_\-]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : file;
}

export function outputTitle(step: TemplateStep): string {
  return step.output.title ?? humanizeFile(step.output.file);
}

export function workflowFileName(t: WorkflowTemplate): string {
  const id = slugify(t.id);
  const v = t.version.replace(/^v/i, "");
  return `${id.endsWith(`v${v}`) ? id : `${id}-v${v}`}.workflow.json`;
}

export function templateTag(t: WorkflowTemplate, hash: string): string {
  return `${t.id}@${t.version}#${hash.replace(/^sha256:/, "").slice(0, 8)}`;
}

// ---------- Run construction ----------

export function emptyRunSteps(t: WorkflowTemplate): RunStep[] {
  return t.steps.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    outputFile: s.output.file,
    status: "pending",
    response: "",
  }));
}

export function computeProgress(run: WorkflowRun) {
  return {
    completed: run.steps.filter((s) => s.status === "done").length,
    total: run.steps.length,
  };
}

/** First step that is not yet done (or the last index if all are). */
export function frontier(run: WorkflowRun): number {
  const i = run.steps.findIndex((s) => s.status === "pending");
  return i === -1 ? run.steps.length - 1 : i;
}

// ---------- Context ----------

export interface ContextFile {
  stepId: string;
  name: string;
  content: string;
  optional: boolean;
}

export function contextFiles(run: WorkflowRun, step: TemplateStep, includeOptional?: string[]): ContextFile[] {
  const included = includeOptional ?? run.steps.find((s) => s.id === step.id)?.includedOptional ?? [];
  const ids = [
    ...(step.inputs ?? []).map((id) => ({ id, optional: false })),
    ...(step.optionalInputs ?? []).filter((id) => included.includes(id)).map((id) => ({ id, optional: true })),
  ];
  const own = ids.map(({ id, optional }) => {
    const rs = run.steps.find((s) => s.id === id);
    return { stepId: id, name: rs?.outputFile ?? id, content: rs?.response ?? "", optional };
  });
  const carried = run.carryOver?.into.includes(step.id)
    ? run.carryOver.files.map((f) => ({ stepId: `carry:${f.fromStepId}`, name: f.name, content: f.content, optional: false }))
    : [];
  return [...carried, ...own, ...followUpFiles(run, step.id)];
}

export function buildContext(files: ContextFile[]): string {
  if (!files.length) return "";
  const body = files
    .map((f) => `--- BEGIN FILE: ${f.name} ---\n${f.content.trim()}\n--- END FILE: ${f.name} ---`)
    .join("\n\n");
  return `The following ${files.length === 1 ? "file is" : `${files.length} files are`} the input for this session:\n\n${body}\n`;
}

/** Fast non-cryptographic fingerprint (FNV-1a) used for stale-step detection. */
export function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stepDigest(run: WorkflowRun, step: TemplateStep): string {
  const files = contextFiles(run, step);
  const prompt = step.kind === "ai" ? resolvedPrompt(run, step) : "";
  return digest(buildContext(files) + "\n\u0000\n" + prompt);
}

// ---------- Response analysis ----------

export function wordCount(text: string): number {
  const t = text.replace(/[#*_>`|\-]+/g, " ").trim();
  return t ? t.split(/\s+/).length : 0;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds e.g. "## Gate result: **Revise**". Headings win over body text. */
export function detectSignal(text: string, sig: Signal): string | null {
  const opts = [...sig.options].sort((a, b) => b.length - a.length).map(esc).join("|");
  const prefix = sig.match ? `(?:${sig.match})[^\\n]{0,40}?` : "";
  const re = new RegExp(`${prefix}[:\\-—–]\\s*[*_\`]*\\s*(${opts})\\b`, "i");
  let fallback: string | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(re);
    if (!m) continue;
    const value = sig.options.find((o) => o.toLowerCase() === m[1].toLowerCase()) ?? m[1];
    if (/^\s*#/.test(line)) return value;
    fallback ??= value;
  }
  return fallback;
}

export function detectSignals(text: string, signals: Signal[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of signals) {
    const v = detectSignal(text, s);
    if (v) out[s.key] = v;
  }
  return out;
}

const stripMd = (s: string) => s.replace(/\*\*|__|`/g, "").trim();

/** Pull the numbered questions out of the last "questions" section of a markdown report. */
export function extractQuestions(md: string, max = 3): string[] {
  const lines = md.split("\n");
  const sections: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    // Headings, including a bold line standing in for one ("**Prioritized Questions**").
    if (/^\s{0,3}#{1,6}\s/.test(line) || /^\s{0,3}(\*\*|__)[^*_]+\1:?\s*$/.test(line)) {
      current = /question/i.test(line) ? [] : null;
      if (current) sections.push(current);
      continue;
    }
    if (!current) continue;
    const m = line.match(/^\s{0,1}(?:\d+[.)]|[-*+])\s+(.+)/);
    if (m) current.push(stripMd(m[1]));
    else if (current.length && /^\s{2,}\S/.test(line) && !/^\s*(?:\d+[.)]|[-*+])\s/.test(line))
      current[current.length - 1] += " " + stripMd(line);
  }
  const best = [...sections].reverse().find((s) => s.length);
  if (best) return best.slice(0, max);
  // Fallback: list items that end with a question mark.
  return lines
    .map((l) => l.match(/^\s*(?:\d+[.)]|[-*+])\s+(.+\?)\s*$/)?.[1])
    .filter((x): x is string => Boolean(x))
    .map(stripMd)
    .slice(-max);
}

// ---------- Human steps ----------

export function isQuestionsValue(v: FieldValue | undefined): v is QuestionsValue {
  return Boolean(v && typeof v === "object" && Array.isArray((v as QuestionsValue).answers));
}

/** Questions a step's output asks the user, shown beside free-text answers. */
export function questionsRaised(run: WorkflowRun, stepId: string): string[] {
  return extractQuestions(run.steps.find((s) => s.id === stepId)?.response ?? "", 5);
}

function formatField(field: HumanField, value: FieldValue | undefined, run: WorkflowRun): string {
  if (field.type === "questions") {
    const q = isQuestionsValue(value) ? value : { questions: [], answers: [] };
    const n = Math.max(q.questions.length, field.count ?? 0, 1);
    return Array.from({ length: n }, (_, i) => {
      const question = q.questions[i]?.trim();
      const answer = q.answers[i]?.trim() || "Unknown";
      return question ? `- Q${i + 1}: ${question}\n  - **Answer:** ${answer}` : `- Q${i + 1}: ${answer}`;
    }).join("\n");
  }
  if (field.type === "text" && field.questionsFrom) {
    // Free-text answers keep the questions they respond to, so later sessions can read them in context.
    const questions = questionsRaised(run, field.questionsFrom);
    const answer = String(value ?? "").trim() || "No answer given.";
    const asked = questions.length ? `Questions raised:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n` : "";
    return `${asked}Answer:\n\n${answer}`;
  }
  if (field.type === "text") {
    const lines = String(value ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.length ? lines.map((l) => (/^[-*]\s/.test(l) ? l : `- ${l}`)).join("\n") : "- None";
  }
  return field.options.map((o) => `- [${o.value === value ? "x" : " "}] ${o.label}`).join("\n");
}

export function renderHumanOutput(step: TemplateStep, run: WorkflowRun, values: Record<string, FieldValue>): string {
  const vars: Record<string, string> = { ...run.variables };
  for (const f of step.fields ?? []) vars[f.key] = formatField(f, values[f.key], run);
  if (step.outputTemplate) return renderTemplate(step.outputTemplate, vars).trim() + "\n";
  return (
    [`# ${step.label}`, ...(step.fields ?? []).map((f) => `## ${f.label}\n${vars[f.key]}`)].join("\n\n") + "\n"
  );
}

export function decisionEffect(step: TemplateStep, values: Record<string, FieldValue>) {
  const f = step.fields?.find((x) => x.type === "decision");
  if (!f || f.type !== "decision") return { field: null, option: null, effect: "continue" as const };
  const option = f.options.find((o) => o.value === values[f.key]) ?? null;
  return { field: f, option, effect: option?.effect ?? null };
}

// ---------- Misc ----------

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "run"
  );
}

export function suggestTitle(t: WorkflowTemplate, vars: Record<string, string>): string {
  const v = (t.titleVariable && vars[t.titleVariable]) || "";
  const clean = v.trim().replace(/\s+/g, " ");
  return clean.length > 70 ? clean.slice(0, 67).trimEnd() + "…" : clean;
}

/** Marks an AI step done, recording the prompt and inputs exactly as used. */
export function completeAiStep(run: WorkflowRun, index: number, now = new Date().toISOString()): WorkflowRun {
  const step = run.template.definition.steps[index];
  return {
    ...run,
    steps: run.steps.map((s, i) =>
      i === index
        ? {
            ...s,
            status: "done",
            prompt: resolvedPrompt(run, step),
            inputFiles: contextFiles(run, step).map((f) => f.name),
            inputsDigest: stepDigest(run, step),
            wordCount: wordCount(s.response),
            savedAt: now,
          }
        : s,
    ),
  };
}

/** The run as it was when an earlier round ended, for read-only display. Null for the current or an unknown round. */
export function roundView(run: WorkflowRun, round: number): WorkflowRun | null {
  const past = run.rounds?.find((r) => r.round === round);
  if (!past) return null;
  const view: WorkflowRun = {
    ...run,
    status: "stopped",
    round: past.round,
    roundStartedAt: past.startedAt,
    completedAt: past.endedAt,
    carryOver: past.carryOver,
    followUps: past.followUps,
    rounds: run.rounds!.filter((r) => r.round < round),
    steps: past.steps,
  };
  return { ...view, progress: computeProgress(view) };
}

// ---------- Further research ----------

/** The step's verdict, if it recommends more research (e.g. "Suggested next action: Investigate further"). */
export function followUpVerdict(run: WorkflowRun, stepIndex: number): { signal: Signal; value: string } | null {
  const step = run.template.definition.steps[stepIndex];
  const rs = run.steps[stepIndex];
  if (!step || step.kind !== "ai" || rs?.status !== "done" || !rs.response.trim()) return null;
  const detected = detectSignals(rs.response, step.signals);
  for (const signal of step.signals ?? []) {
    const value = detected[signal.key] ?? rs.signals?.[signal.key];
    if (value && signal.followUp?.includes(value)) return { signal, value };
  }
  return null;
}

/** The last step in the round whose verdict recommends more research. */
export function latestFollowUpStep(run: WorkflowRun): number {
  for (let i = run.steps.length - 1; i >= 0; i--) if (followUpVerdict(run, i)) return i;
  return -1;
}

/** Questions plus the user's answers, as a file for the next session. */
export function followUpAnswersMd(questions: string[], answers: string): string {
  const q = questions.length ? `## Open questions\n\n${questions.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n` : "";
  return `# Follow-up: your answers\n\n${q}## Answers and new facts from the user\n\n${answers.trim() || "None given."}\n`;
}

/** Every answer the user gave in this round's follow-ups on a step (plus `extra`), as one file. */
export function combinedAnswersMd(run: WorkflowRun, stepId: string, extra?: { questions: string[]; answers: string }): string | null {
  const parts = (run.followUps ?? [])
    .filter((f) => f.stepId === stepId && f.status === "done" && f.answers.trim())
    .map((f) => ({ questions: f.questions, answers: f.answers }));
  if (extra?.answers.trim()) parts.push(extra);
  if (!parts.length) return null;
  return (
    "# Follow-up: your answers\n\n" +
    parts
      .map(
        (p, i) =>
          `## ${parts.length > 1 ? `Update ${i + 1}: ` : ""}open questions\n\n${p.questions.map((x, j) => `${j + 1}. ${x}`).join("\n") || "(none listed)"}\n\n` +
          `### Answers and new facts from the user\n\n${p.answers.trim()}\n`,
      )
      .join("\n")
  );
}

/**
 * What a step gets from this round's follow-ups when it runs again. Kept to three files however many follow-ups
 * there were: its latest earlier version, all the user's answers in one file, and the research findings.
 */
export function followUpFiles(run: WorkflowRun, stepId: string): ContextFile[] {
  const done = (run.followUps ?? []).filter((f) => f.stepId === stepId && f.status === "done");
  if (!done.length) return [];
  const out = run.steps.find((s) => s.id === stepId)?.outputFile ?? `${stepId}.md`;
  const latest = done[done.length - 1];
  const answers = combinedAnswersMd(run, stepId);
  const research = done.find((f) => f.research?.trim())?.research;
  return [
    { stepId: "followup:previous", name: `follow-up_previous_${out}`, content: latest.previous, optional: false },
    ...(answers ? [{ stepId: "followup:answers", name: "follow-up_answers.md", content: answers, optional: false }] : []),
    ...(research ? [{ stepId: "followup:research", name: "follow-up_research.md", content: research, optional: false }] : []),
  ];
}

/** Follow-ups a step may have per round: one research session and one update with the user's answers. */
export function followUpsUsed(run: WorkflowRun, stepId: string): { research: boolean; answers: boolean } {
  const live = (run.followUps ?? []).filter((f) => f.stepId === stepId && f.status !== "failed");
  return { research: live.some((f) => (f.kind ?? "research") === "research"), answers: live.some((f) => f.kind === "answers") };
}
