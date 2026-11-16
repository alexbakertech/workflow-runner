"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentJob, AgentSettings, ProviderStatus } from "@/lib/agents";
import { isActive } from "@/lib/agents";

/** Provider readiness and agent settings. Status checks are cached on the server for a few minutes. */
export function useProviders() {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setChecking(true);
    try {
      const json = await fetch(`/api/agents${refresh ? "?refresh=1" : ""}`).then((r) => r.json());
      setProviders(json.providers);
      setSettings(json.settings);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = useCallback(async (patch: Partial<AgentSettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    const json = await fetch("/api/settings", { method: "PUT", body: JSON.stringify(patch) }).then((r) => r.json());
    setSettings(json.settings);
  }, []);

  return { providers, settings, checking, refresh: () => load(true), saveSettings };
}

/**
 * Live agent jobs for a run, over server-sent events. onFinished fires once per job when it leaves the
 * queued/running state, so the page can reload the run the server just updated.
 */
export function useAgentJobs(runId: string, onFinished?: (job: AgentJob) => void) {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const seen = useRef(new Map<string, string>());
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/agent/events`);
    const upsert = (job: AgentJob) => {
      const before = seen.current.get(job.id);
      seen.current.set(job.id, job.status);
      if (before && isActive({ status: before as AgentJob["status"] }) && !isActive(job)) finished.current?.(job);
      setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    };
    es.addEventListener("snapshot", (e) => {
      const { jobs: list } = JSON.parse((e as MessageEvent).data) as { jobs: AgentJob[] };
      // After a reconnect, catch jobs that finished while we weren't listening.
      for (const j of list) {
        const before = seen.current.get(j.id);
        seen.current.set(j.id, j.status);
        if (before && isActive({ status: before as AgentJob["status"] }) && !isActive(j)) finished.current?.(j);
      }
      setJobs(list);
    });
    es.addEventListener("job", (e) => upsert(JSON.parse((e as MessageEvent).data)));
    return () => es.close();
  }, [runId]);

  const start = useCallback(
    async (body: ({ stepIndex: number } | { fixFrom: number }) & { provider: string; model: string; autoAdvance: boolean }) => {
      const res = await fetch(`/api/runs/${runId}/agent`, { method: "POST", body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn’t start the agent.");
      return json.job as AgentJob;
    },
    [runId],
  );

  const cancel = useCallback(() => fetch(`/api/runs/${runId}/agent`, { method: "DELETE" }), [runId]);

  const active = jobs.find(isActive) ?? null;
  // Jobs from earlier rounds belong to steps that have since been reset.
  const latestFor = (stepIndex: number, round = 1) => jobs.find((j) => j.stepIndex === stepIndex && (j.round ?? 1) === round) ?? null;

  return { jobs, active, latestFor, start, cancel };
}
