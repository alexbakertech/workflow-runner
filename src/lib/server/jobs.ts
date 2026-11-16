import "server-only";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AGENT_INSTRUCTIONS,
  agentMessage,
  cleanReply,
  correctionMessage,
  fixableVerdict,
  followUpMessage,
  isActive,
  providerName,
  type AgentJob,
  type JobEvent,
  type ProviderId,
} from "../agents";
import type { WorkflowRun } from "../types";
import { completeAiStep, contextFiles, detectSignals, extractQuestions, followUpsUsed, followUpVerdict, wordCount } from "../workflow";
import { adapters, getSettings, providerStatus } from "./agents";
import { AgentError } from "./agents/shared";
import { DATA_DIR, getRun, updateRun } from "./store";

// One step runs at a time across the whole app; everything else waits in the queue.
// State lives on globalThis so dev hot reloads don't orphan running jobs.

const JOB_DIR = path.join(DATA_DIR, "jobs");
const WORK_DIR = path.join(DATA_DIR, "work");
const MAX_EVENTS = 200;
const PARTIAL_TAIL = 6000;
const KEEP_JOBS = 300;

interface State {
  jobs: Map<string, AgentJob>;
  queue: string[];
  running: string | null;
  controllers: Map<string, AbortController>;
  emitter: EventEmitter;
  ready: Promise<void> | null;
}

const g = globalThis as unknown as { __wfJobs?: State };
const state: State = (g.__wfJobs ??= {
  jobs: new Map(),
  queue: [],
  running: null,
  controllers: new Map(),
  emitter: new EventEmitter().setMaxListeners(100),
  ready: null,
});

