"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Verification, WorkflowRun } from "@/lib/types";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

/** Loads a run and autosaves every change (debounced), with saves queued in order. */
export function useRun(id: string) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const latest = useRef<WorkflowRun | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/runs/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((json) => {
        if (!alive) return;
        latest.current = json.run;
        setRun(json.run);
        setVerification(json.verification);
      })
      .catch(() => alive && setNotFound(true));
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current || !latest.current) return queue.current;
    dirty.current = false;
    const snapshot = latest.current;
    setSaveState("saving");
    queue.current = queue.current
      .then(() =>
        fetch(`/api/runs/${id}`, { method: "PUT", body: JSON.stringify({ run: snapshot }) }).then(async (r) => {
          if (r.status === 409) {
            // Another tab started the next round: show the run as it is now.
            const json = await r.json();
            latest.current = json.run;
            setRun(json.run);
            setVerification(json.verification);
            dirty.current = false;
            setSaveState("saved");
            return;
          }
          if (!r.ok) throw new Error("save failed");
          const json = await r.json();
          setVerification(json.verification);
          // Keep server-computed fields (integrity, progress) without clobbering newer local edits.
          if (latest.current === snapshot) latest.current = json.run;
          setSaveState(dirty.current ? "unsaved" : "saved");
        }),
      )
      .catch(() => {
        dirty.current = true;
        setSaveState("error");
      });
    return queue.current;
  }, [id]);

  const update = useCallback(
    (fn: (r: WorkflowRun) => WorkflowRun, opts: { immediate?: boolean } = {}) => {
      if (!latest.current) return Promise.resolve();
      const next = fn(latest.current);
      latest.current = next;
      setRun(next);
      dirty.current = true;
      setSaveState("unsaved");
      clearTimeout(timer.current);
      if (opts.immediate) return flush();
      timer.current = setTimeout(flush, 700);
      return Promise.resolve();
    },
    [flush],
  );

  /** Saves pending edits, then loads the run as the server has it (e.g. after an agent wrote to it). */
  const reload = useCallback(async () => {
    await flush();
    const r = await fetch(`/api/runs/${id}`);
    if (!r.ok) return null;
    const json = await r.json();
    if (dirty.current) return null; // the user typed meanwhile; their next save merges server-side
    latest.current = json.run;
    setRun(json.run);
    setVerification(json.verification);
    return json.run as WorkflowRun;
  }, [id, flush]);

  // Save before the tab closes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  return { run, verification, notFound, saveState, update, flush, reload };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const text = { saved: "Saved", saving: "Saving…", unsaved: "Saving…", error: "Couldn’t save — will retry" }[state];
  return (
    <span className="tiny" style={{ color: state === "error" ? "var(--danger)" : "var(--faint)" }}>
      {text}
    </span>
  );
}
