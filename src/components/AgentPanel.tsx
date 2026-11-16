"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PROVIDERS,
  formatTokens,
  isActive,
  providerName,
  stepInputTokens,
  type AgentJob,
  type AgentSettings,
  type ProviderId,
  type ProviderStatus,
} from "@/lib/agents";
import type { TemplateStep, WorkflowRun } from "@/lib/types";
import { contextFiles } from "@/lib/workflow";
import { Icon } from "./ui";

export interface AgentControls {
  providers: ProviderStatus[] | null;
  settings: AgentSettings | null;
  /** Latest job for the step on screen. */
  job: AgentJob | null;
  /** Any queued/running job for this run. */
  active: AgentJob | null;
  start: (provider: ProviderId, model: string, autoAdvance: boolean) => Promise<void>;
  /** Sends the check at this step back to the step it checked for a targeted correction, then re-runs the check. */
  fix: (verifierIndex: number) => Promise<void>;
  /** For a step recommending more research: quick follow-up research, or the next round. */
  followUp: (stepIndex: number, answers: string, kind: "research" | "answers") => Promise<void>;
  closeFollowUp: (stepIndex: number, closed: boolean) => void;
  nextRound: (stepIndex: number, answers: string) => Promise<void>;
  cancel: () => void;
  goToStep: (i: number) => void;
  /** Step ids an auto-advancing agent stops before. */
  breakpoints: string[];
  toggleBreakpoint: (stepId: string) => void;
}

