"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------- Icons ----------
const paths: Record<string, string> = {
  copy: "M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M5.5 8h9A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5v-9A1.5 1.5 0 0 1 5.5 8Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  upload: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15",
  download: "M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15",
  arrowRight: "M5 12h14m0 0l-6-6m6 6l-6 6",
  arrowLeft: "M19 12H5m0 0l6-6m-6 6l6 6",
  arrowDown: "M12 5v14m0 0l-6-6m6 6l6-6",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.75-1.75L20 20",
  chat: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17h0A2.5 2.5 0 0 1 4 14.5v-8Z",
  file: "M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5L14 3.5Zm0 0V7.5h4",
  shield: "M12 3.5l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5l7-3Zm-3 8.5l2 2 4-4",
  alert: "M12 9v4m0 3.5v.01M10.3 4.3L3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
  edit: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Zm9.5-13.5l4 4",
  trash: "M5 7h14M10 11v6m4-6v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7",
  play: "M8 5.5v13l10.5-6.5L8 5.5Z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  pause: "M9 5v14M15 5v14",
  stop: "M6.5 6.5h11v11h-11z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  spark: "M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9L12 3.5ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  x: "M6 6l12 12M18 6L6 18",
  key: "M14.5 10a4.5 4.5 0 1 0-4.4 4.5L12 16.5h2v2h2v2h3.5V17l-5.6-5.6c.4-.4.6-.9.6-1.4ZM8.5 8.5h.01",
  refresh: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4",
};

export function Icon({ name, className = "icon" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name] ?? ""} />
    </svg>
  );
}

// ---------- Clipboard ----------
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function CopyButton({
  text,
  label,
  copiedLabel = "Copied",
  primary,
  big,
  small,
  onCopied,
  disabled,
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  primary?: boolean;
  big?: boolean;
  small?: boolean;
  onCopied?: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn ${primary ? "primary" : ""} ${big ? "big" : ""} ${small ? "sm" : ""} ${copied ? "copied" : ""}`}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          onCopied?.();
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2200);
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} />
      {copied ? copiedLabel : label}
    </button>
  );
}

// ---------- Files ----------
export function downloadText(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function formatBytes(n: number) {
  if (n < 1000) return `${n} chars`;
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k chars`;
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------- Disclosure ----------
export function Disclosure({
  label,
  children,
  defaultOpen = false,
  actions,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Extra controls kept on the same line as the toggle. */
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="stack gap-8">
      <div className="row gap-16">
        <button type="button" className={`disclosure ${open ? "open" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="chev">›</span> {label}
        </button>
        {actions}
      </div>
      {open && <div className="fade-in">{children}</div>}
    </div>
  );
}

// ---------- Markdown ----------
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// ---------- Toast ----------
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(t.current);
    // Longer messages stay up long enough to read.
    t.current = setTimeout(() => setMsg(null), Math.min(7000, 2200 + m.length * 45));
  }, []);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return { show, node };
}

// ---------- Progress bar ----------
export interface ProgressSegment {
  label: string;
  state: "done" | "pending" | "skipped";
  /** An agent is working on this step right now. */
  running?: boolean;
  /** An auto-advancing agent stops before this step. */
  breakpoint?: boolean;
}

export function ProgressBar({
  segments,
  current,
  maxReachable,
  onSelect,
  caption,
  round,
}: {
  caption?: React.ReactNode;
  /** Shown before the step count from round 2 on. */
  round?: number;
  segments: ProgressSegment[];
  current: number;
  maxReachable: number;
  onSelect?: (i: number) => void;
}) {
  const done = segments.filter((s) => s.state === "done").length;
  const pct = Math.round((done / Math.max(1, segments.length)) * 100);
  return (
    <div className="progress">
      <div className="progress-meta">
        <span>
          {current >= 0 ? (
            <>
              {round && round > 1 ? <>Round {round} · </> : null}Step <strong style={{ color: "var(--text)" }}>{current + 1}</strong> of {segments.length}
            </>
          ) : (
            <>{caption ?? "Getting started"} · {segments.length} steps</>
          )}
        </span>
        <span>
          {done} of {segments.length} complete · {pct}%
        </span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={segments.length} aria-valuenow={done}>
        {segments.map((s, i) => {
          const clickable = Boolean(onSelect) && i <= maxReachable && i !== current;
          return (
            <button
              key={i}
              type="button"
              title={`${i + 1}. ${s.label}${s.running ? " (agent working)" : ""}`}
              className={`progress-seg ${s.state} ${s.running ? "running" : ""} ${i === current ? "current" : ""} ${clickable ? "clickable" : ""}`}
              onClick={() => clickable && onSelect?.(i)}
              tabIndex={clickable ? 0 : -1}
              aria-label={`Step ${i + 1}: ${s.label}`}
            />
          );
        })}
      </div>
      <div className="progress-labels">
        {segments.map((s, i) => {
          const clickable = Boolean(onSelect) && i <= maxReachable && i !== current;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={`progress-label ${s.state} ${i === current ? "current" : ""} ${clickable ? "clickable" : ""}`}
              onClick={() => clickable && onSelect?.(i)}
              title={s.breakpoint ? "The agent stops before this step" : undefined}
            >
              {s.breakpoint && <Icon name="pause" className="icon bp-icon" />}
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TopBar({ children, right, wide }: { children?: React.ReactNode; right?: React.ReactNode; wide?: boolean }) {
  return (
    <header className="topbar">
      <div className={`topbar-inner ${wide ? "wide" : ""}`}>
        <div className="row">
          <Link href="/" className="brand">
            <span className="brand-mark">W</span> Workflow Runner
          </Link>
          <span className="spacer" />
          {right}
          <Link href="/settings" className="btn sm ghost" title="Settings: agents and access token" aria-label="Settings">
            <Icon name="gear" />
          </Link>
        </div>
        {children}
      </div>
    </header>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    setup: ["Not started", ""],
    in_progress: ["In progress", "accent"],
    paused: ["Paused", "warn"],
    stopped: ["Stopped", "danger"],
    completed: ["Completed", "ok"],
    continued: ["Continued in next round", "ok"],
  };
  const [label, cls] = map[status] ?? [status, ""];
  return (
    <span className={`chip ${cls}`}>
      <span className="dot" /> {label}
    </span>
  );
}
