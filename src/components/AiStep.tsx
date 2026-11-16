"use client";

import { useEffect, useRef, useState } from "react";
import { fixableVerdict, isActive, providerName } from "@/lib/agents";
import type { RunStep, TemplateStep, WorkflowRun } from "@/lib/types";
import {
  buildContext,
  contextFiles,
  detectSignals,
  renderTemplate,
  resolvedPrompt,
  stepDigest,
  wordCount,
  type ContextFile,
} from "@/lib/workflow";
import { AgentPanel, type AgentControls } from "./AgentPanel";
import { FollowUpCard } from "./FollowUp";
import { RecordedOutput } from "./RecordedOutput";
import { CopyButton, Disclosure, Icon, downloadText, formatBytes, readFile } from "./ui";

type Mode = "agent" | "manual";
const MODE_KEY = "wr.stepMode";

interface Props {
  run: WorkflowRun;
  step: TemplateStep;
  index: number;
  patchStep: (patch: Partial<RunStep>) => void;
  /** Saves a deliberate edit of a recorded reply. */
  saveEdit: (text: string) => void;
  /** Holds the footer while an edit or redo is open; the reason is shown next to it. */
  onLock: (reason: string | null) => void;
  agent?: AgentControls;
}

/** Later steps that were completed using this step's output. */
function dependents(run: WorkflowRun, step: TemplateStep) {
  return run.template.definition.steps.filter(
    (s, i) => run.steps[i]?.status === "done" && [...(s.inputs ?? []), ...(s.optionalInputs ?? [])].includes(step.id),
  );
}

function confirmChange(run: WorkflowRun, step: TemplateStep, verb: string): boolean {
  const deps = dependents(run, step);
  if (!deps.length) return true;
  const names = deps.map((d) => `“${d.label}”`).join(", ");
  return confirm(
    `${verb} this output? ${names} ${deps.length === 1 ? "was" : "were"} built on the recorded version and will be flagged as out of date until redone.`,
  );
}