const elapsed = (from?: string, to?: string) => {
  if (!from) return "";
  const s = Math.max(0, Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

export function AgentPanel({
  run,
  step,
  index,
  agent,
  children,
}: {
  run: WorkflowRun;
  step: TemplateStep;
  index: number;
  agent: AgentControls;
  /** Shown above the run controls while idle (inputs and prompt). */
  children?: React.ReactNode;
}) {
  const { providers, settings, job, active } = agent;
  const ready = (providers ?? []).filter((p) => p.installed && p.signedIn);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [model, setModel] = useState("");
  const [auto, setAuto] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [, tick] = useState(0);

  // Default to whatever ran this step last, then whatever this run used last, then the remembered choice.
  const isReady = (id?: ProviderId | null) => Boolean(id && ready.some((p) => p.id === id));
  const runLast = [...run.steps.slice(0, index)].reverse().find((s) => s.agent)?.agent;
  const previous = job ?? (runLast ? { provider: runLast.provider, model: runLast.model } : null);
  const chosen: ProviderId | null =
    provider ??
    (isReady(previous?.provider) ? previous!.provider : isReady(settings?.defaultProvider) ? settings!.defaultProvider : (ready[0]?.id ?? null));
  const status = providers?.find((p) => p.id === chosen);
  const lastModel = previous && previous.provider === chosen && status?.models.some((m) => m.id === previous.model) ? previous.model : "";
  const chosenModel = model || lastModel || (chosen && settings?.models[chosen]) || status?.defaultModel || "";
  const modelInfo = status?.models.find((m) => m.id === chosenModel);
  const autoAdvance = auto ?? settings?.autoAdvance ?? false;

  const running = job && isActive(job) ? job : null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!providers || !settings) return <div className="skeleton" style={{ height: 120 }} />;

  const otherStepBusy = active && active.stepIndex !== index ? active : null;
  const missing = contextFiles(run, step).filter((f) => !f.content.trim());
  const tokens = stepInputTokens(run, step);
  const ctxWindow = modelInfo?.contextWindow;
  const ratio = ctxWindow ? tokens / ctxWindow : 0;
  const rs = run.steps[index];
  // Recorded steps were already confirmed when Redo was chosen; a pasted, unsaved reply wasn't.
  const hasReply = Boolean(rs.response.trim());
  const upcoming: TemplateStep[] = [];
  for (const s of run.template.definition.steps.slice(index + 1)) {
    upcoming.push(s);
    if (s.kind !== "ai") break;
  }

  const run_ = async () => {
    if (!chosen) return;
    if (hasReply && rs.status !== "done" && rs.responseSource !== "agent" && !confirm("Replace the pasted reply with one from the agent?")) return;
    setError(null);
    setStarting(true);
    try {
      await agent.start(chosen, chosenModel, autoAdvance);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (!ready.length)
    return (
      <div className="card subtle card-pad row gap-12">
        <Icon name="spark" />
        <span className="small muted" style={{ flex: 1, minWidth: 200 }}>
          Want an agent to do this step for you? Connect Claude, Codex or a local model in Settings. Until then, follow the
          steps below by hand.
        </span>
        <Link className="btn sm" href="/settings">
          Set up agents
        </Link>
      </div>
    );

  return (
    <div className="card agent-card">
      {running && (
        <div className="card-head">
          <Icon name="spark" />
          <h3 style={{ fontSize: 15.5 }}>Agent at work</h3>
        </div>
      )}
      <div className="card-body stack gap-12">
        {running ? (
          <RunningView job={running} onCancel={agent.cancel} />
        ) : otherStepBusy ? (
          <div className="activity">
            <span className="spinner" />
            <span style={{ flex: 1 }}>
              The agent is working on step {otherStepBusy.stepIndex + 1}, {otherStepBusy.stepLabel}.
            </span>
            <button className="btn sm" onClick={() => agent.goToStep(otherStepBusy.stepIndex)}>
              Watch it
            </button>
          </div>
        ) : (
          <>
            {job && (!rs.savedAt || (job.finishedAt ?? "") > rs.savedAt) && <LastResult job={job} onRetry={run_} />}
            {children}
            <hr className="divider" />
            <div className="row gap-12" style={{ alignItems: "flex-end" }}>
              <div className="stack gap-4">
                <span className="tiny muted">
                  Agent ·{" "}
                  <Link href="/settings" className="tiny">
                    settings
                  </Link>
                </span>
                <div className="seg-control" role="radiogroup" aria-label="Agent">
                  {PROVIDERS.map((p) => {
                    const st = providers.find((x) => x.id === p.id);
                    const ok = Boolean(st?.installed && st.signedIn);
                    return (
                      <button
                        key={p.id}
                        role="radio"
                        aria-checked={chosen === p.id}
                        className={chosen === p.id ? "on" : ""}
                        disabled={!ok}
                        title={ok ? `${p.kind}${st?.account ? ` · ${st.account}` : ""}` : (st?.problem ?? "Not set up")}
                        onClick={() => {
                          setProvider(p.id);
                          setModel("");
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {status && status.models.length > 0 && (
                <label className="stack gap-4">
                  <span className="tiny muted">Model</span>
                  <select className="input sm select" value={chosenModel} onChange={(e) => setModel(e.target.value)}>
                    {status.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className={`gauge ${ratio >= 1 ? "danger" : ratio >= 0.8 ? "warn" : ""}`} title="Instructions, input files and prompt, before the model writes anything">
                <span className="tiny muted">
                  Context ≈ {formatTokens(tokens)} tokens{ctxWindow ? ` of ${formatTokens(ctxWindow)}` : ""}
                </span>
                <div className="gauge-track">
                  <span style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }} />
                </div>
              </div>
            </div>
            {ratio >= 1 ? (
              <p className="small" style={{ color: "var(--danger)" }}>
                The inputs are larger than this model’s context window. Pick a model with a bigger window.
              </p>
            ) : ratio >= 0.8 ? (
              <p className="small" style={{ color: "var(--warn)" }}>
                The inputs fill most of this model’s context window, leaving little room for research and the reply.
              </p>
            ) : null}
            {modelInfo?.maxOutput && modelInfo.maxOutput < 8000 && (
              <p className="tiny muted">This model writes at most about {formatTokens(modelInfo.maxOutput)} tokens per reply; long reports may be cut off.</p>
            )}
            <div className="row gap-12">
              <label className="check" style={{ flex: 1, minWidth: 240 }}>
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAuto(e.target.checked)} disabled={!upcoming.some((u) => u.kind === "ai")} />
                <span>
                  Keep going automatically
                  <span className="tiny muted" style={{ display: "block" }}>
                    {upcoming.some((u) => u.kind === "ai")
                      ? `Run the following AI steps too. Always stops at your review steps and if anything fails. On a “Revise” verdict it will ${
                          { pause: "pause", fix: "have the agent correct it, then re-check", continue: "carry the flag and keep going" }[settings?.onRevise ?? "pause"]
                        } (change this in Settings).`
                      : "Not needed here: the next step is yours to do."}
                  </span>
                </span>
              </label>
              <button className="btn primary" onClick={run_} disabled={!chosen || starting || missing.length > 0 || ratio >= 1}>
                <Icon name="play" /> {starting ? "Starting…" : `Run step ${index + 1} with ${providerName(chosen!)}`}
              </button>
            </div>
            {autoAdvance && upcoming.some((u) => u.kind === "ai") && (
              <div className="stops fade-in">
                <span className="tiny muted">Route — click a step to stop before it and do it yourself:</span>
                <div className="stops-route">
                  <span className="stop-node here">
                    {index + 1}. {step.label}
                  </span>
                  {upcoming.map((u) => {
                    const i = run.template.definition.steps.indexOf(u);
                    const human = u.kind !== "ai";
                    const stop = human || agent.breakpoints.includes(u.id);
                    return (
                      <span key={u.id} className="row gap-4" style={{ flexWrap: "nowrap" }}>
                        <span className={`stop-link ${stop ? "cut" : ""}`} aria-hidden />
                        {human ? (
                          <span className="stop-node human" title="Review steps always stop the agent">
                            <Icon name="user" /> {i + 1}. {u.label}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`stop-node ${stop ? "stopped" : ""}`}
                            aria-pressed={stop}
                            title={stop ? "The agent will stop before this step. Click to let it continue." : "Click to stop the agent before this step"}
                            onClick={() => agent.toggleBreakpoint(u.id)}
                          >
                            {stop && <Icon name="pause" />} {i + 1}. {u.label}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {missing.length > 0 && <p className="small muted">Complete the earlier steps first: {missing.map((m) => m.name).join(", ")} is empty.</p>}
            {error && (
              <div className="callout danger">
                <Icon name="alert" />
                <div>{error}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RunningView({ job, onCancel }: { job: AgentJob; onCancel: () => void }) {
  const tools = job.events.filter((e) => e.kind === "tool").slice(-8);
  return (
    <div className="stack gap-12">
      <div className="activity">
        <span className="spinner" />
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
          {job.status === "queued" ? "Waiting for another run’s step to finish…" : (job.activity ?? "Working…")}
        </span>
        <span className="tiny faint" style={{ fontVariantNumeric: "tabular-nums" }}>
          {elapsed(job.startedAt ?? job.createdAt)}
        </span>
        <button className="btn sm" onClick={onCancel}>
          <Icon name="stop" /> Cancel
        </button>
      </div>
      <div className="row gap-8 tiny muted">
        <span className="chip">
          {providerName(job.provider)}
          {job.model ? ` · ${job.model}` : ""}
        </span>
        {job.toolCalls > 0 && <span className="chip">{job.toolCalls} web lookup{job.toolCalls === 1 ? "" : "s"}</span>}
        {job.fix && <span className="chip warn">Correcting flagged claims · the check runs again after</span>}
        {job.afterFix && <span className="chip">Checking the corrected version</span>}
        {job.followUp && <span className="chip accent">Follow-up research on the open questions · this step runs again after</span>}
        {job.autoAdvance && <span className="chip accent">Keeps going after this step</span>}
      </div>
      {tools.length > 0 && (
        <ul className="agent-log" aria-label="What the agent has done">
          {tools.map((e, i) => (
            <li key={i}>
              <time>{clock(e.at)}</time>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      )}
      {job.partial && (
        <div className="live-preview" aria-live="off">
          <span>{job.partial.slice(-1600)}</span>
        </div>
      )}
      <p className="tiny faint">You can leave this page; the step keeps running and the reply is saved to the run.</p>
    </div>
  );
}

function LastResult({ job, onRetry }: { job: AgentJob; onRetry: () => void }) {
  if (job.status === "failed")
    return (
      <div className="callout danger">
        <Icon name="alert" />
        <div className="stack gap-8" style={{ flex: 1 }}>
          <div>
            <strong>{providerName(job.provider)} couldn’t finish this step.</strong> {job.error}
          </div>
          <div className="row gap-8">
            <button className="btn sm" onClick={onRetry}>
              Try again
            </button>
            <span className="tiny">or do it by hand with the steps below.</span>
          </div>
        </div>
      </div>
    );
  if (job.status === "cancelled") return <p className="small muted">The last agent run was cancelled.</p>;
  return null;
}
