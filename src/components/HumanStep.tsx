"use client";

import { useState } from "react";
import type { FieldValue, HumanField, QuestionsValue, RunStep, TemplateStep, WorkflowRun } from "@/lib/types";
import { contextFiles, extractQuestions, isQuestionsValue, outputTitle, questionsRaised, renderHumanOutput, stepDigest } from "@/lib/workflow";
import { Disclosure, Icon, Markdown } from "./ui";

interface Props {
  run: WorkflowRun;
  step: TemplateStep;
  index: number;
  patchStep: (patch: Partial<RunStep>) => void;
}

/** Questions for a field: stored ones if present, otherwise pulled from the source step's reply. */
export function questionsFor(run: WorkflowRun, field: Extract<HumanField, { type: "questions" }>, value?: FieldValue): QuestionsValue {
  const src = run.steps.find((s) => s.id === field.fromStep)?.response ?? "";
  const extracted = extractQuestions(src, field.count ?? 3);
  const stored = isQuestionsValue(value) ? value : null;
  const questions = stored?.questions.length ? stored.questions : extracted;
  const n = Math.max(questions.length, stored?.answers.length ?? 0, questions.length ? 0 : field.count ?? 3);
  return { questions, answers: Array.from({ length: n }, (_, i) => stored?.answers[i] ?? "") };
}

/** Field values with question text filled in, ready to save into the run. */
export function materializeFields(run: WorkflowRun, step: TemplateStep, values: Record<string, FieldValue>) {
  const out: Record<string, FieldValue> = { ...values };
  for (const f of step.fields ?? []) if (f.type === "questions") out[f.key] = questionsFor(run, f, values[f.key]);
  return out;
}

