import "server-only";
import type { PastRound, TemplateEntry, WorkflowRun } from "../types";
import { carriedName, combinedAnswersMd, computeProgress, decisionEffect, emptyRunSteps, extractQuestions, followUpVerdict } from "../workflow";
import { getRun, newRunId, updateRun } from "./store";

export function createRun(entry: TemplateEntry, variables: Record<string, string> = {}, title = ""): WorkflowRun {
  const now = new Date().toISOString();
  const t = entry.template;
  const run: WorkflowRun = {
    format: "workflow-run",
    formatVersion: 1,
    id: newRunId(),
    title,
    tag: entry.tag,
    status: "setup",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    variables: Object.fromEntries(t.variables.map((v) => [v.key, variables[v.key] ?? ""])),
    template: {
      id: t.id,
      title: t.title,
      version: t.version,
      sourceFile: entry.sourceFile,
      hash: entry.hash,
      definition: t,
    },
    position: 0,
    progress: { completed: 0, total: t.steps.length },
    steps: emptyRunSteps(t),
  };
  run.progress = computeProgress(run);
  return run;
}

/**
 * Ends this round and starts the next one in the same run: same workflow and answers, back at the first step, with
 * this round's outputs carried in as extra input files. The finished round is archived as it was.
 *
 * Starts from a review whose decision is "loop", or from a step whose verdict recommends more research (then
 * `answers` holds what the user added to its open questions).
 */
export async function startNextRound(runId: string, stepIndex: number, answers = ""): Promise<WorkflowRun> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  const def = run.template.definition;
  const step = def.steps[stepIndex];
  const rs = run.steps[stepIndex];
  const { option } = step ? decisionEffect(step, rs?.fields ?? {}) : { option: null };
  const loop = option?.effect === "loop" ? option : null;
  const research = !loop && followUpVerdict(run, stepIndex);
  if (!step || (!loop && !research)) throw new Error("This step doesn’t lead to another round.");

  const round = run.round ?? 1;
  // Without a loop option to say otherwise, use what the workflow's own loop option carries into.
  const loopOption = def.steps.flatMap((s) => s.fields ?? []).flatMap((f) => (f.type === "decision" ? f.options : [])).find((o) => o.effect === "loop");
  const carryIds = loop?.carry ?? def.steps.slice(0, stepIndex + 1).map((s) => s.id);
  const into = (loop ?? loopOption)?.carryInto ?? [def.steps.find((s) => s.kind === "ai")?.id ?? def.steps[0].id];
  const files = carryIds
    .map((id) => run.steps.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s?.response.trim()))
    .map((s) => ({ name: carriedName(round, s.outputFile), content: s.response, fromStepId: s.id }));
  // This round's follow-up research, and all the user's answers to open questions in one file.
  const researched = (run.followUps ?? []).find((f) => f.status === "done" && f.research?.trim());
  if (researched?.research) files.push({ name: carriedName(round, "follow-up_research.md"), content: researched.research, fromStepId: "followup:research" });
  const stepIds = [...new Set([...(run.followUps ?? []).map((f) => f.stepId), ...(research ? [step.id] : [])])];
  const answered = stepIds
    .map((id) => combinedAnswersMd(run, id, id === step.id && research ? { questions: extractQuestions(rs.response, 5), answers } : undefined))
    .filter((x): x is string => Boolean(x));
  if (answered.length) files.push({ name: carriedName(round, "follow-up_answers.md"), content: answered.join("\n"), fromStepId: "followup:answers" });

  const now = new Date().toISOString();
  const saved = await updateRun(run.id, (r) => {
    if ((r.round ?? 1) !== round) throw new Error(`Round ${r.round} has already started.`);
    const ended: PastRound = {
      round,
      startedAt: r.roundStartedAt ?? r.createdAt,
      endedAt: now,
      ...(r.carryOver ? { carryOver: r.carryOver } : {}),
      ...(r.followUps?.length ? { followUps: r.followUps } : {}),
      steps: r.steps.map((s, i) => (i === stepIndex ? { ...s, status: "done" } : i > stepIndex && s.status !== "done" ? { ...s, status: "skipped" } : s)),
    };
    const next: WorkflowRun = {
      ...r,
      status: "in_progress",
      completedAt: null,
      round: round + 1,
      roundStartedAt: now,
      carryOver: { files, into },
      rounds: [...(r.rounds ?? []), ended],
      followUps: undefined,
      position: 0,
      steps: emptyRunSteps(def),
    };
    return { ...next, progress: computeProgress(next) };
  });
  if (!saved) throw new Error("Run not found.");
  return saved;
}
