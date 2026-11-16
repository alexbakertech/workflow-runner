// Shared (client + server) types and helpers for running steps through agent harnesses.

import type { AgentRunInfo, FollowUp, Signal, TemplateStep, WorkflowRun } from "./types";
import { buildContext, contextFiles, detectSignals, followUpAnswersMd, resolvedPrompt } from "./workflow";

export type ProviderId = AgentRunInfo["provider"];

export const PROVIDERS: { id: ProviderId; name: string; kind: string; blurb: string }[] = [
  { id: "claude", name: "Claude", kind: "Claude Code subscription", blurb: "Runs through the official Claude Agent SDK with your Claude login." },
  { id: "codex", name: "Codex", kind: "ChatGPT subscription", blurb: "Runs through the official Codex CLI with your ChatGPT login." },
  { id: "pi", name: "Local", kind: "Local models via pi", blurb: "Runs your local models through pi. Only providers from your pi models.json are offered." },
];

export const providerName = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

export interface ModelOption {
  id: string;
  label: string;
  /** Tokens. */
  contextWindow?: number;
  maxOutput?: number;
}

export interface ProviderStatus {
  id: ProviderId;
  installed: boolean;
  version?: string;
  signedIn: boolean;
  /** e.g. "Claude Pro", "ChatGPT", "3 local providers". */
  account?: string;
  models: ModelOption[];
  defaultModel?: string;
  /** What's wrong, in plain words, when not ready. */
  problem?: string;
  /** Commands the user can run to fix it. */
  fix?: string[];
  checkedAt: string;
}

/** What an auto-advancing agent does when a check asks for revisions. Blocking verdicts always pause. */
export type RevisePolicy = "pause" | "fix" | "continue";

export interface AgentSettings {
  defaultProvider: ProviderId | null;
  models: Partial<Record<ProviderId, string>>;
  autoAdvance: boolean;
  onRevise: RevisePolicy;
}

export const DEFAULT_SETTINGS: AgentSettings = { defaultProvider: null, models: {}, autoAdvance: false, onRevise: "pause" };

export const REVISE_POLICIES: { id: RevisePolicy; label: string; help: string }[] = [
  { id: "pause", label: "Pause so I can decide", help: "Stop on the check’s result and wait for you." },
  { id: "fix", label: "Have the agent fix it", help: "Send the check’s report back to the step it checked, correct the flagged claims, then run the check again. Pauses if it still asks for revisions." },
  { id: "continue", label: "Carry the flag and keep going", help: "Record the verdict and continue; later steps are told about the flagged claims." },
];

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobEvent {
  at: string;
  kind: "status" | "tool" | "text" | "error";
  text: string;
}