const now = () => new Date().toISOString();
const newJobId = () => `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Loads saved jobs once. Anything that was mid-flight when the server stopped is marked failed. */
export function ready(): Promise<void> {
  return (state.ready ??= (async () => {
    await fs.mkdir(JOB_DIR, { recursive: true });
    const names = (await fs.readdir(JOB_DIR)).filter((n) => n.endsWith(".json")).sort().slice(-KEEP_JOBS);
    for (const name of names) {
      try {
        const job = JSON.parse(await fs.readFile(path.join(JOB_DIR, name), "utf8")) as AgentJob;
        if (state.jobs.has(job.id)) continue;
        if (isActive(job)) {
          Object.assign(job, { status: "failed", error: "The server restarted while this step was running. Run it again.", finishedAt: now() });
          await persist(job);
        }
        state.jobs.set(job.id, job);
      } catch {}
    }
    await fs.rm(WORK_DIR, { recursive: true, force: true }).catch(() => {});
  })());
}

async function persist(job: AgentJob) {
  await fs.mkdir(JOB_DIR, { recursive: true });
  const file = path.join(JOB_DIR, `${job.id}.json`);
  await fs.writeFile(`${file}.tmp`, JSON.stringify(job, null, 2));
  await fs.rename(`${file}.tmp`, file);
}

// Progress events arrive many times a second; emit each one but write to disk at most every 2s.
const lastWrite = new Map<string, number>();
function changed(job: AgentJob, force = false) {
  state.emitter.emit("job", job);
  const t = Date.now();
  if (force || t - (lastWrite.get(job.id) ?? 0) > 2000) {
    lastWrite.set(job.id, t);
    void persist(job).catch(() => {});
  }
}

function log(job: AgentJob, kind: JobEvent["kind"], text: string) {
  job.events.push({ at: now(), kind, text });
  if (job.events.length > MAX_EVENTS) job.events.splice(0, job.events.length - MAX_EVENTS);
}

export function subscribe(fn: (job: AgentJob) => void): () => void {
  state.emitter.on("job", fn);
  return () => state.emitter.off("job", fn);
}

export async function jobsForRun(runId: string, limit = 20): Promise<AgentJob[]> {
  await ready();
  return [...state.jobs.values()]
    .filter((j) => j.runId === runId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

/** Runs with a queued or running job, mapped to the step it's on. */
export async function activeByRun(): Promise<Record<string, number>> {
  await ready();
  const out: Record<string, number> = {};
  for (const j of state.jobs.values()) if (isActive(j)) out[j.runId] = j.stepIndex;
  return out;
}

export interface StartRequest {
  runId: string;
  stepIndex: number;
  provider: ProviderId;
  model: string;
  autoAdvance: boolean;
  /** A correction of this step using the report of the check at verifierIndex. */
  fix?: { verifierIndex: number };
  afterFix?: boolean;
  followUp?: { n: number };
}

/** Checks a step can be handed to an agent. Returns a user-facing reason if not. */
function cannotRun(run: WorkflowRun, stepIndex: number): string | null {
  const step = run.template.definition.steps[stepIndex];
  if (!step) return "That step doesn’t exist.";
  if (step.kind !== "ai") return "Review steps are yours to do.";
  if (run.status === "setup") return "Finish the setup questions first.";
  const empty = contextFiles(run, step).filter((f) => !f.content.trim());
  if (empty.length) return `Some inputs are empty: ${empty.map((f) => f.name).join(", ")}. Complete those steps first.`;
  return null;
}

export async function startJob(req: StartRequest): Promise<AgentJob> {
  await ready();
  if (!adapters[req.provider]) throw new AgentError("Unknown provider.");
  const run = await getRun(req.runId);
  if (!run) throw new AgentError("Run not found.");
  const busy = [...state.jobs.values()].find((j) => j.runId === req.runId && isActive(j));
  if (busy) throw new AgentError(`Step ${busy.stepIndex + 1} is already running for this run.`);
  const reason = cannotRun(run, req.stepIndex);
  if (reason) throw new AgentError(reason);
  // Record the real model name rather than "default".
  const model = req.model || (await providerStatus(req.provider)).defaultModel || "";
  return enqueue(run, { ...req, model });
}

/**
 * Follow-up on a step that recommended investigating further. "research": one research session on its open
 * questions (once per round, so it can't go round in circles), then the step runs again with the findings.
 * "answers": the step runs again with only the user's answers. Uses the agent that ran the step unless told otherwise.
 */
export async function startFollowUp(
  runId: string,
  stepIndex: number,
  answers: string,
  kind: "research" | "answers" = "research",
  provider?: ProviderId,
  model?: string,
): Promise<AgentJob> {
  await ready();
  const run = await getRun(runId);
  if (!run) throw new AgentError("Run not found.");
  if (!followUpVerdict(run, stepIndex)) throw new AgentError("This step didn’t recommend further research.");
  const step = run.template.definition.steps[stepIndex];
  const used = followUpsUsed(run, step.id);
  if (kind === "research" && used.research)
    throw new AgentError("This round already had its quick follow-up. Add your own answers, or start a new round.");
  if (kind === "answers" && used.answers) throw new AgentError("This round already had its update with your answers. Start a new round to go further.");
  if (kind === "answers" && !answers.trim()) throw new AgentError("Add your answers first.");
  const busy = [...state.jobs.values()].find((j) => j.runId === runId && isActive(j));
  if (busy) throw new AgentError(`Step ${busy.stepIndex + 1} is already running for this run.`);
  const rs = run.steps[stepIndex];
  const settings = await getSettings();
  const chosen = provider ?? rs.agent?.provider ?? settings.defaultProvider;
  if (!chosen || !adapters[chosen]) throw new AgentError("Connect an agent in Settings to run a follow-up.");
  const chosenModel = model ?? (rs.agent?.provider === chosen ? rs.agent.model : settings.models[chosen]) ?? "";

  const now = new Date().toISOString();
  let n = 0;
  const saved = await updateRun(runId, (r) => {
    n = (r.followUps?.length ?? 0) + 1;
    const f = {
      n,
      kind,
      stepId: step.id,
      createdAt: now,
      questions: extractQuestions(rs.response, 5),
      answers: answers.trim(),
      previous: rs.response,
      // Answers need no session of their own; they go straight to the step's re-run.
      status: kind === "answers" ? ("done" as const) : ("running" as const),
    };
    return { ...r, followUps: [...(r.followUps ?? []), f], status: "in_progress", completedAt: null, position: stepIndex };
  });
  if (!saved) throw new AgentError("Run not found.");
  return startJob({ runId, stepIndex, provider: chosen, model: chosenModel, autoAdvance: true, ...(kind === "research" ? { followUp: { n } } : {}) });
}

/** Sends a check's "Revise" report back to the step it checked for a targeted correction; the check then runs again. */
export async function startFix(req: Omit<StartRequest, "stepIndex" | "fix">, verifierIndex: number): Promise<AgentJob> {
  const run = await getRun(req.runId);
  if (!run) throw new AgentError("Run not found.");
  const verdict = fixableVerdict(run, verifierIndex);
  if (!verdict) throw new AgentError("This check didn’t ask for a correction.");
  const job = await startJob({ ...req, stepIndex: verdict.targetIndex, fix: { verifierIndex } });
  await updateRun(run.id, (r) => ({ ...r, position: verdict.targetIndex }));
  return job;
}

function enqueue(run: WorkflowRun, req: StartRequest): AgentJob {
  const step = run.template.definition.steps[req.stepIndex];
  const job: AgentJob = {
    id: newJobId(),
    runId: run.id,
    stepIndex: req.stepIndex,
    stepId: step.id,
    stepLabel: step.label,
    round: run.round ?? 1,
    provider: req.provider,
    model: req.model,
    status: "queued",
    autoAdvance: req.autoAdvance,
    ...(req.fix ? { fix: req.fix } : {}),
    ...(req.afterFix ? { afterFix: true } : {}),
    ...(req.followUp ? { followUp: req.followUp } : {}),
    createdAt: now(),
    events: [],
    toolCalls: 0,
  };
  if (req.fix) log(job, "status", `Correcting the claims flagged by “${run.template.definition.steps[req.fix.verifierIndex]?.label}”`);
  else if (req.afterFix) log(job, "status", "Checking the corrected version");
  else if (req.followUp) log(job, "status", "Researching the open questions");
  log(job, "status", `Queued for ${providerName(req.provider)}${req.model ? ` (${req.model})` : ""}`);
  state.jobs.set(job.id, job);
  state.queue.push(job.id);
  changed(job, true);
  pump();
  return job;
}

export async function cancelJobs(runId: string): Promise<number> {
  await ready();
  let n = 0;
  for (const job of state.jobs.values()) {
    if (job.runId !== runId || !isActive(job)) continue;
    n++;
    if (job.status === "queued") {
      state.queue = state.queue.filter((id) => id !== job.id);
      finish(job, "cancelled", { error: "Cancelled before it started." });
    } else {
      state.controllers.get(job.id)?.abort();
    }
  }
  return n;
}

function finish(job: AgentJob, status: AgentJob["status"], patch: Partial<AgentJob> = {}) {
  Object.assign(job, { status, finishedAt: now(), activity: undefined }, patch);
  if (patch.error) log(job, "error", patch.error);
  else log(job, "status", status === "succeeded" ? "Finished" : status);
  changed(job, true);
}

function pump() {
  if (state.running || !state.queue.length) return;
  const id = state.queue.shift()!;
  const job = state.jobs.get(id);
  if (!job || job.status !== "queued") return pump();
  state.running = id;
  void execute(job).finally(() => {
    state.running = null;
    state.controllers.delete(id);
    pump();
  });
}

async function execute(job: AgentJob) {
  const controller = new AbortController();
  state.controllers.set(job.id, controller);
  const cwd = path.join(WORK_DIR, job.id);
  Object.assign(job, { status: "running", startedAt: now(), activity: "Starting…" });
  log(job, "status", "Started");
  changed(job, true);

  try {
    const run = await getRun(job.runId);
    if (!run) throw new AgentError("The run was deleted.");
    const reason = cannotRun(run, job.stepIndex);
    if (reason) throw new AgentError(reason);
    if (job.fix && !fixableVerdict(run, job.fix.verifierIndex)) throw new AgentError("The check no longer asks for a correction.");
    const followUp = job.followUp ? run.followUps?.find((f) => f.n === job.followUp!.n) : undefined;
    if (job.followUp && !followUp) throw new AgentError("The follow-up was removed.");
    await fs.mkdir(cwd, { recursive: true });

    const result = await adapters[job.provider].run({
      instructions: AGENT_INSTRUCTIONS,
      message: followUp
        ? followUpMessage(run, followUp)
        : job.fix
          ? correctionMessage(run, job.stepIndex, job.fix.verifierIndex)
          : agentMessage(run, run.template.definition.steps[job.stepIndex]),
      model: job.model,
      cwd,
      signal: controller.signal,
      onEvent: (e) => {
        if (e.type === "partial") job.partial = e.text.length > PARTIAL_TAIL ? "…" + e.text.slice(-PARTIAL_TAIL) : e.text;
        else if (e.type === "session") job.sessionId = e.text;
        else {
          job.activity = e.text;
          log(job, e.type === "tool" ? "tool" : "status", e.text);
          if (e.type === "tool") job.toolCalls++;
        }
        changed(job);
      },
    });

    job.toolCalls = Math.max(job.toolCalls, result.toolCalls);
    Object.assign(job, { sessionId: result.sessionId ?? job.sessionId, usage: result.usage, warnings: result.warnings });
    const next = await applyResult(job, result.text);
    finish(job, "succeeded", { partial: undefined });
    if (next) enqueue(next.run, next.req);
  } catch (e) {
    const cancelled = controller.signal.aborted;
    // A follow-up that didn't finish leaves the run as it was before it started.
    if (job.followUp)
      await updateRun(job.runId, (r) => ({
        ...r,
        followUps: r.followUps?.map((f) => (f.n === job.followUp!.n ? { ...f, status: "failed" as const } : f)),
        ...(r.steps.every((s) => s.status === "done" || s.status === "skipped") ? { status: "completed" as const, completedAt: r.completedAt ?? now() } : {}),
      })).catch(() => {});
    finish(job, cancelled ? "cancelled" : "failed", {
      error: cancelled ? "Cancelled." : e instanceof AgentError ? e.message : `Unexpected error: ${(e as Error).message}`,
    });
  } finally {
    await fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Writes the reply into the run. With auto-advance, also completes the step and decides whether to queue the next
 * one: it stops at review steps, at warning signals (e.g. "Gate result: Revise"), and at the end of the workflow.
 */
async function applyResult(job: AgentJob, text: string): Promise<{ run: WorkflowRun; req: StartRequest } | null> {
  let next: { run: WorkflowRun; req: StartRequest } | null = null;
  const finishedAt = now();
  const { onRevise } = await getSettings();
  const saved = await updateRun(job.runId, (run) => {
    const def = run.template.definition;
    const step = def.steps[job.stepIndex];
    if (!step || step.id !== job.stepId) throw new AgentError("The workflow changed while the step was running.");
    if ((run.round ?? 1) !== (job.round ?? 1)) throw new AgentError(`The run moved on to round ${run.round} while this step was running.`);
    const prev = run.steps[job.stepIndex];
    const cleaned = cleanReply(text, step.output.file);
    const trimmed = cleaned !== text.trim();
    text = cleaned;
    const signals = { ...prev.signals, ...detectSignals(text, step.signals) };
    let updated: WorkflowRun = {
      ...run,
      steps: run.steps.map((s, i) =>
        i === job.stepIndex
          ? {
              ...s,
              response: text,
              responseSource: "agent",
              uploadedFileName: undefined,
              wordCount: wordCount(text),
              signals,
              agent: {
                jobId: job.id,
                provider: job.provider,
                model: job.model || "default",
                sessionId: job.sessionId,
                startedAt: job.startedAt ?? finishedAt,
                finishedAt,
                durationMs: Date.parse(finishedAt) - Date.parse(job.startedAt ?? finishedAt),
                toolCalls: job.toolCalls,
                usage: job.usage,
                ...(trimmed ? { trimmed: true } : {}),
              },
            }
          : s,
      ),
    };
    const base = { runId: job.runId, provider: job.provider, model: job.model, autoAdvance: job.autoAdvance };

    // Follow-up research goes into its record, not the step; then the step runs again with the findings.
    if (job.followUp) {
      const research = cleanReply(text, "follow_up_research.md");
      const agent = {
        jobId: job.id,
        provider: job.provider,
        model: job.model || "default",
        sessionId: job.sessionId,
        startedAt: job.startedAt ?? finishedAt,
        finishedAt,
        durationMs: Date.parse(finishedAt) - Date.parse(job.startedAt ?? finishedAt),
        toolCalls: job.toolCalls,
        usage: job.usage,
      };
      const done: WorkflowRun = {
        ...run,
        followUps: run.followUps?.map((f) => (f.n === job.followUp!.n ? { ...f, status: "done" as const, research, agent } : f)),
      };
      next = { run: done, req: { ...base, stepIndex: job.stepIndex, autoAdvance: true } };
      return done;
    }

    // A correction is recorded straight away, then the check runs again on the corrected version.
    if (job.fix) {
      const v = job.fix.verifierIndex;
      if (job.warnings?.length) {
        job.stoppedBecause = "The corrected reply may be incomplete. Check it, then run the check again.";
        return { ...updated, position: job.stepIndex, steps: updated.steps.map((s, i) => (i === job.stepIndex ? { ...s, status: "pending" } : s)) };
      }
      updated = completeAiStep(updated, job.stepIndex, finishedAt);
      updated = { ...updated, position: v, steps: updated.steps.map((s, i) => (i === v ? { ...s, status: "pending" } : s)) };
      next = { run: updated, req: { ...base, stepIndex: v, afterFix: true } };
      return updated;
    }

    if (!job.autoAdvance) {
      // A redone step needs reviewing again before it counts as done.
      if (prev.status === "done") updated = { ...updated, steps: updated.steps.map((s, i) => (i === job.stepIndex ? { ...s, status: "pending" } : s)) };
      return updated;
    }

    const warn = (step.signals ?? []).find((sig) => signals[sig.key] && sig.warnOn?.includes(signals[sig.key]));
    if (warn) {
      const value = signals[warn.key];
      const verdict = fixableVerdict(updated, job.stepIndex);
      const fixable = verdict?.signal.key === warn.key;
      if (fixable && onRevise === "fix" && !job.afterFix) {
        log(job, "status", `${warn.label}: ${value}. Sending the report back to “${def.steps[verdict.targetIndex].label}” for a correction (your setting).`);
        updated = { ...updated, position: verdict.targetIndex };
        next = { run: updated, req: { ...base, stepIndex: verdict.targetIndex, fix: { verifierIndex: job.stepIndex } } };
        return updated;
      }
      if (!(fixable && onRevise === "continue")) {
        job.stoppedBecause =
          job.afterFix && fixable
            ? `${warn.label}: still ${value} after a correction. Review it before going on.`
            : `${warn.label}: ${value}. Review it before going on.`;
        return { ...updated, position: job.stepIndex };
      }
      log(job, "status", `${warn.label}: ${value}. Carrying the flag forward and continuing (your setting).`);
    }
    if (job.warnings?.length) {
      job.stoppedBecause = "The reply may be incomplete. Check it before going on.";
      return { ...updated, position: job.stepIndex };
    }
    updated = completeAiStep(updated, job.stepIndex, finishedAt);
    const keep = updated.status === "completed" || updated.status === "stopped" || updated.status === "paused";
    const nextIndex = job.stepIndex + 1;
    const nextStep = def.steps[nextIndex];
    if (!nextStep) {
      job.stoppedBecause = "That was the last step.";
      return { ...updated, status: "completed", completedAt: finishedAt };
    }
    updated = { ...updated, position: nextIndex, status: keep ? updated.status : "in_progress" };
    if (updated.agentBreakpoints?.includes(nextStep.id)) {
      job.stoppedBecause = `You set a stop before “${nextStep.label}”.`;
      return updated;
    }
    if (nextStep.kind !== "ai") {
      job.stoppedBecause = `Next up is “${nextStep.label}”, which is yours to do.`;
      return updated;
    }
    const reason = cannotRun(updated, nextIndex);
    if (reason) {
      job.stoppedBecause = reason;
      return updated;
    }
    next = { run: updated, req: { ...base, stepIndex: nextIndex, autoAdvance: true } };
    return updated;
  });
  if (!saved) throw new AgentError("The run was deleted while the step was running.");
  return next;
}
