"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { providerName, type AgentJob } from "@/lib/agents";
import type { RunStep, TemplateStep, WorkflowRun } from "@/lib/types";
import { detectSignals, outputTitle, wordCount } from "@/lib/workflow";
import { CopyButton, Icon, Markdown, downloadText } from "./ui";

const COLLAPSED = 560;

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

/**
 * A step's output as recorded. Read-only on purpose: changing it means choosing Edit or Redo, so later steps never
 * quietly end up built on a different version than the one shown.
 */
export function RecordedOutput({
  step,
  rs,
  job,
  onEdit,
  onRedo,
}: {
  run: WorkflowRun;
  step: TemplateStep;
  rs: RunStep;
  job: AgentJob | null;
  onEdit: () => void;
  onRedo: () => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useLayoutEffect(() => {
    setLong((body.current?.scrollHeight ?? 0) > COLLAPSED + 80);
  }, [rs.response]);

  const done = rs.status === "done";
  const signals = { ...rs.signals, ...detectSignals(rs.response, step.signals) };
  const agentJob = job && rs.agent?.jobId === job.id ? job : null;
  const words = rs.wordCount ?? wordCount(rs.response);

  return (
    <div className="card record-card">
      <div className="record-head">
        <div className="stack gap-4 record-meta">
          <div className="row gap-8">
            <span
              className={`record-badge ${done ? "done" : "review"}`}
              title={rs.savedAt || rs.agent?.finishedAt ? `${done ? "Recorded" : "Written"} ${fmtTime(rs.savedAt ?? rs.agent?.finishedAt)}` : undefined}
            >
              <Icon name={done ? "check" : "spark"} /> {done ? "Recorded" : "Ready for review"}
            </span>
            <h3 style={{ fontSize: 15.5 }}>{outputTitle(step)}</h3>
            <span className="mono tiny faint">{step.output.file}</span>
          </div>
          <div className="row gap-8 tiny muted">
            {rs.responseSource === "agent" && rs.agent ? (
              <span
                className="chip accent"
                title={[`Session ${rs.agent.sessionId ?? "n/a"}`, rs.agent.trimmed ? "Chat the agent added around the file was removed." : ""]
                  .filter(Boolean)
                  .join("\n")}
              >
                <Icon name="spark" /> {providerName(rs.agent.provider)} · {rs.agent.model}
              </span>
            ) : rs.responseSource === "upload" ? (
              <span className="chip truncate" title={rs.uploadedFileName}>
                <Icon name="upload" /> {rs.uploadedFileName ?? "Uploaded"}
              </span>
            ) : (
              <span className="chip">
                <Icon name="chat" /> Pasted
              </span>
            )}
            <span>{words.toLocaleString()} words</span>
            {rs.agent && rs.responseSource === "agent" && (
              <span>
                {duration(rs.agent.durationMs)}
                {rs.agent.toolCalls ? ` · ${rs.agent.toolCalls} web lookup${rs.agent.toolCalls === 1 ? "" : "s"}` : ""}
              </span>
            )}
            {rs.editedAt && (
              <span className="chip warn" title={`Edited ${fmtTime(rs.editedAt)}`}>
                <Icon name="edit" /> Edited
              </span>
            )}
            {(step.signals ?? []).map((sig) =>
              signals[sig.key] ? (
                <span key={sig.key} className={`chip ${sig.warnOn?.includes(signals[sig.key]) ? "warn" : "ok"}`}>
                  <span className="dot" /> {sig.label}: {signals[sig.key]}
                </span>
              ) : null,
            )}
          </div>
        </div>
        <div className="row gap-4 record-actions">
          <CopyButton text={rs.response} label="Copy" copiedLabel="Copied" small />
          <button className="btn sm ghost" title={`Download ${step.output.file}`} aria-label={`Download ${step.output.file}`} onClick={() => downloadText(step.output.file, rs.response)}>
            <Icon name="download" />
          </button>
          <button className="btn sm" onClick={onEdit}>
            <Icon name="edit" /> Edit
          </button>
          <button className="btn sm" onClick={onRedo}>
            <Icon name="refresh" /> Redo
          </button>
        </div>
      </div>

      {!done && (
        <div className="record-note">
          <Icon name="alert" />
          <div className="stack gap-4">
            <span>
              Read it through, then continue below. {agentJob?.stoppedBecause ? <>The agent stopped here: {agentJob.stoppedBecause}</> : null}
            </span>
            {agentJob?.warnings?.map((w) => (
              <strong key={w} style={{ color: "var(--warn)" }}>
                {w}
              </strong>
            ))}
          </div>
        </div>
      )}

      <div ref={body} className={`record-body ${long && !expanded ? "collapsed" : ""}`} style={long && !expanded ? { maxHeight: COLLAPSED } : undefined}>
        <Markdown>{rs.response}</Markdown>
      </div>
      {long && (
        <button className="record-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show the full output"}
        </button>
      )}
    </div>
  );
}