export function HumanStep({ run, step, index, patchStep }: Props) {
  const rs = run.steps[index];
  const docs = contextFiles(run, step);
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const recorded = rs.status === "done" && !editing;
  const laterDone = run.template.definition.steps.filter(
    (s, i) => i > index && run.steps[i]?.status === "done" && (s.inputs ?? []).includes(step.id),
  );
  const startEdit = () => {
    if (
      laterDone.length &&
      !confirm(
        `Edit your answers? ${laterDone.map((d) => `“${d.label}”`).join(", ")} ${laterDone.length === 1 ? "was" : "were"} built on them and will be flagged as out of date until redone.`,
      )
    )
      return;
    setEditing(true);
  };
  const values = rs.fields ?? {};
  const stale = rs.status === "done" && rs.inputsDigest && rs.inputsDigest !== stepDigest(run, step);
  const defOf = (id: string) => run.template.definition.steps.find((s) => s.id === id);
  const labelOf = (id: string) => {
    const d = defOf(id);
    return d ? outputTitle(d) : id;
  };

  const setField = (key: string, value: FieldValue) => {
    const fields = materializeFields(run, step, { ...values, [key]: value });
    patchStep({ fields, response: renderHumanOutput(step, run, fields), responseSource: "form" });
  };

  return (
    <div className="stack gap-24 fade-in">
      <div className="stack gap-8">
        <span className="eyebrow">
          Step {index + 1} of {run.steps.length} · Your turn — no AI in this step
        </span>
        <h1>{step.label}</h1>
        {step.description && <p className="muted" style={{ maxWidth: "70ch" }}>{step.description}</p>}
      </div>

      {stale && (
        <div className="callout warn">
          <Icon name="alert" />
          <div>
            <strong>The summaries changed after you completed this review.</strong> Re-read them and check that your answers
            still apply.
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="card">
          <div className="tabs">
            {docs.map((d, i) => (
              <button key={d.stepId} className={`tab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>
                {labelOf(d.stepId)}
              </button>
            ))}
          </div>
          <div className="doc-scroll">
            {docs[tab]?.content.trim() ? (
              <Markdown>{docs[tab].content}</Markdown>
            ) : (
              <p className="muted">This step has no reply yet.</p>
            )}
          </div>
        </div>
      )}

      {recorded && (
        <div className="card record-card">
          <div className="record-head">
            <div className="row gap-8" style={{ flex: 1, minWidth: 0 }}>
              <span className="record-badge done">
                <Icon name="check" /> Recorded
              </span>
              <h3 style={{ fontSize: 15.5 }}>Your answers</h3>
              <span className="mono tiny faint">{step.output.file}</span>
            </div>
            <button className="btn sm" onClick={startEdit}>
              <Icon name="edit" /> Edit answers
            </button>
          </div>
          <div className="record-body">
            <Markdown>{rs.response}</Markdown>
          </div>
        </div>
      )}

      {editing && (
        <div className="callout info">
          <Icon name="edit" />
          <div>
            <strong>Editing your recorded answers.</strong> Use the button at the bottom to save them and carry on.
          </div>
        </div>
      )}

      {!recorded && (step.fields ?? []).map((field) => {
        if (field.type === "questions") {
          const q = questionsFor(run, field, values[field.key]);
          return (
            <div key={field.key} className="card card-pad stack gap-16">
              <div className="stack gap-4">
                <h2>{field.label}</h2>
                {field.help && <p className="help">{field.help}</p>}
                {!q.questions.length && (
                  <p className="small" style={{ color: "var(--warn)" }}>
                    Couldn’t find the questions automatically — read them in “{labelOf(field.fromStep)}” above and answer in order.
                  </p>
                )}
              </div>
              {q.answers.map((a, i) => (
                <label key={i} className="field">
                  <span className="label" style={{ fontWeight: 560 }}>
                    <span className="muted">Q{i + 1}.</span> {q.questions[i] ?? `Question ${i + 1}`}
                  </span>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Your answer, or leave blank for “Unknown”"
                    value={a}
                    onChange={(e) => {
                      const answers = [...q.answers];
                      answers[i] = e.target.value;
                      setField(field.key, { questions: q.questions, answers });
                    }}
                  />
                </label>
              ))}
            </div>
          );
        }
        if (field.type === "text") {
          const asked = field.questionsFrom ? questionsRaised(run, field.questionsFrom) : [];
          return (
            <div key={field.key} className="card card-pad stack gap-12">
              <div className="stack gap-4">
                <h2>{field.label}</h2>
                {field.help && <p className="help">{field.help}</p>}
              </div>
              {field.questionsFrom &&
                (asked.length ? (
                  <div className="stack gap-4">
                    <span className="tiny muted">The summary asks:</span>
                    <ol className="asked-list small">
                      {asked.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p className="small muted">Read the questions in “{labelOf(field.questionsFrom)}” above.</p>
                ))}
              <textarea
                className="textarea"
                rows={field.questionsFrom ? 6 : 4}
                placeholder={field.placeholder}
                value={String(values[field.key] ?? "")}
                onChange={(e) => setField(field.key, e.target.value)}
              />
            </div>
          );
        }
        return (
          <div key={field.key} id="decision" className="card card-pad stack gap-12" style={{ scrollMarginTop: 140 }}>
            <div className="stack gap-4">
              <h2>{field.label}</h2>
              {field.help && <p className="help">{field.help}</p>}
            </div>
            <div className="choices" role="radiogroup">
              {field.options.map((o) => {
                const selected = values[field.key] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`choice ${selected ? "selected" : ""}`}
                    onClick={() => setField(field.key, o.value)}
                  >
                    <span className="radio" />
                    <span className="stack gap-4">
                      <strong>{o.label}</strong>
                      {o.description && <span className="small muted">{o.description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {!recorded && (
        <Disclosure label={`Preview ${step.output.file}`}>
          <div className="card card-pad">
            <Markdown>{renderHumanOutput(step, run, materializeFields(run, step, values))}</Markdown>
          </div>
        </Disclosure>
      )}
    </div>
  );
}
