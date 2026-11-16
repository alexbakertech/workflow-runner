import "server-only";
import type { ModelOption } from "../../agents";
import { AgentError, IN_DOCKER, IS_WINDOWS, baseStatus, envWithoutEmpty, explainFailure, run, tail, type Adapter } from "./shared";

const FIX = [IN_DOCKER ? "docker exec -it workflow-runner codex login --device-auth" : "codex login", "or set OPENAI_API_KEY"];

// Try the API-key login at most once per process, and only when a key is set.
let apiKeyLoginTried = false;
async function loginWithApiKey(): Promise<void> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || apiKeyLoginTried) return;
  apiKeyLoginTried = true;
  // Never log the key or the CLI's output; just carry on and report "not signed in" if it fails.
  await run("codex", ["login", "--with-api-key"], { stdin: key, timeoutMs: 15_000, env: envWithoutEmpty("OPENAI_API_KEY") }).catch(() => null);
}

async function loginStatus() {
  const login = await run("codex", ["login", "status"], { timeoutMs: 15_000 }).catch(() => null);
  const text = `${login?.stdout ?? ""}${login?.stderr ?? ""}`.trim();
  return { text, signedIn: login?.code === 0 && !/not logged in/i.test(text) };
}

interface CodexEvent {
  type: string;
  thread_id?: string;
  message?: string;
  error?: { message?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  item?: { type: string; text?: string; query?: string; action?: { query?: string; url?: string } };
}

export const codex: Adapter = {
  id: "codex",

  async status() {
    let version: string | undefined;
    try {
      const v = await run("codex", ["--version"], { timeoutMs: 15_000 });
      if (v.code !== 0) throw new Error(v.stderr);
      version = v.stdout.trim();
    } catch {
      return baseStatus("codex", { problem: "The Codex CLI isn’t installed here.", fix: ["npm i -g @openai/codex"] });
    }
    let { text: loginText, signedIn } = await loginStatus();
    if (!signedIn && process.env.OPENAI_API_KEY?.trim() && !apiKeyLoginTried) {
      await loginWithApiKey();
      ({ text: loginText, signedIn } = await loginStatus());
    }

    let models: ModelOption[] = [];
    try {
      const m = await run("codex", ["debug", "models"], { timeoutMs: 20_000 });
      const raw = JSON.parse(m.stdout) as { models?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const list = Array.isArray(raw) ? raw : (raw.models ?? []);
      models = list
        .filter((x) => x.visibility !== "hide")
        .sort((a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99))
        .map((x) => ({ id: String(x.slug), label: String(x.display_name ?? x.slug), contextWindow: Number(x.context_window) || undefined }));
    } catch {
      // The catalog is a nicety; the CLI picks a default model if we pass none.
    }
    return baseStatus("codex", {
      installed: true,
      version,
      signedIn,
      account: signedIn ? (/chatgpt/i.test(loginText) ? "ChatGPT" : /api key/i.test(loginText) ? "API key" : undefined) : undefined,
      models,
      defaultModel: models[0]?.id,
      problem: signedIn ? undefined : `Codex isn’t signed in${IN_DOCKER ? " inside the container" : ""}.`,
      fix: signedIn ? undefined : FIX,
    });
  },

  async run({ instructions, message, model, cwd, signal, onEvent }) {
    const args = [
      "--search", // live web search tool, no per-call approval
      "exec",
      "--json",
      "--ephemeral",
      "--skip-git-repo-check",
      "--ignore-user-config",
      "--ignore-rules",
      "--sandbox",
      "read-only",
      "-C",
      cwd,
    ];
    if (model) args.push("-m", model);
    // TOML basic strings accept JSON string escapes, so this stays on one line.
    // cmd.exe mangles quoted arguments, so on Windows the instructions go in the message instead.
    let stdin = message;
    if (IS_WINDOWS) stdin = `<instructions>\n${instructions}\n</instructions>\n\n${message}`;
    else args.push("-c", `developer_instructions=${JSON.stringify(instructions)}`);
    args.push("-");

    const messages: string[] = [];
    let toolCalls = 0;
    let sessionId: string | undefined;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    let failure: string | undefined;

    const r = await run("codex", args, {
      cwd,
      stdin,
      signal,
      env: envWithoutEmpty("OPENAI_API_KEY"),
      onLine: (line) => {
        let e: CodexEvent;
        try {
          e = JSON.parse(line);
        } catch {
          return;
        }
        if (e.type === "thread.started" && e.thread_id) {
          sessionId = e.thread_id;
          onEvent({ type: "session", text: e.thread_id });
          onEvent({ type: "activity", text: "Started Codex session" });
        } else if (e.type === "item.started" && e.item?.type === "web_search") {
          onEvent({ type: "activity", text: "Searching the web…" });
        } else if (e.type === "item.completed" && e.item) {
          if (e.item.type === "agent_message" && e.item.text) {
            messages.push(e.item.text);
            onEvent({ type: "partial", text: e.item.text });
          } else if (e.item.type === "web_search") {
            toolCalls++;
            const q = e.item.action?.query || e.item.query;
            const url = e.item.action?.url;
            onEvent({ type: "tool", text: q ? `Searching the web: ${q}` : url ? `Reading ${url}` : "Searching the web" });
          } else if (e.item.type === "command_execution" || e.item.type === "mcp_tool_call") {
            toolCalls++;
            onEvent({ type: "tool", text: `Used ${e.item.type.replace(/_/g, " ")}` });
          }
        } else if (e.type === "turn.completed") {
          usage = { inputTokens: e.usage?.input_tokens, outputTokens: e.usage?.output_tokens };
        } else if (e.type === "turn.failed" || e.type === "error") {
          failure = e.error?.message ?? e.message ?? line;
        }
      },
    }).catch((err: Error) => {
      throw new AgentError(`Couldn’t start Codex: ${err.message}`);
    });

    if (signal.aborted) throw new AgentError("Cancelled.");
    if (failure || r.code !== 0) throw new AgentError(explainFailure("codex", failure ?? tail(r.stderr)));
    // Earlier messages are progress notes ("I’ll check…"); the last one is the deliverable.
    const text = messages[messages.length - 1];
    if (!text?.trim()) throw new AgentError("Codex finished without a reply.");
    return { text, sessionId, toolCalls, usage };
  },
};
