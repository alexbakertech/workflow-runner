"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, StatusChip, TopBar, downloadText, readFile, timeAgo, useToast } from "@/components/ui";
import type { RunListItem, TemplateEntry } from "@/lib/types";
import { slugify, workflowFileName } from "@/lib/workflow";

type TemplateRow = TemplateEntry & { runCount: number };

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [runs, setRuns] = useState<RunListItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [showFirstRunPanel, setShowFirstRunPanel] = useState(false);
  const [firstRunDismissed, setFirstRunDismissed] = useState<boolean | null>(null);
  const [hasUnloadedSamples, setHasUnloadedSamples] = useState<boolean | null>(null);
  const [hasSignedInProvider, setHasSignedInProvider] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([fetch("/api/templates").then((x) => x.json()), fetch("/api/runs").then((x) => x.json())]);
    setTemplates(t.templates);
    setRuns(r.runs);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFirstRunDismissed(localStorage.getItem("wr.firstRunDismissed") !== null);
    fetch("/api/samples")
      .then((res) => res.json())
      .then((json) => setHasUnloadedSamples(json.samples.some((sample: { loaded: boolean }) => !sample.loaded)))
      .catch(() => setHasUnloadedSamples(null));
    fetch("/api/agents")
      .then((res) => res.json())
      .then((json) => setHasSignedInProvider(json.providers.some((provider: { signedIn: boolean }) => provider.signedIn)))
      .catch(() => setHasSignedInProvider(null));
  }, []);

  useEffect(() => {
    setShowFirstRunPanel(firstRunDismissed === false && runs?.length === 0);
  }, [firstRunDismissed, runs]);

  // While an agent is working on any run, keep the list's progress current.
  const agentBusy = Boolean(runs?.some((r) => r.agentStep !== undefined));
  useEffect(() => {
    if (!agentBusy) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [agentBusy, load]);

  // Arriving from a paused run: confirm it was saved, then tidy the URL.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("paused")) {
      toast.show("Run paused and saved. Pick it up any time from Your runs.");
      window.history.replaceState(null, "", "/");
    }
  }, [toast.show]);

  async function startRun(hash: string) {
    setBusy(hash);
    const res = await fetch("/api/runs", { method: "POST", body: JSON.stringify({ templateHash: hash }) });
    const json = await res.json();
    if (res.ok) router.push(`/runs/${json.id}`);
    else {
      setBusy(null);
      setError({ message: json.error });
    }
  }

  async function importFile(file: File) {
    setError(null);
    let data: unknown;
    try {
      data = JSON.parse(await readFile(file));
    } catch {
      setError({ message: `${file.name} is not valid JSON.` });
      return;
    }
    setBusy("import");
    const res = await fetch("/api/import", { method: "POST", body: JSON.stringify({ data, fileName: file.name }) });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError({ message: json.error, details: json.details });
      return;
    }
    if (json.kind === "run") {
      router.push(`/runs/${json.id}/summary`);
      return;
    }
    await load();
    setHighlight(json.hash);
    // The card may be above the drop zone and off screen; bring it into view.
    setTimeout(() => document.getElementById(`tpl-${String(json.hash).slice(7, 19)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    toast.show(`Loaded “${json.title}”. Press Start run to begin.`);
  }

  async function removeTemplate(t: TemplateRow) {
    const note = t.runCount ? ` Your ${t.runCount} run${t.runCount === 1 ? "" : "s"} from it will be kept.` : "";
    if (!confirm(`Remove “${t.template.title}” from the workflow list?${note}`)) return;
    await fetch(`/api/templates?hash=${encodeURIComponent(t.hash)}`, { method: "DELETE" });
    load();
  }

  async function deleteRun(r: RunListItem) {
    if (!confirm(`Delete “${r.title || "Untitled run"}”? This removes the saved run file.`)) return;
    await fetch(`/api/runs/${r.id}`, { method: "DELETE" });
    load();
  }

  function dismissFirstRunPanel() {
    localStorage.setItem("wr.firstRunDismissed", "1");
    setFirstRunDismissed(true);
    setShowFirstRunPanel(false);
  }

  async function loadSampleRuns() {
    setBusy("samples");
    setError(null);
    try {
      const res = await fetch("/api/samples", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.loaded?.length) {
        const reason = json.skipped?.map((item: { reason: string }) => item.reason).filter(Boolean).join(" ");
        setError({ message: json.error || reason || "No sample runs were loaded." });
        setBusy(null);
        return;
      }
      dismissFirstRunPanel();
      await load();
      setBusy(null);
      const count = json.loaded.length;
      toast.show(`Loaded ${count} sample run${count === 1 ? "" : "s"}.`);
    } catch {
      setBusy(null);
      setError({ message: "Could not load sample runs." });
    }
  }

  async function downloadRun(r: RunListItem) {
    const { run } = await fetch(`/api/runs/${r.id}`).then((x) => x.json());
    downloadText(`${slugify(run.title || run.id)}.run.json`, JSON.stringify(run, null, 2), "application/json");
  }

  // Workflows that have runs, for the filter. Keyed by hash so edited versions stay distinct.
  const runWorkflows = useMemo(() => {
    const seen = new Map<string, { hash: string; title: string; tag: string; count: number }>();
    for (const r of runs ?? []) {
      const cur = seen.get(r.templateHash);
      if (cur) cur.count++;
      else seen.set(r.templateHash, { hash: r.templateHash, title: r.templateTitle || r.tag, tag: r.tag, count: 1 });
    }
    const list = [...seen.values()];
    // Same title twice means two versions; add the tag so they can be told apart.
    return list.map((w) => ({ ...w, label: list.some((o) => o !== w && o.title === w.title) ? `${w.title} (${w.tag})` : w.title }));
  }, [runs]);
  const activeFilter = runWorkflows.some((w) => w.hash === workflowFilter) ? workflowFilter : "";

  const visibleRuns = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (runs ?? []).filter((r) => {
      if (activeFilter && r.templateHash !== activeFilter) return false;
      const hay = `${r.title} ${r.templateTitle} ${r.tag} ${r.inputsText ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [runs, query, activeFilter]);
  const clearFilters = () => {
    setQuery("");
    setWorkflowFilter("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) importFile(f);
  };

  return (
    <>
      <TopBar />
      <main className="page stack gap-32">
        {showFirstRunPanel && (
          <section className="card card-pad stack gap-12 fade-in">
            <h2>Welcome to Workflow Runner</h2>
            <p className="muted">
              Each workflow step is a fresh AI session that only sees what it's meant to see. You can do every step by hand: copy the prompt into any chat app and paste the reply back. No sign-in needed.
            </p>
            {hasSignedInProvider === false && (
              <p className="muted">
                To have an agent do the steps for you, connect Claude, Codex or a local model in <Link href="/settings">Settings</Link>.
              </p>
            )}
            {hasUnloadedSamples === true ? (
              <div className="stack gap-8">
                <p className="muted">Want to see what a finished run looks like first?</p>
                <div className="row gap-8">
                  <button className="btn primary" onClick={loadSampleRuns} disabled={busy === "samples"}>
                    {busy === "samples" ? "Loading…" : "Load sample runs"}
                  </button>
                  <button className="btn ghost" onClick={dismissFirstRunPanel}>
                    Start empty
                  </button>
                </div>
              </div>
            ) : hasUnloadedSamples === false ? (
              <div>
                <button className="btn ghost" onClick={dismissFirstRunPanel}>
                  Got it
                </button>
              </div>
            ) : null}
          </section>
        )}
        <section className="stack gap-8 fade-in">
          <h1>Run an AI workflow, one fresh chat at a time</h1>
          <p className="muted" style={{ maxWidth: "62ch" }}>
            Pick a workflow, and this guide walks you through each session: copy the context and prompt into a new chat in
            any AI tool, paste the reply back, and move on. At the end you get a complete run file and a summary.
          </p>
        </section>

        <section className="stack gap-12">
          <h2>Available workflows</h2>

          {!templates ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : (
            <div className="stack gap-12">
              {templates.map((t) => (
                <div
                  key={t.hash}
                  id={`tpl-${t.hash.slice(7, 19)}`}
                  className="card card-pad stack gap-12 fade-in"
                  style={highlight === t.hash ? { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-ring)" } : undefined}
                >
                  <div className="template-head">
                    <div className="stack gap-4" style={{ flex: "1 1 320px", minWidth: 0 }}>
                      <h3 style={{ fontSize: 16.5 }}>{t.template.title}</h3>
                      {t.template.description && <p className="muted small">{t.template.description}</p>}
                    </div>
                    <div className="template-actions">
                      <button
                        className="btn"
                        title="Download this workflow to edit its prompts, then load it back in"
                        onClick={() => {
                          downloadText(workflowFileName(t.template), JSON.stringify(t.template, null, 2) + "\n", "application/json");
                          toast.show(`Downloaded ${workflowFileName(t.template)}`);
                        }}
                      >
                        <Icon name="download" /> Workflow JSON
                      </button>
                      <a className="btn" href={`/api/templates/bundle?hash=${encodeURIComponent(t.hash)}`} download title="Markdown prompts to follow this workflow by hand in any chat app">
                        <Icon name="download" /> Export prompt bundle
                      </a>
                      <button className="btn primary" onClick={() => startRun(t.hash)} disabled={busy === t.hash}>
                        <Icon name="play" /> {busy === t.hash ? "Starting…" : "Start run"}
                      </button>
                    </div>
                  </div>
                  <div className="row gap-8">
                    <span className="chip">{t.template.steps.length} steps</span>
                    <span className="chip">
                      {t.template.steps.filter((s) => s.kind === "ai").length} AI sessions ·{" "}
                      {t.template.steps.filter((s) => s.kind === "human").length} review
                    </span>
                    <span className="chip mono" title={t.hash}>
                      {t.tag}
                    </span>
                    {t.builtIn ? (
                      <span className="chip">Built-in</span>
                    ) : (
                      <span className="chip" title={t.sourceFile}>
                        <Icon name="file" /> {t.sourceFile}
                      </span>
                    )}
                    {t.runCount > 0 && <span className="chip accent">{t.runCount} run{t.runCount === 1 ? "" : "s"}</span>}
                    {!t.builtIn && (
                      <button
                        className="btn ghost sm danger push-right"
                        onClick={() => removeTemplate(t)}
                        title="Remove this workflow from the list"
                        aria-label="Remove workflow"
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {error && (
                <div className="callout danger fade-in" role="alert">
                  <Icon name="alert" />
                  <div className="stack gap-4" style={{ flex: 1 }}>
                    <strong>{error.message}</strong>
                    {error.details?.length ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {error.details.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <button className="btn ghost sm" onClick={() => setError(null)} aria-label="Dismiss" style={{ color: "inherit" }}>
                    ✕
                  </button>
                </div>
              )}

              <div
                className={`dropzone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <div className="drop-target" onClick={() => fileInput.current?.click()} role="button" tabIndex={0}>
                  <div className="stack gap-4" style={{ alignItems: "center" }}>
                    <Icon name="upload" className="icon" />
                    <strong>{busy === "import" ? "Reading file…" : "Load a JSON file"}</strong>
                    <span className="muted small">
                      Drop a workflow file to run it, or a finished run file to view its summary. Click to browse.
                    </span>
                  </div>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="stack gap-12">
          <div className="runs-head">
            <h2>Your runs</h2>
            {runs && runs.length > 1 && (
              <div className="runs-filters">
                <label className="search">
                  <Icon name="search" />
                  <input
                    className="input sm"
                    type="search"
                    placeholder="Search runs"
                    aria-label="Search runs"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                  />
                </label>
                {runWorkflows.length > 1 && (
                  <select
                    className="input sm select"
                    aria-label="Filter by workflow"
                    value={activeFilter}
                    onChange={(e) => setWorkflowFilter(e.target.value)}
                  >
                    <option value="">All workflows</option>
                    {runWorkflows.map((w) => (
                      <option key={w.hash} value={w.hash}>
                        {w.label} ({w.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          {!runs ? (
            <div className="skeleton" style={{ height: 80 }} />
          ) : runs.length === 0 ? (
            <p className="muted small">No runs yet. Start one above — it saves automatically as you go.</p>
          ) : visibleRuns.length === 0 ? (
            <div className="card card-pad row gap-12">
              <span className="muted small">
                No runs match{query.trim() ? ` “${query.trim()}”` : ""}
                {activeFilter ? " in this workflow" : ""}.
              </span>
              <button className="btn sm ghost push-right" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="card list">
              {visibleRuns.map((r) => {
                const pct = Math.round((r.progress.completed / Math.max(1, r.progress.total)) * 100);
                const finished = r.status === "completed" || r.status === "stopped";
                return (
                  <div key={r.id} className="list-item run-row">
                    <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={finished ? `/runs/${r.id}/summary` : `/runs/${r.id}`}
                        style={{ color: "var(--text)", fontWeight: 580, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {r.title || "Untitled run"}
                      </Link>
                      <div className="row gap-8 tiny muted">
                        <StatusChip status={r.status} />
                        {(r.round ?? 1) > 1 && <span className="chip">Round {r.round}</span>}
                        {r.agentStep !== undefined && (
                          <span className="chip accent" title="An agent is working on this run">
                            <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Agent on step {r.agentStep + 1}
                          </span>
                        )}
                        <span className="chip truncate" title={r.tag}>
                          {r.templateTitle || r.tag}
                        </span>
                        <span>updated {timeAgo(r.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="stack gap-4" style={{ alignItems: "flex-end" }}>
                      <div className="mini-bar" title={`${r.progress.completed}/${r.progress.total}`}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <span className="tiny faint">
                        {r.progress.completed}/{r.progress.total} steps{(r.round ?? 1) > 1 ? " this round" : ""}
                      </span>
                    </div>
                    <div className="row gap-4">
                      {finished ? (
                        <Link className="btn sm" href={`/runs/${r.id}/summary`}>
                          Summary
                        </Link>
                      ) : (
                        <Link className="btn sm primary" href={`/runs/${r.id}`}>
                          {r.status === "setup" ? "Set up" : "Resume"}
                        </Link>
                      )}
                      <button className="btn sm ghost" title="Download run JSON" aria-label="Download run JSON" onClick={() => downloadRun(r)}>
                        <Icon name="download" />
                      </button>
                      <button className="btn sm ghost danger" title="Delete run" aria-label="Delete run" onClick={() => deleteRun(r)}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      {toast.node}
    </>
  );
}
