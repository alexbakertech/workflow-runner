"use client";

import { useState } from "react";
import type { WorkflowRun } from "@/lib/types";
import { suggestTitle } from "@/lib/workflow";
import { Icon } from "./ui";

export function SetupScreen({
  run,
  onChange,
  onStart,
}: {
  run: WorkflowRun;
  onChange: (vars: Record<string, string>, title: string) => void;
  onStart: () => void;
}) {
  const t = run.template.definition;
  const [touchedTitle, setTouchedTitle] = useState(Boolean(run.title));
  const [tried, setTried] = useState(false);
  const missing = t.variables.filter((v) => v.required && !run.variables[v.key]?.trim());
  const fileOf = (id: string) => t.steps.find((s) => s.id === id)?.output.file ?? id;

  const setVar = (key: string, value: string) => {
    const vars = { ...run.variables, [key]: value };
    onChange(vars, touchedTitle ? run.title : suggestTitle(t, vars));
  };

  return (
    <div className="stack gap-24 fade-in">
      <div className="stack gap-8">
        <span className="eyebrow">Before you start</span>
        <h1>{t.title}</h1>
        {t.description && <p className="muted" style={{ maxWidth: "68ch" }}>{t.description}</p>}
      </div>

      {t.intro?.length ? (
        <div className="card card-pad stack gap-12">
          <h2>How this works</h2>
          <ol className="intro-list">
            {t.intro.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="card card-pad stack gap-16">
        <div className="row">
          <h2>The {t.steps.length} steps</h2>
          <span className="spacer" />
          <span className="chip mono" title={run.template.hash}>
            {run.tag}
          </span>
        </div>
        <div className="workflow-map">
          {t.steps.map((s, i) => (
            <div key={s.id} className="map-item">
              <span className={`map-num ${s.kind === "human" ? "human" : ""}`}>{i + 1}</span>
              <div className="stack gap-4" style={{ paddingTop: 3 }}>
                <div className="row gap-8">
                  <strong>{s.label}</strong>
                  <span className={`chip ${s.kind === "human" ? "warn" : ""}`} style={{ height: 20, fontSize: 11.5 }}>
                    {s.kind === "human" ? "You" : "New AI chat"}
                  </span>
                </div>
                {s.description && <span className="small muted">{s.description}</span>}
                <span className="tiny faint">
                  {s.inputs?.length ? <>Uses {s.inputs.map(fileOf).join(", ")} → </> : <>Uses your question → </>}
                  produces {s.output.file}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad stack gap-16">
        <h2>What are you investigating?</h2>
        {t.variables.map((v) => {
          const err = tried && v.required && !run.variables[v.key]?.trim();
          return (
            <label key={v.key} className="field">
              <span className="label">
                {v.label} {v.required && <span style={{ color: "var(--danger)" }}>*</span>}
              </span>
              {v.multiline ? (
                <textarea
                  className="textarea"
                  rows={3}
                  id={`var-${v.key}`}
                  value={run.variables[v.key] ?? ""}
                  placeholder={v.placeholder}
                  onChange={(e) => setVar(v.key, e.target.value)}
                  style={err ? { borderColor: "var(--danger)" } : undefined}
                />
              ) : (
                <input
                  className="input"
                  id={`var-${v.key}`}
                  value={run.variables[v.key] ?? ""}
                  placeholder={v.placeholder}
                  onChange={(e) => setVar(v.key, e.target.value)}
                  style={err ? { borderColor: "var(--danger)" } : undefined}
                />
              )}
              {v.help && <span className="help">{v.help}</span>}
            </label>
          );
        })}
        <label className="field">
          <span className="label">Run title</span>
          <input
            className="input"
            value={run.title}
            placeholder="A short name for this run"
            onChange={(e) => {
              setTouchedTitle(true);
              onChange(run.variables, e.target.value);
            }}
          />
          <span className="help">Shown on your runs list and in the exported file.</span>
        </label>
      </div>

      <div className="row">
        {tried && missing.length > 0 && (
          <span className="small" style={{ color: "var(--danger)" }}>
            Please fill in: {missing.map((m) => m.label).join(", ")}
          </span>
        )}
        <span className="spacer" />
        <button
          className="btn primary big"
          onClick={() => {
            setTried(true);
            if (!missing.length) return onStart();
            const el = document.getElementById(`var-${missing[0].key}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.focus({ preventScroll: true });
          }}
        >
          Start step 1 <Icon name="arrowRight" />
        </button>
      </div>
    </div>
  );
}
