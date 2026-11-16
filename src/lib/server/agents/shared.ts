import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { ModelOption, ProviderId, ProviderStatus } from "../../agents";

export interface AdapterEvent {
  type: "activity" | "tool" | "text" | "partial" | "session";
  text: string;
}

export interface RunRequest {
  instructions: string;
  message: string;
  model: string;
  /** Empty scratch directory the harness runs in. */
  cwd: string;
  signal: AbortSignal;
  onEvent: (e: AdapterEvent) => void;
}

export interface RunResult {
  text: string;
  sessionId?: string;
  toolCalls: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Things the user should know about the reply, e.g. that it was cut off. */
  warnings?: string[];
}

export interface Adapter {
  id: ProviderId;
  status(): Promise<ProviderStatus>;
  run(req: RunRequest): Promise<RunResult>;
}

/** An error whose message is fit to show the user as-is. */
export class AgentError extends Error {}

/** Copy of process.env without the named variables when they are empty (docker compose passes unset ones as ""). */
export function envWithoutEmpty(...names: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const n of names) if (!env[n]?.trim()) delete env[n];
  return env;
}

export const IS_WINDOWS = process.platform === "win32";

/** True inside the Docker image, where sign-in commands have to go through `docker exec`. */
export const IN_DOCKER = existsSync("/.dockerenv");

export function baseStatus(id: ProviderId, patch: Partial<ProviderStatus>): ProviderStatus {
  return { id, installed: false, signedIn: false, models: [] as ModelOption[], checkedAt: new Date().toISOString(), ...patch };
}

interface SpawnOpts {
  cwd?: string;
  stdin?: string;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  onLine?: (line: string) => void;
}

/**
 * Runs a CLI and collects its output. Lines of stdout are passed to onLine as they arrive.
 * Resolves with the exit code; rejects only if the binary can't be started.
 */
export function run(cmd: string, args: string[], opts: SpawnOpts = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // npm installs CLIs as .cmd shims on Windows, which need a shell to start.
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: IS_WINDOWS,
      // Own process group on Linux, so cancelling also stops anything the CLI started.
      detached: !IS_WINDOWS,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let buf = "";
    let settled = false;
    let exited = false;
    const kill = () => {
      if (exited || !child.pid) return;
      try {
        if (IS_WINDOWS) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        else process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill();
      }
    };
    const timer = opts.timeoutMs ? setTimeout(kill, opts.timeoutMs) : undefined;
    opts.signal?.addEventListener("abort", kill, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (!opts.onLine) return;
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) opts.onLine(line);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      // Keep the tail only; some CLIs are chatty on stderr.
      stderr = (stderr + chunk).slice(-20_000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.on("exit", () => {
      exited = true;
    });
    child.on("close", (code) => {
      exited = true;
      clearTimeout(timer);
      if (buf.trim() && opts.onLine) opts.onLine(buf.trim());
      if (!settled) {
        settled = true;
        resolve({ code, stdout, stderr });
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(opts.stdin ?? "");
  });
}

/** Last non-empty lines of stderr, for error messages. */
export function tail(text: string, lines = 6): string {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
}

/** Turns common harness failures into something the user can act on. */
export function explainFailure(provider: ProviderId, raw: string): string {
  const t = raw.toLowerCase();
  if (/extra usage|draws? from your extra|billed per token/.test(t))
    return "The provider says this would be billed as extra usage rather than your plan. Stopped so nothing is charged — use copy/paste for this step.";
  if (/rate.?limit|usage limit|quota|too many requests|429/.test(t))
    return "You’ve hit a usage limit. Wait for it to reset, then run the step again, or use copy/paste.";
  if (/not logged in|unauthori[sz]ed|401|authentication|login required|sign in|invalid api key|refresh token/.test(t))
    return provider === "claude"
      ? "Claude isn’t signed in (or the login expired). Run `claude auth login` (or set ANTHROPIC_API_KEY), then check Settings."
      : provider === "codex"
        ? "Codex isn’t signed in (or the login expired). See Settings for the sign-in command."
        : "pi couldn’t authenticate with the model server. Check your pi models.json.";
  if (/econnrefused|enotfound|fetch failed|network|timed? ?out|socket hang up/.test(t))
    return provider === "pi"
      ? "Couldn’t reach the local model server. Check that it’s running and reachable from the app."
      : "Network problem talking to the provider. Check the connection and try again.";
  return raw.trim().slice(0, 600) || "The agent stopped without saying why.";
}
