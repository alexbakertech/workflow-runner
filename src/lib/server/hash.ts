import "server-only";
import { createHash } from "node:crypto";
import type { Verification, WorkflowRun, WorkflowTemplate } from "../types";

/** JSON with sorted keys so hashes don't depend on key order or whitespace. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function sha256(text: string): string {
  return "sha256:" + createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashTemplate(t: WorkflowTemplate): string {
  return sha256(stableStringify(t));
}

/** Hash of everything in the run except the integrity block and import bookkeeping. */
export function hashRunContent(run: WorkflowRun): string {
  const { integrity, importVerification, ...rest } = run;
  return sha256(stableStringify(rest));
}

export function sealRun(run: WorkflowRun): WorkflowRun {
  return {
    ...run,
    integrity: { algorithm: "sha256", contentHash: hashRunContent(run), computedAt: new Date().toISOString() },
  };
}

export function verifyRun(run: WorkflowRun): Verification {
  return {
    templateHashOk: hashTemplate(run.template.definition) === run.template.hash,
    contentHashOk: run.integrity ? hashRunContent(run) === run.integrity.contentHash : null,
  };
}
