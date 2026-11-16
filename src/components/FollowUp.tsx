"use client";

import { useState } from "react";
import type { WorkflowRun } from "@/lib/types";
import { extractQuestions, followUpsUsed, followUpVerdict } from "@/lib/workflow";
import { providerName } from "@/lib/agents";
import { Disclosure, Icon, Markdown, timeAgo } from "./ui";

/**
 * Shown when a step recommends more research: the open questions, a box for the user's own answers, and the ways to
 * continue. Work on the step itself is limited per round, to keep its inputs small: one quick follow-up (a research
 * session on just those questions), then one update with the user's answers. New rounds are always available.
 */
export function FollowUpCard({
  run,
  stepIndex,
  canQuick,
  onQuick,
  onAnswers,
  onRound,
  onClose,
}: {
  run: WorkflowRun;
  stepIndex: number;
  /** False when no agent is connected; the agent options need one. */
  canQuick: boolean;
  onQuick: (answers: string) => Promise<void>;
  onAnswers: (answers: string) => Promise<void>;
  onRound: (answers: string) => Promise<void>;
  /** Keep the step's result as final (true), or bring the options back (false). */
  onClose: (closed: boolean) => void;
}) {
  const [answers, setAnswers] = useState("");
  const [busy, setBusy] = useState<"agent" | "round" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verdict = followUpVerdict(run, stepIndex);
  if (!verdict) return null;
  const step = run.template.definition.steps[stepIndex];
  const rs = run.steps[stepIndex];
  const used = followUpsUsed(run, step.id);
  const researched = used.research;
  // Both follow-ups used: only a new round (or keeping the result) is left.
  const exhausted = used.research && used.answers;
  const nextRound = (run.round ?? 1) + 1;

  if (rs.followUpClosed)
    return (
      <div className="row gap-8 small muted">
        <Icon name="check" />
        <span>
          You kept this “{verdict.value}” result as final.{" "}
          <button className="disclosure" style={{ textDecoration: "underline" }} onClick={() => onClose(false)}>
            Show the follow-up options
          </button>
        </span>
      </div>
    );

  const questions = extractQuestions(rs.response, 5);
  const go = async (kind: "agent" | "round") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "round") await onRound(answers);
      else await (researched ? onAnswers : onQuick)(answers);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <section className="card card-pad stack gap-16 follow-up">
      <div className="stack gap-4">
        <span className="eyebrow">
          {step.label} · {verdict.signal.label}: {verdict.value}
        </span>
        <h2>Investigate further</h2>
        <p className="help">
          {exhausted
            ? "This round’s follow-ups are used: the questions were researched and the result was updated with your answers. To go further, start a new round; it builds on everything here."
            : researched
              ? "A quick follow-up already researched these questions this round. What’s left usually needs your input: add what you know, then update the result, or start a new round."
              : "Answer what you can first: your own facts often settle a question without more research. Then choose how to continue."}
        </p>
      </div>
      {questions.length > 0 && (
        <div className="stack gap-4">
          <span className="tiny muted">Open questions:</span>
          <ol className="asked-list small">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      <textarea
        className="textarea"
        rows={4}
        placeholder={researched && !exhausted ? "Your answers or new facts" : "Your answers or new facts (optional)"}
        value={answers}
        onChange={(e) => setAnswers(e.target.value)}
        disabled={busy !== null}
      />
      <div className="grid-2">
        {!exhausted && (
          <div className="card subtle card-pad stack gap-8">
            <strong>{researched ? "Update with my answers" : "Quick follow-up"}</strong>
            <span className="small muted">
              {researched
                ? `“${step.label}” runs again with your answers. No new research.`
                : `One research session on these questions, then “${step.label}” runs again with what it finds. Faster; the critic and verifiers don’t run.`}
            </span>
            <div className="row gap-8" style={{ marginTop: "auto" }}>
              <button
                className="btn primary"
                onClick={() => go("agent")}
                disabled={!canQuick || busy !== null || (researched && !answers.trim())}
                title={researched && !answers.trim() ? "Add your answers first" : undefined}
              >
                <Icon name="spark" /> {busy === "agent" ? "Starting…" : researched ? "Update the result" : "Start quick follow-up"}
              </button>
              {!canQuick && <span className="tiny muted">Needs an agent: connect one in Settings.</span>}
            </div>
          </div>
        )}
        <div className="card subtle card-pad stack gap-8">
          <strong>Full new round</strong>
          <span className="small muted">
            Round {nextRound} of this run starts again from the first step, building on everything so far: the reports, your
            review, this result and your answers.
          </span>
          <div className="row gap-8" style={{ marginTop: "auto" }}>
            <button className="btn" onClick={() => go("round")} disabled={busy !== null}>
              <Icon name="refresh" /> {busy === "round" ? "Starting…" : `Start round ${nextRound}`}
            </button>
          </div>
        </div>
      </div>
      {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      <div>
        <button className="disclosure" onClick={() => onClose(true)} disabled={busy !== null}>
          Keep this result as final
        </button>
      </div>
    </section>
  );
}

/** Quick follow-ups done this round: what was asked, what the user added, what the research found. */
export function FollowUpHistory({ run }: { run: WorkflowRun }) {
  const list = run.followUps ?? [];
  if (!list.length) return null;
  const labelOf = (id: string) => run.template.definition.steps.find((s) => s.id === id)?.label ?? id;
  return (
    <section className="stack gap-12">
      <h2>Follow-up research</h2>
      {list.map((f) => (
        <div key={f.n} className="card card-pad stack gap-12">
          <div className="row gap-8">
            <strong>
              Follow-up {f.n}
              {f.kind === "answers" ? " · your answers" : " · research"}
            </strong>
            <span className={`chip ${f.status === "done" ? "ok" : f.status === "failed" ? "danger" : ""}`}>
              {f.status === "done" ? "Done" : f.status === "failed" ? "Didn’t finish" : "Running"}
            </span>
            <span className="tiny muted">
              on “{labelOf(f.stepId)}” · {timeAgo(f.createdAt)}
              {f.agent ? ` · ${providerName(f.agent.provider)} · ${f.agent.toolCalls} web lookups` : ""}
            </span>
          </div>
          {f.questions.length > 0 && (
            <ol className="asked-list small">
              {f.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          )}
          <div className="stack gap-4">
            <span className="tiny muted">Your answers</span>
            <span className={f.answers ? "small" : "small faint"} style={{ whiteSpace: "pre-wrap" }}>
              {f.answers || "None given."}
            </span>
          </div>
          <div className="row gap-16">
            {f.research && (
              <Disclosure label="Research findings">
                <div className="card subtle card-pad">
                  <Markdown>{f.research}</Markdown>
                </div>
              </Disclosure>
            )}
            <Disclosure label={`“${labelOf(f.stepId)}” before this follow-up`}>
              <div className="card subtle card-pad">
                <Markdown>{f.previous}</Markdown>
              </div>
            </Disclosure>
          </div>
        </div>
      ))}
    </section>
  );
}