export interface AgentJob {
  id: string;
  runId: string;
  stepIndex: number;
  stepId: string;
  stepLabel: string;
  /** The run's round when the job was queued. */
  round: number;
  provider: ProviderId;
  model: string;
  status: JobStatus;
  /** Continue to the next AI step on success, until a review step, a warning or a failure. */
  autoAdvance: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Latest progress line, e.g. "Searching the web: …". */
  activity?: string;
  events: JobEvent[];
  /** Reply text streamed so far (trimmed to the tail for long replies). */
  partial?: string;
  toolCalls: number;
  error?: string;
  warnings?: string[];
  /** Set on a correction: the step whose check asked for revisions. The check runs again afterwards. */
  fix?: { verifierIndex: number };
  /** Set on a check that runs again after a correction, so a second "Revise" pauses instead of looping. */
  afterFix?: boolean;
  /** Set on quick follow-up research; the step at stepIndex runs again with the findings afterwards. */
  followUp?: { n: number };
  /** Why an auto-advance chain stopped after this job, if it did. */
  stoppedBecause?: string;
  sessionId?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export const isActive = (j: Pick<AgentJob, "status">) => j.status === "queued" || j.status === "running";

// ---------- What the agent is sent ----------

/**
 * Standing instructions for every agent session. The workflow was written for copy/paste chats, so this explains
 * how its "files" map onto a text-only session.
 */
export const AGENT_INSTRUCTIONS = `You are running one isolated session of a multi-step research workflow. Earlier sessions' outputs are your only shared context.

- Input files are included inline in the message, each between "--- BEGIN FILE: name ---" and "--- END FILE: name ---" markers. That is their complete content; do not look for them on disk.
- You cannot create files. When the instructions ask you to produce, save or attach a file (for example "01_research.md"), reply with that file's complete Markdown content as your final message. Start directly with the document itself: no introduction ("Here is…", "Based on my research…"), no closing remarks, no code fence around it.
- Use your web search and fetch tools whenever the task calls for research or source checking, and cite what you actually found.
- Do not ask clarifying questions; nobody can answer mid-session. Make reasonable assumptions and state them in the output.`;

/** The user message: context on top, prompt underneath, exactly as in the copy/paste flow. */
export function agentMessage(run: WorkflowRun, step: TemplateStep): string {
  const context = buildContext(contextFiles(run, step));
  const prompt = resolvedPrompt(run, step);
  return context ? `${context}\n${prompt}` : prompt;
}

/** The step's check, if its verdict asks for a correction of another step. */
export function fixableVerdict(run: WorkflowRun, verifierIndex: number): { signal: Signal; value: string; targetIndex: number } | null {
  const def = run.template.definition;
  const step = def.steps[verifierIndex];
  const rs = run.steps[verifierIndex];
  if (!step || step.kind !== "ai" || !rs?.response.trim()) return null;
  const detected = detectSignals(rs.response, step.signals);
  for (const signal of step.signals ?? []) {
    const value = detected[signal.key] ?? rs.signals?.[signal.key];
    if (!signal.fix || !value || !signal.fix.on.includes(value)) continue;
    const targetIndex = def.steps.findIndex((s) => s.id === signal.fix!.step);
    if (targetIndex >= 0 && targetIndex < verifierIndex && def.steps[targetIndex].kind === "ai") return { signal, value, targetIndex };
  }
  return null;
}

/**
 * A correction session: the original task and inputs, the previous output and the check's report, and a request to
 * fix only what the check flagged.
 */
export function correctionMessage(run: WorkflowRun, targetIndex: number, verifierIndex: number): string {
  const def = run.template.definition;
  const target = def.steps[targetIndex];
  const verifier = def.steps[verifierIndex];
  const own = target.output.file;
  const report = verifier.output.file;
  const extra = buildContext([
    { stepId: target.id, name: own, content: run.steps[targetIndex].response, optional: false },
    { stepId: verifier.id, name: report, content: run.steps[verifierIndex].response, optional: false },
  ]);
  return `${agentMessage(run, target)}

--- CORRECTION REQUEST ---
The task above has already been done once. ${own} below is that output. A separate check then reviewed it, and its report, ${report}, asks for revisions.

${extra}
Make the targeted corrections ${report} requires, and nothing more:
1. Go through every correction it lists, one by one. For each flagged claim, either correct it to match what the source says, cite a source that does support it, or remove it. Use your web tools to check sources where that helps. Don't skip any.
2. Keep everything it did not flag as it is — same structure, numbering and wording. Do not add new claims.
3. Reply with the complete corrected ${own} and nothing else: no notes about what you changed before or after it.`;
}

/** A focused research session on the open questions of a step that recommended investigating further. */
export function followUpMessage(run: WorkflowRun, f: FollowUp): string {
  const def = run.template.definition;
  const step = def.steps.find((s) => s.id === f.stepId)!;
  const own = run.steps.find((s) => s.id === f.stepId)?.outputFile ?? step.output.file;
  const setup = def.variables
    .filter((v) => run.variables[v.key]?.trim())
    .map((v) => `- ${v.label}: ${run.variables[v.key].trim()}`)
    .join("\n");
  const files = buildContext([
    { stepId: f.stepId, name: own, content: f.previous, optional: false },
    { stepId: "answers", name: "follow_up_answers.md", content: followUpAnswersMd(f.questions, f.answers), optional: false },
  ]);
  return `${files}
# Follow-up research

${setup ? `The investigation:\n${setup}\n\n` : ""}${own} ("${step.label}") recommends investigating further before deciding. Research only its open questions; follow_up_answers.md lists them with anything the user added.

1. For each open question, find what reliable sources say and cite them with links. Use your web search and fetch tools.
2. Where the user has answered a question, treat the answer as their stated scenario (not verified evidence) and research what it implies.
3. Keep verified source statements, reasoned inference and assumptions clearly apart.
4. Say plainly when a question can't be settled by research and only the user can answer it.
5. Do not redo the rest of the investigation or make the final decision.

**Output:** \`follow_up_research.md\`, **600 words maximum**, titled **Follow-up Research**: one section per question with the finding, its sources and how confident it is, then a short **What this changes** section naming the parts of ${own} these findings affect.`;
}

/** Rough token estimate (≈4 characters per token for English prose and Markdown). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Tokens the step will use before the model writes anything. */
export function stepInputTokens(run: WorkflowRun, step: TemplateStep): number {
  return estimateTokens(AGENT_INSTRUCTIONS) + estimateTokens(agentMessage(run, step));
}

export function formatTokens(n: number): string {
  return n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

/**
 * Agents sometimes wrap the "file" they were asked for: chat before it ("Here is the complete document:"),
 * a filename line on top, the whole thing inside a ```markdown fence, or a sign-off after it. Strip that
 * packaging so the reply is the file's content.
 */
export function cleanReply(text: string, outputFile: string): string {
  let t = text.replace(/\r\n/g, "\n").trim();
  const name = outputFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Lead-in chat that ends with "Here is the …:" — keep only what follows. Only looked for in the first half,
  // so a phrase like that inside the document itself is left alone.
  // The phrase may open its line or close a sentence of narration ("…so I'll update it. Here's the corrected report:").
  const leadIn = /(?:^|(?<=[.!?])[ \t]+)(?:here(?:'s| is| are)|below is|the (?:complete|final|full)[^\n]{0,60}(?:is|follows))[^\n]{0,160}:[ \t]*$/im;
  // Only when what comes before it is plain chat: no headings, short.
  const lead = leadIn.exec(t);
  const before = lead ? t.slice(0, lead.index) : "";
  if (lead && lead.index < t.length / 2 && before.length < 2000 && !/^#{1,6}\s/m.test(before)) t = t.slice(lead.index + lead[0].length).trim();
  // A heading that names the file marks where the document starts.
  const named = new RegExp(`^#{1,6}[^\\n]*${name}`, "im").exec(t);
  if (named && named.index > 0 && named.index < t.length / 2) t = t.slice(named.index);
  t = t.replace(/^(?:-{3,}|\*{3,}|_{3,})[ \t]*\n+/, "");

  // "# 01_fact.md", "**01_fact.md**", "`01_fact.md`:", "File: 01_fact.md" alone on the first line.
  t = t.replace(new RegExp(`^(?:#{1,6}\\s*)?(?:file(?:name)?:\\s*)?[*_\`]*${name}[*_\`]*:?[ \\t]*\\n+`, "i"), "");
  const fence = /^```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n```[ \t]*$/i.exec(t);
  if (fence && !fence[1].includes("\n```")) t = fence[1];

  // A closing pleasantry after the document.
  t = t.replace(/\n+(?:-{3,}\n+)?(?:let me know|i hope this|feel free|if you(?:'d| would) like|happy to)[^\n]*$/i, "");
  return t.trim();
}
