"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CopyButton, Disclosure, Icon, Markdown, ProgressBar, StatusChip, TopBar, downloadText, timeAgo } from "@/components/ui";
import { FollowUpCard, FollowUpHistory } from "@/components/FollowUp";
import { useProviders } from "@/components/useAgent";
import { useRun } from "@/components/useRun";
import type { RunStep, TemplateStep, Verification, WorkflowRun } from "@/lib/types";
import { providerName } from "@/lib/agents";
import { carriedName, detectSignal, isQuestionsValue, latestFollowUpStep, outputTitle, roundView, slugify, wordCount } from "@/lib/workflow";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { run: full, verification, notFound, update } = useRun(id);
  // ?round=N shows an earlier round as it was when it ended; without it, the current round.
  const asked = Number(useSearchParams().get("round")) || null;
  const past = full && asked ? roundView(full, asked) : null;
  const run = past ?? full;
  const finished = Boolean(past) || full?.status === "completed" || full?.status === "stopped";
  const { providers } = useProviders();
  const canQuick = Boolean(providers?.some((p) => p.installed && p.signedIn));

  // Only finished rounds have a summary; send anything else back to where it left off.
  useEffect(() => {
    if (full && !finished) router.replace(`/runs/${full.id}`);
  }, [full, finished, router]);

  if (notFound)
    return (
      <>
        <TopBar wide />
        <main className="page stack gap-12">
          <h1>Run not found</h1>
          <Link href="/">← Back to start</Link>
        </main>
      </>
    );
  if (!run || !full || !finished)
    return (
      <>
        <TopBar wide />
        <main className="page wide stack gap-16">
          <div className="skeleton" style={{ height: 32, width: "50%" }} />
          <div className="skeleton" style={{ height: 300 }} />
        </main>
      </>
    );

  const t = run.template.definition;
  const pairs = t.steps.map((def, i) => ({ def, rs: run.steps[i] })).filter((p) => p.rs);
  const done = pairs.filter((p) => p.rs.status === "done" && p.rs.response.trim());
  const featured = done.filter((p) => p.def.feature);
  const outcome = featured[featured.length - 1];
  const highlights = featured.slice(0, -1);
  const human = done.filter((p) => p.def.kind === "human");
  const signals = done.flatMap((p) =>
    (p.def.signals ?? []).flatMap((s) => {
      const v = p.rs.signals?.[s.key] ?? detectSignal(p.rs.response, s);
      return v ? [{ step: p.def.label, label: s.label, value: v, warn: Boolean(s.warnOn?.includes(v)) }] : [];
    }),
  );
  // A step recommending more research offers a quick follow-up or the next round (current round only).
  const followUpStep = past ? -1 : latestFollowUpStep(run);
  const post = async (path: string, body: object) => {
    const res = await fetch(`/api/runs/${run.id}/${path}`, { method: "POST", body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  };

  // With several rounds, files are named as they are carried forward, e.g. round-1_01_research.md.
  const fileName = (f: string) => (full.rounds?.length ? carriedName(run.round ?? 1, f) : f);
  // Fetch the saved file so the download carries the server-computed seal.
  const downloadJson = async () => {
    const json = await fetch(`/api/runs/${run.id}`).then((r) => r.json());
    downloadText(`${slugify(run.title || run.id)}.run.json`, JSON.stringify(json.run, null, 2), "application/json");
  };

  const reopen = async () => {
    await update(
      (r) => ({
        ...r,
        status: "in_progress",
        completedAt: null,
        steps: r.steps.map((s) => (s.status === "skipped" ? { ...s, status: "pending" } : s)),
      }),
      { immediate: true },
    );
    router.push(`/runs/${run.id}`);
  };

  return (
    <>
      <TopBar
        wide
        right={
          <div className="row gap-8">
            <button className="btn sm" onClick={downloadJson}>
              <Icon name="download" /> Run JSON
            </button>
          </div>
        }
      >
        <ProgressBar
          segments={run.steps.map((s) => ({ label: s.label, state: s.status }))}
          current={-1}
          maxReachable={-1}
          caption={past ? `Round ${past.round} summary` : "Run summary"}
        />
      </TopBar>

      <main className="page wide stack gap-24 fade-in">
        {/* Header */}
        <section className="stack gap-12">
          <div className="row gap-8">
            <span className="eyebrow">{full.rounds?.length ? `Round ${run.round} summary` : "Run summary"}</span>
            <StatusChip status={past ? "continued" : run.status} />
          </div>
          <h1>{run.title || "Untitled run"}</h1>
          <div className="stack gap-8">
            {t.variables
              .filter((v) => run.variables[v.key]?.trim())
              .map((v) => (
                <div key={v.key} className="stack gap-4">
                  <span className="tiny muted">{v.label}</span>
                  <span style={{ fontSize: 16 }}>{run.variables[v.key]}</span>
                </div>
              ))}
          </div>
          <div className="row gap-8 small muted">
            <span className="chip mono" title={run.template.hash}>
              {run.tag}
            </span>
            <span>
              {t.title} v{t.version.replace(/^v/i, "")}
            </span>
            <span>·</span>
            <span>started {fmtDate(run.roundStartedAt ?? run.createdAt)}</span>
            {run.completedAt && (
              <>
                <span>·</span>
                <span>
                  {past ? "round ended" : run.status === "stopped" ? "stopped" : "finished"} {fmtDate(run.completedAt)}
                </span>
              </>
            )}
          </div>
        </section>

        {full.rounds?.length ? <RoundTabs full={full} shown={run.round ?? 1} /> : null}
        {(past || (run.round ?? 1) > 1) && (
          <div className="callout info">
            <Icon name="refresh" />
            <div>
              {(run.round ?? 1) > 1 && (
                <>
                  Round {run.round} built on round {(run.round ?? 1) - 1}
                  {run.carryOver?.files.length ? `, with its ${run.carryOver.files.length} reports and your review as input` : ""}.{" "}
                </>
              )}
              {past && (
                <>
                  At your review you chose to run another round, so the remaining steps were skipped.{" "}
                  <Link href={(past.round ?? 1) + 1 === (full.round ?? 1) ? `/runs/${full.id}` : `/runs/${full.id}/summary?round=${(past.round ?? 1) + 1}`}>
                    Go to round {(past.round ?? 1) + 1}
                  </Link>
                  .
                </>
              )}
            </div>
          </div>
        )}
        {run.status === "stopped" && !past && (
          <div className="callout danger">
            <Icon name="stop" />
            <div>
              <strong>You stopped the investigation at your review.</strong> Remaining steps were skipped.{" "}
              <button className="disclosure" style={{ color: "inherit", textDecoration: "underline" }} onClick={reopen}>
                Reopen the run
              </button>{" "}
              to continue.
            </div>
          </div>
        )}
        {run.status === "paused" && (
          <div className="callout warn">
            <Icon name="pause" />
            <div>
              <strong>This run is paused at your review.</strong> <Link href={`/runs/${run.id}`}>Resume it</Link> when you’re
              ready.
            </div>
          </div>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <section className="grid-2">
            {signals.map((s, i) => (
              <div key={i} className="card card-pad stat">
                <span className="tiny muted">
                  {s.step} · {s.label}
                </span>
                <span className="row gap-8">
                  <span className={`chip ${s.warn ? "warn" : "ok"}`} style={{ fontSize: 14, height: 28 }}>
                    <span className="dot" /> {s.value}
                  </span>
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Outcome */}
        {outcome && (
          <section className="card">
            <div className="card-head row">
              <div className="stack gap-4">
                <span className="eyebrow">
                  {run.status === "completed" ? "Outcome" : "Latest result"} · {outcome.def.label}
                </span>
                <h2>{outputTitle(outcome.def)}</h2>
              </div>
              <span className="spacer" />
              <CopyButton text={outcome.rs.response} label="Copy" />
            </div>
            <div className="card-body">
              <Markdown>{outcome.rs.response}</Markdown>
            </div>
          </section>
        )}

        {followUpStep >= 0 && (
          <FollowUpCard
            run={run}
            stepIndex={followUpStep}
            canQuick={canQuick}
            onQuick={async (answers) => {
              await post("follow-up", { stepIndex: followUpStep, answers, kind: "research" });
              router.push(`/runs/${run.id}?step=${followUpStep}`);
            }}
            onAnswers={async (answers) => {
              await post("follow-up", { stepIndex: followUpStep, answers, kind: "answers" });
              router.push(`/runs/${run.id}?step=${followUpStep}`);
            }}
            onClose={(closed) =>
              update(
                (r) => ({ ...r, steps: r.steps.map((s, i) => (i === followUpStep ? { ...s, followUpClosed: closed || undefined } : s)) }),
                { immediate: true },
              )
            }
            onRound={async (answers) => {
              await post("next-round", { stepIndex: followUpStep, answers });
              router.push(`/runs/${run.id}`);
            }}
          />
        )}
        <FollowUpHistory run={run} />

        {highlights.length > 0 && <Highlights items={highlights} />}

        {/* Human answers */}
        {human.map(({ def, rs }) => (
          <HumanAnswers key={def.id} def={def} rs={rs} run={run} />
        ))}

        {/* Verification */}
        <IntegrityCard run={run} verification={verification} />

        {/* All steps */}
        <section className="stack gap-12">
          <div className="row">
            <h2>Every step</h2>
            <span className="spacer" />
            <button
              className="btn sm ghost"
              onClick={() =>
                done.forEach((p, i) => setTimeout(() => downloadText(fileName(p.rs.outputFile), p.rs.response), i * 250))
              }
              disabled={!done.length}
            >
              <Icon name="download" /> All .md files
            </button>
          </div>
          <div className="card list">
            {pairs.map(({ def, rs }, i) => (
              <StepRow key={def.id} def={def} rs={rs} index={i} runId={run.id} fileName={fileName} readOnly={Boolean(past)} />
            ))}
          </div>
        </section>

        <div className="row">
          <Link href="/" className="btn ghost">
            <Icon name="arrowLeft" /> All runs
          </Link>
          <span className="spacer" />
          <button className="btn primary big" onClick={downloadJson}>
            <Icon name="download" /> Download run JSON
          </button>
        </div>
      </main>
    </>
  );
}

function Highlights({ items }: { items: { def: TemplateStep; rs: RunStep }[] }) {
  const [tab, setTab] = useState(0);
  const cur = items[Math.min(tab, items.length - 1)];
  return (
    <section className="card">
      <div className="tabs">
        {items.map((p, i) => (
          <button key={p.def.id} className={`tab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>
            {outputTitle(p.def)}
          </button>
        ))}
      </div>
      <div className="doc-scroll" style={{ maxHeight: 560 }}>
        <Markdown>{cur.rs.response}</Markdown>
      </div>
    </section>
  );
}

function HumanAnswers({ def, rs, run }: { def: TemplateStep; rs: RunStep; run: WorkflowRun }) {
  const fields = rs.fields ?? {};
  const labelOf = (id: string) => {
    const d = run.template.definition.steps.find((s) => s.id === id);
    return d ? outputTitle(d) : id;
  };
  return (
    <section className="card">
      <div className="card-head row">
        <div className="stack gap-4">
          <span className="eyebrow">{def.label}</span>
          <h2>Your answers and decision</h2>
        </div>
      </div>
      <div className="card-body stack gap-16">
        {(def.fields ?? []).map((f) => {
          const v = fields[f.key];
          if (f.type === "questions") {
            const q = isQuestionsValue(v) ? v : { questions: [], answers: [] };
            return (
              <div key={f.key} className="stack gap-8">
                <h3>
                  {f.label} <span className="tiny faint">from {labelOf(f.fromStep)}</span>
                </h3>
                {q.answers.length === 0 && <span className="small muted">No answers recorded.</span>}
                {q.answers.map((a, i) => (
                  <div key={i} className="stack gap-4" style={{ paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
                    <span className="small muted">
                      Q{i + 1}. {q.questions[i] ?? ""}
                    </span>
                    <span className={a.trim() ? "" : "faint"}>{a.trim() || "Unknown"}</span>
                  </div>
                ))}
              </div>
            );
          }
          if (f.type === "text")
            return (
              <div key={f.key} className="stack gap-4">
                <h3>{f.label}</h3>
                <span className={String(v ?? "").trim() ? "" : "faint"} style={{ whiteSpace: "pre-wrap" }}>
                  {String(v ?? "").trim() || "None"}
                </span>
              </div>
            );
          const opt = f.options.find((o) => o.value === v);
          return (
            <div key={f.key} className="stack gap-4">
              <h3>Decision</h3>
              <span>
                <span className={`chip ${opt?.effect === "stop" ? "danger" : opt?.effect === "pause" ? "warn" : opt?.effect === "loop" ? "accent" : "ok"}`}>
                  <span className="dot" /> {opt?.label ?? "Not chosen"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IntegrityCard({ run, verification }: { run: WorkflowRun; verification: Verification | null }) {
  const iv = run.importVerification;
  const short = (h?: string) => (h ? h.replace("sha256:", "").slice(0, 16) + "…" : "—");
  const Row = ({ ok, title, detail }: { ok: boolean | null; title: string; detail: React.ReactNode }) => (
    <div className="row gap-12" style={{ alignItems: "flex-start" }}>
      <span className={`chip ${ok === null ? "" : ok ? "ok" : "danger"}`} style={{ marginTop: 1 }}>
        <Icon name={ok ? "check" : "alert"} /> {ok === null ? "Not sealed" : ok ? "Valid" : "Mismatch"}
      </span>
      <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
        <strong className="small">{title}</strong>
        <span className="tiny muted" style={{ overflowWrap: "anywhere" }}>
          {detail}
        </span>
      </div>
    </div>
  );
  return (
    <section className="card card-pad stack gap-16">
      <div className="row gap-8">
        <Icon name="shield" />
        <h2>File integrity</h2>
      </div>
      <Row
        ok={verification?.templateHashOk ?? null}
        title="Workflow definition matches its fingerprint"
        detail={
          <>
            Tag <span className="mono">{run.tag}</span> · <span className="mono">{short(run.template.hash)}</span> · source file{" "}
            {run.template.sourceFile}. Runs started from the same workflow file share this tag.
          </>
        }
      />
      <Row
        ok={verification?.contentHashOk ?? null}
        title="Run content matches its seal"
        detail={
          <>
            <span className="mono">{short(run.integrity?.contentHash)}</span> · sealed {fmtDate(run.integrity?.computedAt)}. The seal
            is recomputed every time the app saves; a mismatch means the file was edited outside the app.
          </>
        }
      />
      {iv && (
        <div className={`callout ${iv.templateHashOk && iv.contentHashOk !== false ? "ok" : "warn"}`}>
          <Icon name={iv.templateHashOk && iv.contentHashOk !== false ? "check" : "alert"} />
          <div>
            Imported from <strong>{iv.sourceFile}</strong> {timeAgo(iv.importedAt)}. At import the workflow fingerprint was{" "}
            {iv.templateHashOk ? "valid" : "invalid"} and the content seal was{" "}
            {iv.contentHashOk === null ? "missing" : iv.contentHashOk ? "valid" : "invalid (file was modified)"}.
          </div>
        </div>
      )}
    </section>
  );
}

function StepRow({
  def,
  rs,
  index,
  runId,
  fileName,
  readOnly,
}: {
  def: TemplateStep;
  rs: RunStep;
  index: number;
  runId: string;
  fileName: (f: string) => string;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const has = rs.response.trim().length > 0;
  return (
    <div className="stack" style={{ borderTop: index ? "1px solid var(--border)" : undefined }}>
      <div className="list-item" style={{ borderTop: 0 }}>
        <span className={`map-num ${def.kind === "human" ? "human" : ""}`} style={{ flex: "none" }}>
          {rs.status === "done" ? <Icon name="check" /> : index + 1}
        </span>
        <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
          <strong>{def.label}</strong>
          <div className="row gap-8 tiny muted">
            <span className="mono">{fileName(rs.outputFile)}</span>
            {rs.status === "skipped" && <span className="chip">skipped</span>}
            {rs.status === "pending" && <span className="chip">not done</span>}
            {has && <span>{(rs.wordCount ?? wordCount(rs.response)).toLocaleString()} words</span>}
            {rs.savedAt && <span>saved {fmtDate(rs.savedAt)}</span>}
            {rs.responseSource === "upload" && rs.uploadedFileName && <span>uploaded {rs.uploadedFileName}</span>}
            {rs.responseSource === "agent" && rs.agent && (
              <span className="chip accent" title={`${Math.round(rs.agent.durationMs / 1000)}s · ${rs.agent.toolCalls} web lookups · session ${rs.agent.sessionId ?? "n/a"}`}>
                <Icon name="spark" /> {providerName(rs.agent.provider)} · {rs.agent.model}
              </span>
            )}
            {rs.promptOverride != null && <span className="chip warn">prompt edited</span>}
            {(rs.checklist ?? []).some(Boolean) && (
              <span>
                spot-checked {(rs.checklist ?? []).filter(Boolean).length}/{def.checklist?.length ?? 0}
              </span>
            )}
          </div>
        </div>
        <div className="row gap-4">
          {has && (
            <button className="btn sm" onClick={() => setOpen(!open)}>
              {open ? "Hide" : "View"}
            </button>
          )}
          {has && (
            <button className="btn sm ghost" title={`Download ${fileName(rs.outputFile)}`} aria-label={`Download ${fileName(rs.outputFile)}`} onClick={() => downloadText(fileName(rs.outputFile), rs.response)}>
              <Icon name="download" />
            </button>
          )}
          {!readOnly && (
            <Link className="btn sm ghost" title="Open this step" aria-label="Open this step" href={`/runs/${runId}?step=${index}`}>
              <Icon name="edit" />
            </Link>
          )}
        </div>
      </div>
      {open && (
        <div className="fade-in stack gap-12" style={{ padding: "0 22px 20px 62px" }}>
          {rs.prompt && (
            <Disclosure label="Prompt used">
              <div className="preview">{rs.prompt}</div>
            </Disclosure>
          )}
          {rs.inputFiles?.length ? <span className="tiny muted">Context: {rs.inputFiles.join(", ")}</span> : null}
          <div className="card subtle card-pad">
            <Markdown>{rs.response}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

/** One tab per round; earlier rounds are read-only, the current one opens the run if it's still going. */
function RoundTabs({ full, shown }: { full: WorkflowRun; shown: number }) {
  const current = full.round ?? 1;
  const going = full.status !== "completed" && full.status !== "stopped";
  return (
    <nav className="round-tabs" aria-label="Rounds">
      {(full.rounds ?? []).map((r) => (
        <Link
          key={r.round}
          href={`/runs/${full.id}/summary?round=${r.round}`}
          className={`round-tab ${shown === r.round ? "active" : ""}`}
          aria-current={shown === r.round ? "page" : undefined}
        >
          Round {r.round}
          <span className="tiny faint">ended {fmtDate(r.endedAt)}</span>
        </Link>
      ))}
      <Link
        href={going ? `/runs/${full.id}` : `/runs/${full.id}/summary`}
        className={`round-tab ${shown === current ? "active" : ""}`}
        aria-current={shown === current ? "page" : undefined}
      >
        Round {current}
        <span className="tiny faint">{going ? "in progress" : `${full.status === "stopped" ? "stopped" : "finished"} ${fmtDate(full.completedAt)}`}</span>
      </Link>
    </nav>
  );
}