export function AiStep({ run, step, index, patchStep, saveEdit, onLock, agent }: Props) {
  const rs = run.steps[index];
  const files = contextFiles(run, step);
  const missing = files.filter((f) => !f.content.trim());
  const stale = rs.status === "done" && rs.inputsDigest && rs.inputsDigest !== stepDigest(run, step);
  const hasResponse = rs.response.trim().length > 0;
  const agentsReady = Boolean(agent?.providers?.some((p) => p.installed && p.signedIn));
  const agentBusy = Boolean(agent?.job && isActive(agent.job));

  const [mode, setModeState] = useState<Mode | null>(null);
  // While redoing, remember what was recorded and which agent job was last, to tell when a new reply has arrived.
  const [redoFrom, setRedoFrom] = useState<{ response: string; jobId: string | null } | null>(null);
  const redo = redoFrom !== null;
  const setRedo = (on: boolean) => setRedoFrom(on ? { response: rs.response, jobId: agent?.job?.id ?? null } : null);
  const [editText, setEditText] = useState<string | null>(null);

  // Remember the preferred way of working across steps and runs.
  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "agent" || saved === "manual") setModeState(saved);
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };
  const effectiveMode: Mode = agentBusy ? "agent" : !agentsReady ? "manual" : (mode ?? "agent");

  const editing = editText !== null;
  // Hold the footer during an edit, and during a redo until a new reply replaces the recorded one.
  const redoPending = redo && rs.response === redoFrom.response;
  useEffect(() => {
    onLock(editing ? "Save or cancel your edit first" : redoPending ? "Redo the step, or keep the recorded output" : null);
  }, [editing, redoPending, onLock]);
  useEffect(() => () => onLock(null), [onLock]);

  // Finished steps, and replies an agent just delivered, are shown as a record rather than an editable box.
  const showRecord = !editing && !redo && !agentBusy && hasResponse && (rs.status === "done" || rs.responseSource === "agent");
  // Once an agent delivers the redo, show its reply as the new record.
  const job = agent?.job;
  useEffect(() => {
    if (redoFrom && job && job.id !== redoFrom.jobId && job.status === "succeeded" && rs.response !== redoFrom.response) setRedoFrom(null);
  }, [redoFrom, job, rs.response]);

  const startEdit = () => {
    if (rs.status === "done" && !confirmChange(run, step, "Edit")) return;
    setEditText(rs.response);
  };
  const startRedo = () => {
    if (rs.status === "done" && !confirmChange(run, step, "Redo")) return;
    setRedo(true);
  };

  return (
    <div className="stack gap-24 fade-in">
      <div className="stack gap-8">
        <span className="eyebrow">
          Step {index + 1} of {run.steps.length} · AI session
        </span>
        <h1>{step.label}</h1>
        {step.description && <p className="muted" style={{ maxWidth: "70ch" }}>{step.description}</p>}
      </div>

      {stale && (
        <div className="callout warn">
          <Icon name="alert" />
          <div className="stack gap-8" style={{ flex: 1 }}>
            <div>
              <strong>An earlier step changed after this one was recorded.</strong> This output was built on the old version.
              Redo it so the run stays consistent.
            </div>
            {showRecord && (
              <div>
                <button className="btn sm" onClick={() => setRedo(true)}>
                  <Icon name="refresh" /> Redo this step
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {missing.length > 0 && !showRecord && (
        <div className="callout warn">
          <Icon name="alert" />
          <div>
            <strong>Some inputs are empty:</strong> {missing.map((m) => m.name).join(", ")}. Complete those steps first, or the
            AI won’t have what it needs.
          </div>
        </div>
      )}

      {editing ? (
        <EditReply
          step={step}
          text={editText}
          setText={setEditText}
          onCancel={() => setEditText(null)}
          onSave={() => {
            saveEdit(editText);
            setEditText(null);
          }}
        />
      ) : showRecord ? (
        <>
          <RecordedOutput run={run} step={step} rs={rs} job={agent?.job ?? null} onEdit={startEdit} onRedo={startRedo} />
          <Signals run={run} step={step} index={index} rs={rs} patchStep={patchStep} agent={agentsReady && !agent?.active ? agent : undefined} />
          <Checklist step={step} rs={rs} patchStep={patchStep} />
          {agent && !agent.active && (
            <FollowUpCard
              run={run}
              stepIndex={index}
              canQuick={agentsReady}
              onQuick={(answers) => agent.followUp(index, answers, "research")}
              onAnswers={(answers) => agent.followUp(index, answers, "answers")}
              onRound={(answers) => agent.nextRound(index, answers)}
              onClose={(closed) => agent.closeFollowUp(index, closed)}
            />
          )}
        </>
      ) : (
        <>
          <div className="row gap-12 mode-row">
            {agentsReady ? (
              <div className="seg-control mode-toggle" role="tablist" aria-label="How to do this step">
                <button role="tab" aria-selected={effectiveMode === "agent"} className={effectiveMode === "agent" ? "on" : ""} onClick={() => setMode("agent")}>
                  <Icon name="spark" /> Agent
                </button>
                <button
                  role="tab"
                  aria-selected={effectiveMode === "manual"}
                  className={effectiveMode === "manual" ? "on" : ""}
                  onClick={() => setMode("manual")}
                  disabled={agentBusy}
                  title={agentBusy ? "The agent is working on this step" : undefined}
                >
                  <Icon name="chat" /> By hand
                </button>
              </div>
            ) : (
              <span className="small muted">
                Do this step in any AI chat.{" "}
                <a href="/settings" className="small">
                  Connect an agent
                </a>{" "}
                to have it done for you.
              </span>
            )}
            <span className="small muted mode-hint">
              {effectiveMode === "agent" ? "An agent runs this step as a fresh session and records its reply." : "Copy the inputs into a new chat and paste the reply back."}
            </span>
            {redo && hasResponse && (
              <button className="btn sm ghost push-right" onClick={() => setRedo(false)}>
                Keep the recorded output
              </button>
            )}
          </div>

          {effectiveMode === "agent" && agent ? (
            <AgentPanel run={run} step={step} index={index} agent={agent}>
              <InputsAndPrompt run={run} step={step} rs={rs} files={files} patchStep={patchStep} />
            </AgentPanel>
          ) : (
            <ManualSteps run={run} step={step} rs={rs} files={files} patchStep={patchStep} redo={redo} />
          )}
          {effectiveMode === "manual" && hasResponse && <Signals run={run} step={step} index={index} rs={rs} patchStep={patchStep} />}
          {effectiveMode === "manual" && <Checklist step={step} rs={rs} patchStep={patchStep} />}
        </>
      )}
    </div>
  );
}

// ---------- Inputs and prompt (shared by both modes) ----------

function InputChips({ run, step, rs, files, patchStep }: { run: WorkflowRun; step: TemplateStep; rs: RunStep; files: ContextFile[]; patchStep: Props["patchStep"] }) {
  const fileOf = (id: string) => run.steps.find((s) => s.id === id)?.outputFile ?? id;
  const toggleOptional = (id: string) => {
    const cur = rs.includedOptional ?? [];
    patchStep({ includedOptional: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  return (
    <>
      {files.length > 0 && (
        <div className="row gap-8">
          {files.map((f) => (
            <span key={f.stepId} className={`chip ${f.content.trim() ? "" : "warn"}`} title={f.optional ? "Optional input" : undefined}>
              <Icon name="file" className="icon" />
              {f.name}
              <span className="faint">· {f.content.trim() ? formatBytes(f.content.length) : "empty"}</span>
            </span>
          ))}
        </div>
      )}
      {step.optionalInputs?.length ? (
        <div className="row gap-8 small">
          <span className="muted">Optional extra context:</span>
          {step.optionalInputs.map((id) => {
            const on = rs.includedOptional?.includes(id);
            return (
              <button key={id} type="button" className={`chip toggle ${on ? "on" : ""}`} onClick={() => toggleOptional(id)}>
                {on ? "✓" : "+"} {fileOf(id)}
              </button>
            );
          })}
          <span className="tiny faint">Add these if claim-level detail is needed.</span>
        </div>
      ) : null}
    </>
  );
}

function PromptEditor({ run, step, rs, patchStep }: { run: WorkflowRun; step: TemplateStep; rs: RunStep; patchStep: Props["patchStep"] }) {
  const [editing, setEditing] = useState(false);
  const prompt = resolvedPrompt(run, step);
  if (editing)
    return (
      <div className="stack gap-8 fade-in">
        <textarea className="textarea response" value={prompt} onChange={(e) => patchStep({ promptOverride: e.target.value })} style={{ minHeight: 320 }} />
        <div className="row gap-8">
          <button className="btn sm" onClick={() => setEditing(false)}>
            Done editing
          </button>
          {rs.promptOverride != null && (
            <button
              className="btn sm ghost"
              onClick={() => {
                patchStep({ promptOverride: undefined });
                setEditing(false);
              }}
            >
              Reset to workflow prompt
            </button>
          )}
          <span className="tiny faint">Changes apply to this run only and are recorded in the output file.</span>
        </div>
      </div>
    );
  return (
    <Disclosure
      label="Preview prompt"
      actions={
        <>
          <button className="disclosure" onClick={() => setEditing(true)}>
            <Icon name="edit" /> Edit prompt
          </button>
          {rs.promptOverride != null && <span className="chip warn">Edited for this run</span>}
        </>
      }
    >
      <div className="preview">{prompt}</div>
    </Disclosure>
  );
}

function InputsAndPrompt({ run, step, rs, files, patchStep }: { run: WorkflowRun; step: TemplateStep; rs: RunStep; files: ContextFile[]; patchStep: Props["patchStep"] }) {
  const context = buildContext(files);
  return (
    <div className="stack gap-8">
      <span className="tiny muted">The agent gets</span>
      <InputChips run={run} step={step} rs={rs} files={files} patchStep={patchStep} />
      <div className="row gap-16">
        {files.length > 0 && (
          <Disclosure label="Preview inputs">
            <div className="preview">{context}</div>
          </Disclosure>
        )}
        <PromptEditor run={run} step={step} rs={rs} patchStep={patchStep} />
      </div>
    </div>
  );
}

// ---------- By hand ----------

function ManualSteps({
  run,
  step,
  rs,
  files,
  patchStep,
  redo,
}: {
  run: WorkflowRun;
  step: TemplateStep;
  rs: RunStep;
  files: ContextFile[];
  patchStep: Props["patchStep"];
  redo: boolean;
}) {
  const [copiedContext, setCopiedContext] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // A redo starts from an empty box; the recorded reply is only replaced once a new one is pasted.
  const [draft, setDraft] = useState<string | null>(redo ? "" : null);
  const fileInput = useRef<HTMLInputElement>(null);

  const context = buildContext(files);
  const prompt = resolvedPrompt(run, step);
  const hasContext = files.length > 0 || (step.optionalInputs?.length ?? 0) > 0;
  const value = draft ?? rs.response;
  const hasResponse = value.trim().length > 0;
  const words = wordCount(value);

  const setResponse = (text: string, source: "paste" | "upload", fileName?: string) => {
    if (draft !== null) {
      setDraft(text);
      if (!text.trim()) return;
    }
    const auto = detectSignals(text, step.signals);
    // Keep manually chosen values for signals we can't detect automatically.
    const manual = Object.fromEntries(Object.entries(rs.signals ?? {}).filter(([k]) => !(k in auto)));
    patchStep({
      response: text,
      responseSource: source,
      uploadedFileName: source === "upload" ? fileName : undefined,
      wordCount: wordCount(text),
      signals: { ...manual, ...auto },
      // A replaced reply needs completing again.
      ...(rs.status === "done" ? { status: "pending" as const } : {}),
    });
    if (draft !== null) setDraft(null);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploadError(null);
    if (!/\.(md|markdown|txt)$/i.test(file.name) && !file.type.startsWith("text/")) {
      setUploadError(`${file.name} doesn’t look like a Markdown or text file.`);
      return;
    }
    setResponse((await readFile(file)).replace(/\r\n/g, "\n"), "upload", file.name);
  };

  // Task progress: highlight the next thing to do.
  const t1 = copiedContext || copiedPrompt || hasResponse;
  const t2 = copiedContext || hasResponse;
  const t3 = copiedPrompt || hasResponse;
  const tasks = hasContext ? [t1, t2, t3, hasResponse] : [t1, t3, hasResponse];
  const active = tasks.findIndex((d) => !d);
  const cls = (i: number) => `task ${tasks[i] ? "is-done" : ""} ${active === i ? "is-active" : ""}`;
  let n = 0;

  return (
    <div className="card">
      <div className={cls(n++)}>
        <span className="task-num">{tasks[0] ? <Icon name="check" /> : 1}</span>
        <div className="task-body">
          <div className="task-title">Open a brand-new chat</div>
          <p className="muted small">
            In ChatGPT, Claude, Gemini or any assistant you like. Don’t reuse an earlier chat from this run — each session must
            start without memory of the others.
          </p>
        </div>
      </div>

      {hasContext && (
        <div className={cls(n++)}>
          <span className="task-num">{tasks[1] ? <Icon name="check" /> : 2}</span>
          <div className="task-body">
            <div className="task-title">Copy the context and paste it into the chat</div>
            <p className="muted small">
              {files.length === 1 ? "This is the report" : `These are the ${files.length} reports`}{" "}
              {files.some((f) => f.stepId.startsWith("carry:")) && (run.round ?? 1) > 1
                ? `from round ${(run.round ?? 1) - 1}`
                : "produced by earlier steps"}
              .
              Paste {files.length === 1 ? "it" : "them"} first — don’t send yet.
            </p>
            <InputChips run={run} step={step} rs={rs} files={files} patchStep={patchStep} />
            <div className="row gap-8">
              <CopyButton
                text={context}
                label="Copy context"
                copiedLabel="Context copied"
                primary={!copiedContext}
                big
                disabled={!files.length}
                onCopied={() => setCopiedContext(true)}
              />
              <button
                className="btn ghost sm"
                title="Download the files instead, if you prefer attaching them"
                onClick={() => files.forEach((f, i) => setTimeout(() => downloadText(f.name, f.content), i * 250))}
              >
                <Icon name="download" /> Download as files
              </button>
            </div>
            <Disclosure label="Preview context">
              <div className="preview">{context || "(empty)"}</div>
            </Disclosure>
          </div>
        </div>
      )}

      <div className={cls(n++)}>
        <span className="task-num">{tasks[hasContext ? 2 : 1] ? <Icon name="check" /> : n}</span>
        <div className="task-body">
          <div className="task-title">Copy the prompt, paste it {hasContext ? "below the context" : "into the chat"}, and send</div>
          <p className="muted small">
            {hasContext
              ? "Both go into the same message: context on top, prompt underneath. Then press send and wait for the full reply."
              : "Paste it as your first message and press send. Wait for the full reply."}
          </p>
          <div className="row gap-8">
            <CopyButton
              text={prompt}
              label="Copy prompt"
              copiedLabel="Prompt copied"
              primary={hasContext ? copiedContext && !copiedPrompt : !copiedPrompt}
              big
              onCopied={() => setCopiedPrompt(true)}
            />
          </div>
          <PromptEditor run={run} step={step} rs={rs} patchStep={patchStep} />
        </div>
      </div>

      <div className={cls(n++)}>
        <span className="task-num">{hasResponse ? <Icon name="check" /> : n}</span>
        <div className="task-body">
          <div className="task-title">Paste the AI’s full reply here</div>
          <p className="muted small">
            Use the chat’s copy button on the reply so formatting is kept. If the AI produced a file called{" "}
            <code className="mono">{step.output.file}</code>, you can upload it instead.
          </p>
          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              if (!e.dataTransfer.files?.length) return;
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            <textarea
              className="textarea response"
              placeholder={`Paste the reply for ${step.output.file} here…`}
              value={value}
              onChange={(e) => setResponse(e.target.value, "paste")}
              spellCheck={false}
            />
            {dragging && <div className="drop-overlay">Drop .md file to use it as the reply</div>}
          </div>
          <div className="row gap-8 small">
            <button className="btn sm" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" /> Upload .md
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {rs.responseSource === "upload" && rs.uploadedFileName && draft === null && (
              <span className="chip truncate" title={rs.uploadedFileName}>
                <Icon name="file" /> {rs.uploadedFileName}
              </span>
            )}
            {hasResponse && (
              <span className="row gap-8 push-right">
                <span className={`chip ${step.wordLimit && words > step.wordLimit * 1.1 ? "warn" : ""}`} title="Approximate word count">
                  {words.toLocaleString()} words{step.wordLimit ? ` / ${step.wordLimit} max` : ""}
                </span>
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    if (words < 40 || confirm("Clear the pasted reply? This can’t be undone.")) setResponse("", "paste");
                  }}
                >
                  Clear
                </button>
              </span>
            )}
          </div>
          {uploadError && <span className="small" style={{ color: "var(--danger)" }}>{uploadError}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------- Deliberate edit of a recorded reply ----------

function EditReply({ step, text, setText, onSave, onCancel }: { step: TemplateStep; text: string; setText: (t: string) => void; onSave: () => void; onCancel: () => void }) {
  const words = wordCount(text);
  return (
    <div className="card edit-card fade-in">
      <div className="card-head">
        <Icon name="edit" />
        <h3 style={{ fontSize: 15.5 }}>Editing {step.output.file}</h3>
        <span className="spacer" />
        <span className="tiny muted">{words.toLocaleString()} words</span>
      </div>
      <div className="card-body stack gap-12">
        <textarea className="textarea response" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoFocus style={{ minHeight: 420 }} />
        <div className="row gap-8">
          <span className="tiny muted" style={{ flex: 1, minWidth: 200 }}>
            Nothing changes until you save. The run records that this output was edited.
          </span>
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={onSave} disabled={!text.trim()}>
            <Icon name="check" /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Signals and checklist ----------

function Signals({
  run,
  step,
  index,
  rs,
  patchStep,
  agent,
}: {
  run: WorkflowRun;
  step: TemplateStep;
  index: number;
  rs: RunStep;
  patchStep: Props["patchStep"];
  /** Set when an agent is free to make the correction. */
  agent?: AgentControls;
}) {
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  if (!step.signals?.length || !rs.response.trim()) return null;
  const detected = detectSignals(rs.response, step.signals);
  const locked = rs.status === "done";
  const verdict = agent ? fixableVerdict(run, index) : null;
  const target = verdict ? run.template.definition.steps[verdict.targetIndex] : null;
  const fixWith = rs.agent?.provider ?? agent?.settings?.defaultProvider;
  const fix = async () => {
    if (!agent || !target) return;
    // The correction replaces the checked step's output; anything else built on it goes out of date.
    const deps = dependents(run, target).filter((d) => d.id !== step.id);
    if (deps.length && !confirm(`Correct “${target.label}”? ${deps.map((d) => `“${d.label}”`).join(", ")} ${deps.length === 1 ? "was" : "were"} built on the current version and will be flagged as out of date until redone.`))
      return;
    setFixing(true);
    setFixError(null);
    try {
      await agent.fix(index);
    } catch (e) {
      setFixError((e as Error).message);
      setFixing(false);
    }
  };
  return (
    <div className="stack gap-8">
      {step.signals.map((sig) => {
        const value = detected[sig.key] ?? rs.signals?.[sig.key];
        const warn = value && sig.warnOn?.includes(value);
        return (
          <div key={sig.key} className="stack gap-8">
            {!detected[sig.key] && (
              <div className="row gap-8 small">
                <span className="muted">{sig.label}:</span>
                <span className="faint">not found in the reply —</span>
                <select
                  className="input sm select"
                  value={rs.signals?.[sig.key] ?? ""}
                  disabled={locked}
                  onChange={(e) => patchStep({ signals: { ...(rs.signals ?? {}), [sig.key]: e.target.value } })}
                >
                  <option value="">choose…</option>
                  {sig.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            )}
            {warn && verdict?.signal.key === sig.key && target ? (
              <div className="callout warn">
                <Icon name="alert" />
                <div className="stack gap-8" style={{ flex: 1 }}>
                  <div>
                    <strong>
                      {sig.label}: {value}.
                    </strong>{" "}
                    The check flagged claims in “{target.label}”. The agent can take this report back to that step, correct just the
                    flagged claims, and run the check again. Or continue below and carry the flag forward: later steps are told about it.
                  </div>
                  <div className="row gap-8">
                    <button className="btn sm primary" onClick={fix} disabled={fixing}>
                      <Icon name="spark" /> {fixing ? "Starting…" : "Fix with the agent"}
                    </button>
                    {fixWith && (
                      <span className="tiny muted">
                        Uses {providerName(fixWith)}
                        {rs.agent ? ", like this check" : ""}.
                      </span>
                    )}
                  </div>
                  {fixError && <span className="small" style={{ color: "var(--danger)" }}>{fixError}</span>}
                </div>
              </div>
            ) : warn ? (
              <div className="callout warn">
                <Icon name="alert" />
                <div>
                  <strong>
                    {sig.label}: {value}.
                  </strong>{" "}
                  {sig.warning ? renderTemplate(sig.warning, run.variables) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Checklist({ step, rs, patchStep }: { step: TemplateStep; rs: RunStep; patchStep: Props["patchStep"] }) {
  if (!step.checklist?.length) return null;
  return (
    <div className="card card-pad stack gap-8">
      <div className="row">
        <h3>Quick spot-check</h3>
        <span className="tiny faint">optional · recorded in the run</span>
      </div>
      <p className="muted small">Skim the reply before moving on. If something is badly off, redo the step.</p>
      <div className="stack">
        {step.checklist.map((item, i) => {
          const checked = Boolean(rs.checklist?.[i]);
          return (
            <label key={i} className={`check ${checked ? "checked" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = [...(rs.checklist ?? step.checklist!.map(() => false))];
                  next[i] = !checked;
                  patchStep({ checklist: next });
                }}
              />
              <span>{item}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
