"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiStep } from "@/components/AiStep";
import { HumanStep, materializeFields } from "@/components/HumanStep";
import { SetupScreen } from "@/components/SetupScreen";
import { Icon, ProgressBar, TopBar, downloadText, useToast } from "@/components/ui";
import { SaveIndicator, useRun } from "@/components/useRun";
import { useAgentJobs, useProviders } from "@/components/useAgent";
import type { AgentControls } from "@/components/AgentPanel";
import type { AgentJob, ProviderId } from "@/lib/agents";
import type { RunStep, WorkflowRun } from "@/lib/types";
import {
  completeAiStep,
  contextFiles,
  decisionEffect,
  detectSignals,
  frontier,
  renderHumanOutput,
  slugify,
  stepDigest,
  wordCount,
} from "@/lib/workflow";

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { run, notFound, saveState, update, flush, reload } = useRun(id);
  const [view, setView] = useState<number | null>(null);
  // True while the step on screen has an unsaved edit; holds the footer until it's saved or cancelled.
  const [locked, setLocked] = useState<string | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const { providers, settings, saveSettings } = useProviders();

  // When a job ends the server has written to the run file: reload it, and follow an auto-advancing chain.
  const onJobFinished = useCallback(
    async (job: AgentJob) => {
      const fresh = await reload();
      if (job.status !== "succeeded") return;
      if (fresh && (job.autoAdvance || job.fix) && viewRef.current === job.stepIndex && fresh.position !== job.stepIndex) {
        setView(fresh.position);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (fresh?.status === "completed" && job.autoAdvance && job.stepIndex === fresh.steps.length - 1) router.push(`/runs/${fresh.id}/summary`);
    },
    [reload, router],
  );
  const agentJobs = useAgentJobs(id, onJobFinished);

  // Open on the step the user was last on.
  useEffect(() => {
    if (!run || view !== null) return;
    if (run.status === "setup") return setView(-1);
    // ?step=N jumps to a specific step (used by the summary page), if it's reachable.
    const requested = Number(new URLSearchParams(window.location.search).get("step"));
    const ok = Number.isInteger(requested) && requested >= 0 && requested <= frontier(run) && window.location.search.includes("step=");
    setView(ok ? requested : run.position);
    // Drop ?step= so a refresh resumes where the user actually is.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [run, view]);

  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const go = useCallback(
    (i: number) => {
      // Leaving mid-edit would silently drop it.
      if (lockedRef.current?.startsWith("Save") && !confirm("Discard your unsaved edit?")) return;
      setView(i);
      if (i >= 0) update((r) => ({ ...r, position: i }));
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [update],
  );

  if (notFound)
    return (
      <>
        <TopBar />
        <main className="page stack gap-12">
          <h1>Run not found</h1>
          <Link href="/">← Back to start</Link>
        </main>
      </>
    );
  if (!run || view === null)
    return (
      <>
        <TopBar />
        <main className="page stack gap-16">
          <div className="skeleton" style={{ height: 32, width: "50%" }} />
          <div className="skeleton" style={{ height: 300 }} />
        </main>
      </>
    );

  const t = run.template.definition;
  const step = view >= 0 ? t.steps[view] : null;
  const agent: AgentControls = {
    providers,
    settings,
    job: view >= 0 ? agentJobs.latestFor(view, run.round ?? 1) : null,
    active: agentJobs.active,
    start: async (provider: ProviderId, model: string, autoAdvance: boolean) => {
      await flush();
      await agentJobs.start({ stepIndex: view, provider, model, autoAdvance });
      // Remember the choice for next time.
      void saveSettings({ defaultProvider: provider, models: { ...settings?.models, [provider]: model }, autoAdvance });
    },
    fix: async (verifierIndex: number) => {
      await flush();
      // Use whatever ran the check; fall back to the remembered choice.
      const last = run.steps[verifierIndex].agent;
      const ready = (providers ?? []).filter((p) => p.installed && p.signedIn);
      const provider = last && ready.some((p) => p.id === last.provider) ? last.provider : (settings?.defaultProvider ?? ready[0]?.id);
      if (!provider) throw new Error("Connect an agent in Settings first.");
      const model = last?.provider === provider ? last.model : (settings?.models[provider] ?? "");
      const job = await agentJobs.start({ fixFrom: verifierIndex, provider, model, autoAdvance: settings?.autoAdvance ?? false });
      setView(job.stepIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
      await reload();
    },
    followUp: async (stepIndex: number, answers: string, kind: "research" | "answers") => {
      await flush();
      const res = await fetch(`/api/runs/${run.id}/follow-up`, { method: "POST", body: JSON.stringify({ stepIndex, answers, kind }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn’t start the follow-up.");
      await reload();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    nextRound: (stepIndex: number, answers: string) => startRound(stepIndex, answers),
    closeFollowUp: (stepIndex: number, closed: boolean) =>
      update((r) => ({ ...r, steps: r.steps.map((s, i) => (i === stepIndex ? { ...s, followUpClosed: closed || undefined } : s)) }), { immediate: true }),
    cancel: () => void agentJobs.cancel(),
    goToStep: (i) => go(i),
    breakpoints: run.agentBreakpoints ?? [],
    toggleBreakpoint: (stepId) =>
      update((r) => {
        const cur = r.agentBreakpoints ?? [];
        return { ...r, agentBreakpoints: cur.includes(stepId) ? cur.filter((x) => x !== stepId) : [...cur, stepId] };
      }, { immediate: true }),
  };
  async function roundStarted(round: number) {
    await reload();
    setView(0);
    window.scrollTo({ top: 0, behavior: "instant" });
    toast.show(`Round ${round} started. Step 1 gets round ${round - 1}’s reports and your answers as input.`);
  }
  async function startRound(stepIndex: number, answers: string) {
    await flush();
    const res = await fetch(`/api/runs/${id}/next-round`, { method: "POST", body: JSON.stringify({ stepIndex, answers }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Couldn’t start the next round.");
    await roundStarted(json.round);
  }

  // Deliberate edit of a recorded reply: re-record it so later steps can tell it changed.
  const saveEdit = (text: string) =>
    update(
      (r) => {
        const def = r.template.definition.steps[view];
        const prev = r.steps[view];
        const auto = detectSignals(text, def.signals);
        const manual = Object.fromEntries(Object.entries(prev.signals ?? {}).filter(([k]) => !(k in auto)));
        const edited: WorkflowRun = {
          ...r,
          steps: r.steps.map((s, i) =>
            i === view ? { ...s, response: text, wordCount: wordCount(text), signals: { ...manual, ...auto }, editedAt: new Date().toISOString() } : s,
          ),
        };
        return prev.status === "done" ? completeAiStep(edited, view) : edited;
      },
      { immediate: true },
    );
  const busyHere = Boolean(agent.job && (agent.job.status === "queued" || agent.job.status === "running"));
  const rs = view >= 0 ? run.steps[view] : null;
  const isLast = view === t.steps.length - 1;
  const maxReachable = run.status === "setup" ? -1 : frontier(run);

  const patchStep = (patch: Partial<RunStep>) =>
    update((r) => ({ ...r, steps: r.steps.map((s, i) => (i === view ? { ...s, ...patch } : s)) }));

  const finishRun = async (r: WorkflowRun, status: "completed" | "stopped") => {
    await update(() => ({ ...r, status, completedAt: new Date().toISOString() }), { immediate: true });
    router.push(`/runs/${run.id}/summary`);
  };

  const completeStep = async () => {
    if (!step || !rs) return;
    const now = new Date().toISOString();

    if (step.kind === "human") {
      const fields = materializeFields(run, step, rs.fields ?? {});
      const { effect, field } = decisionEffect(step, fields);
      if (field && !effect) {
        // Take the user to the decision instead of leaving a dead button.
        const el = document.getElementById("decision");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        el?.classList.remove("attention");
        void el?.offsetWidth;
        el?.classList.add("attention");
        return;
      }
      const base = (r: WorkflowRun): WorkflowRun => {
        const steps = r.steps.map((s, i) =>
          i === view
            ? {
                ...s,
                fields,
                response: renderHumanOutput(step, r, fields),
                responseSource: "form" as const,
                inputFiles: contextFiles(r, step).map((f) => f.name),
                inputsDigest: stepDigest(r, step),
                savedAt: now,
              }
            : s,
        );
        return { ...r, steps };
      };
      if (effect === "loop") {
        // Record the review, then let the server close this round and open the next one.
        await update((r) => base(r), { immediate: true });
        const res = await fetch(`/api/runs/${run.id}/next-round`, { method: "POST", body: JSON.stringify({ stepIndex: view }) });
        const json = await res.json();
        if (!res.ok) return toast.show(json.error ?? "Couldn’t start the next round.");
        await roundStarted(json.round);
        return;
      }
      if (effect === "pause") {
        await update((r) => ({ ...base(r), status: "paused", position: view }), { immediate: true });
        router.push("/?paused=1");
        return;
      }
      if (effect === "stop") {
        const r = base(run);
        const steps: RunStep[] = r.steps.map((s, i) =>
          i === view ? { ...s, status: "done" } : i > view ? { ...s, status: s.status === "done" ? s.status : "skipped" } : s,
        );
        await finishRun({ ...r, steps, position: view }, "stopped");
        return;
      }
      // continue
      const r = base(run);
      const steps: RunStep[] = r.steps.map((s, i) =>
        i === view ? { ...s, status: "done" } : s.status === "skipped" ? { ...s, status: "pending" } : s,
      );
      if (isLast) return finishRun({ ...r, steps }, "completed");
      await update(() => ({ ...r, steps, status: "in_progress", completedAt: null, position: view + 1 }), { immediate: true });
      go(view + 1);
      return;
    }

    if (!rs.response.trim()) return;
    const next = completeAiStep(run, view, now);
    if (isLast) return finishRun(next, "completed");
    const keepStatus = run.status === "completed" || run.status === "stopped" || run.status === "paused";
    await update(() => ({ ...next, status: keepStatus ? run.status : "in_progress", position: view + 1 }), { immediate: true });
    go(view + 1);
  };

  const decision = step?.kind === "human" ? decisionEffect(step, rs?.fields ?? {}) : null;
  const nextLabel = (() => {
    if (!step) return "";
    if (decision?.field) {
      if (!decision.effect) return "Choose what to do next";
      if (decision.effect === "pause") return "Save & pause";
      if (decision.effect === "stop") return "Save & finish here";
      if (decision.effect === "loop") return `Start round ${(run.round ?? 1) + 1}`;
    }
    if (isLast) return rs?.status === "done" ? "Save & view summary" : "Finish & see summary";
    return rs?.status === "done" ? `Continue to step ${view + 2}` : `Save & continue to step ${view + 2}`;
  })();
  // Human steps stay clickable: without a decision the button scrolls to it.
  const canContinue = locked === null && (step?.kind === "human" ? true : Boolean(rs?.response.trim()) && !busyHere);

  return (
    <>
      <TopBar
        right={
          <div className="row gap-12">
            <SaveIndicator state={saveState} />
            <span className="topbar-title small" title={`${run.title || t.title}\n${t.title} · ${run.tag}`}>
              {run.title || t.title}
            </span>
            <button
              className="btn sm ghost"
              title="Download the run JSON as it is now"
              aria-label="Download run JSON"
              onClick={async () => {
                await flush();
                const json = await fetch(`/api/runs/${run.id}`).then((r) => r.json());
                downloadText(`${slugify(run.title || run.id)}.run.json`, JSON.stringify(json.run, null, 2), "application/json");
              }}
            >
              <Icon name="download" />
            </button>
          </div>
        }
      >
        <ProgressBar
          segments={run.steps.map((s, i) => ({
            label: s.label,
            state: s.status,
            running: agentJobs.active?.stepIndex === i,
            breakpoint: (run.agentBreakpoints ?? []).includes(s.id),
          }))}
          current={view}
          maxReachable={maxReachable}
          onSelect={go}
          round={run.round}
        />
      </TopBar>

      <main className="page" key={view}>
        {run.rounds?.length ? <RoundBanner run={run} /> : null}
        {view === -1 ? (
          <SetupScreen
            run={run}
            onChange={(variables, title) => update((r) => ({ ...r, variables, title }))}
            onStart={async () => {
              await update(
                (r) => ({
                  ...r,
                  status: r.status === "setup" ? "in_progress" : r.status,
                  title: r.title.trim() || "Untitled run",
                  position: 0,
                }),
                { immediate: true },
              );
              go(0);
            }}
          />
        ) : step?.kind === "ai" ? (
          <AiStep run={run} step={step} index={view} patchStep={patchStep} agent={agent} saveEdit={saveEdit} onLock={setLocked} />
        ) : step ? (
          <HumanStep run={run} step={step} index={view} patchStep={patchStep} />
        ) : null}
      </main>

      {view >= 0 && step && (
        <footer className="footer-nav">
          <div className="footer-nav-inner">
            <button className="btn" onClick={() => go(view - 1)} disabled={view === 0} aria-label="Back">
              <Icon name="arrowLeft" /> <span className="hide-narrow">Back</span>
            </button>
            {view === 0 && !run.rounds?.length && (
              <button className="btn ghost hide-narrow" onClick={() => setView(-1)}>
                Edit question
              </button>
            )}
            <span className="spacer" />
            {(run.status === "completed" || run.status === "stopped") && (
              <Link className="btn ghost hide-narrow" href={`/runs/${run.id}/summary`}>
                Summary
              </Link>
            )}
            {!canContinue && (step.kind === "ai" || locked) && (
              <span className="small faint hide-narrow">
                {locked ? locked : busyHere ? "The agent is working on this step…" : "Run the agent or paste a reply to continue"}
              </span>
            )}
            <button className="btn primary big footer-primary" onClick={completeStep} disabled={!canContinue}>
              {nextLabel} <Icon name={decision?.field && !decision.effect ? "arrowDown" : decision?.effect === "pause" ? "pause" : decision?.effect === "loop" ? "refresh" : "arrowRight"} />
            </button>
          </div>
        </footer>
      )}
      {toast.node}
    </>
  );
}

/** Later rounds: what this one builds on, with links to the earlier rounds' results. */
function RoundBanner({ run }: { run: WorkflowRun }) {
  const rounds = run.rounds ?? [];
  const prev = rounds[rounds.length - 1];
  const carried = run.carryOver?.files.length ?? 0;
  return (
    <div className="round-banner">
      <Icon name="refresh" />
      <span>
        <strong>Round {run.round}</strong> · builds on round {prev.round}
        {carried ? ` (${carried} reports carried in)` : ""} · View{" "}
        {rounds.map((r, i) => (
          <span key={r.round}>
            {i > 0 ? ", " : ""}
            <Link href={`/runs/${run.id}/summary?round=${r.round}`}>round {r.round}</Link>
          </span>
        ))}
      </span>
    </div>
  );
}
