// ---------- Workflow template (the JSON you load / edit) ----------

export interface TemplateVariable {
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

/** A value the app looks for in a response, e.g. "Gate result: Revise". */
export interface Signal {
  key: string;
  label: string;
  /** Regex (case-insensitive) that the line must contain before the option, e.g. "gate". */
  match?: string;
  options: string[];
  /** Options that should show a warning callout. */
  warnOn?: string[];
  warning?: string;
  /** Verdicts a targeted correction can resolve, and the step whose output was checked (it gets corrected). */
  fix?: { step: string; on: string[] };
  /** Verdicts that recommend more research; the step then offers a quick follow-up or a full new round. */
  followUp?: string[];
}

export interface DecisionOption {
  value: string;
  label: string;
  description?: string;
  /** "loop" starts a new round of the run from the first step, carrying this round's outputs in as context. */
  effect: "continue" | "pause" | "stop" | "loop";
  /** loop only: step ids whose outputs carry into the next round (default: every step completed so far). */
  carry?: string[];
  /** loop only: step ids that receive the carried files (default: the first AI step). */
  carryInto?: string[];
}

export type HumanField =
  | { key: string; type: "questions"; label: string; help?: string; fromStep: string; count?: number }
  | {
      key: string;
      type: "text";
      label: string;
      help?: string;
      placeholder?: string;
      /** Show the questions raised in this step's output above the box, and record them with the answer. */
      questionsFrom?: string;
    }
  | { key: string; type: "decision"; label: string; help?: string; options: DecisionOption[] };

export interface TemplateStep {
  id: string;
  label: string;
  kind: "ai" | "human";
  description?: string;
  /** Step ids whose outputs are pasted as context, in order. */
  inputs?: string[];
  /** Step ids the user may choose to include. */
  optionalInputs?: string[];
  /** AI steps: prompt text. Supports {{var}}, {{#var}}…{{/var}} and {{^var}}…{{/var}}. */
  prompt?: string;
  output: { file: string; title?: string };
  checklist?: string[];
  wordLimit?: number;
  signals?: Signal[];
  /** Feature this step's output prominently on the summary page. */
  feature?: boolean;
  /** Human steps */
  fields?: HumanField[];
  outputTemplate?: string;
}

export interface WorkflowTemplate {
  format: "workflow-template";
  formatVersion: 1;
  id: string;
  title: string;
  version: string;
  description?: string;
  intro?: string[];
  /** Variable used to suggest a run title. */
  titleVariable?: string;
  variables: TemplateVariable[];
  steps: TemplateStep[];
}

export interface TemplateEntry {
  template: WorkflowTemplate;
  hash: string;
  tag: string;
  sourceFile: string;
  builtIn: boolean;
}

// ---------- Run (the JSON the app produces) ----------

export type RunStatus = "setup" | "in_progress" | "paused" | "stopped" | "completed";

export interface QuestionsValue {
  questions: string[];
  answers: string[];
}

export type FieldValue = string | QuestionsValue;

export interface RunStep {
  id: string;
  label: string;
  kind: "ai" | "human";
  outputFile: string;
  status: "pending" | "done" | "skipped";
  /** The model reply (AI steps) or generated markdown (human steps). */
  response: string;
  responseSource?: "paste" | "upload" | "form" | "agent";
  uploadedFileName?: string;
  /** Prompt exactly as used for this session. */
  prompt?: string;
  /** Set when the user edited the prompt for this run. */
  promptOverride?: string;
  /** Optional inputs the user chose to include. */
  includedOptional?: string[];
  /** Input files supplied as context when the step was completed. */
  inputFiles?: string[];
  /** Fingerprint of context + prompt when completed; used to flag stale steps. */
  inputsDigest?: string;
  signals?: Record<string, string>;
  wordCount?: number;
  fields?: Record<string, FieldValue>;
  checklist?: boolean[];
  savedAt?: string;
  /** Set when the reply was deliberately edited after it was recorded. */
  editedAt?: string;
  /** Set when an agent produced the reply. Kept as history if the reply is later replaced. */
  agent?: AgentRunInfo;
  /** The user kept this step's recommendation to investigate further as final; its follow-up options are hidden. */
  followUpClosed?: boolean;
}

/** How an agent produced a step's reply; recorded in the run file. */
export interface AgentRunInfo {
  jobId: string;
  provider: "claude" | "codex" | "pi";
  model: string;
  /** Harness session/thread id, for looking the session up in the tool's own history. */
  sessionId?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  toolCalls: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Chat around the requested file (lead-ins, fences, sign-offs) was removed from the reply. */
  trimmed?: boolean;
}

export interface WorkflowRun {
  format: "workflow-run";
  formatVersion: 1;
  id: string;
  title: string;
  /** templateId@version#hash8 — ties the run to the workflow file it came from. */
  tag: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  variables: Record<string, string>;
  template: {
    id: string;
    title: string;
    version: string;
    sourceFile: string;
    hash: string;
    definition: WorkflowTemplate;
  };
  /** Index of the step the user is on. */
  position: number;
  /** Step ids an auto-advancing agent must stop before, so the user can do or check them. */
  agentBreakpoints?: string[];
  /** The round in progress: 1 to start with; a "loop" decision starts the next one in the same run. */
  round?: number;
  /** When the current round started (the run's createdAt for round 1). */
  roundStartedAt?: string;
  /** Outputs carried in from the previous round, given as extra input files to `into` steps. */
  carryOver?: CarryOver;
  /** Earlier rounds as they were when they ended, oldest first. `steps` is always the current round. */
  rounds?: PastRound[];
  /** Quick follow-ups in the current round: focused research on a step's open questions, then that step again. */
  followUps?: FollowUp[];
  progress: { completed: number; total: number };
  steps: RunStep[];
  integrity?: { algorithm: "sha256"; contentHash: string; computedAt: string };
  importVerification?: Verification & { importedAt: string; sourceFile?: string };
}

export interface CarryOver {
  files: { name: string; content: string; fromStepId: string }[];
  into: string[];
}

export interface PastRound {
  round: number;
  startedAt: string;
  endedAt: string;
  /** What this round was given from the one before it. */
  carryOver?: CarryOver;
  steps: RunStep[];
  followUps?: FollowUp[];
}

export interface FollowUp {
  /** 1, 2, … within the round. */
  n: number;
  /** "research": a research session on the open questions, then the step again (once per round).
   *  "answers": the step again with only the user's answers. Missing means "research". */
  kind?: "research" | "answers";
  /** The step that recommended more research; it runs again with the findings. */
  stepId: string;
  createdAt: string;
  questions: string[];
  /** What the user added: answers to the questions, new facts. */
  answers: string;
  /** That step's output before the follow-up, kept for comparison. */
  previous: string;
  status: "running" | "done" | "failed";
  research?: string;
  agent?: AgentRunInfo;
}

export interface Verification {
  templateHashOk: boolean;
  contentHashOk: boolean | null;
}

export interface RunListItem {
  id: string;
  title: string;
  tag: string;
  status: RunStatus;
  updatedAt: string;
  templateTitle: string;
  templateHash: string;
  /** The run's setup answers joined together, so the run list can search them. */
  inputsText: string;
  progress: { completed: number; total: number };
  /** Step an agent is working on right now, if any. */
  agentStep?: number;
  round?: number;
}
