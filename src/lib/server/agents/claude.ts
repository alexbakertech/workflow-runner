import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import pkg from "../../../../package.json";
import type { ModelOption } from "../../agents";
import { AgentError, IN_DOCKER, baseStatus, envWithoutEmpty, explainFailure, type Adapter } from "./shared";

// Loaded lazily so the app still starts if the SDK's native binary is missing for this platform.
type Sdk = typeof import("@anthropic-ai/claude-agent-sdk");
let sdkPromise: Promise<Sdk> | null = null;
const loadSdk = () => (sdkPromise ??= import("@anthropic-ai/claude-agent-sdk"));

const CLIENT_APP = `workflow-runner/${pkg.version}`;
// Research sessions only need the web. No shell, no file access.
const TOOLS = ["WebSearch", "WebFetch"];
// The SDK's ModelInfo (from supportedModels()) reports no context window or max tokens; only ModelUsage on a
// finished result does. So this table is a fallback, not a source of truth. Unknown models get DEFAULT_CONTEXT.
const DEFAULT_CONTEXT = 200_000;
const CONTEXT: Record<string, number> = { haiku: DEFAULT_CONTEXT, sonnet: DEFAULT_CONTEXT, opus: DEFAULT_CONTEXT, fable: DEFAULT_CONTEXT };

function sdkVersion(): string | undefined {
  try {
    const file = path.join(process.cwd(), "node_modules", "@anthropic-ai", "claude-agent-sdk", "package.json");
    return JSON.parse(readFileSync(file, "utf8")).version;
  } catch {
    return undefined;
  }
}

// An empty ANTHROPIC_API_KEY would shadow a subscription login, so drop it. A real one is passed through.
const FIX = IN_DOCKER
  ? [
      "docker exec -it workflow-runner claude auth login   # or on the host, if ~/.claude is shared via docker-compose.override.yml",
      "or set ANTHROPIC_API_KEY",
    ]
  : ["claude auth login", "or set ANTHROPIC_API_KEY"];

const baseOptions = (cwd: string) => ({
  cwd,
  tools: TOOLS,
  allowedTools: TOOLS,
  // Don't load the host's settings, hooks, plugins, MCP servers or CLAUDE.md files.
  settingSources: [],
  strictMcpConfig: true,
  mcpServers: {},
  persistSession: false,
  permissionMode: "dontAsk" as const,
  env: { ...envWithoutEmpty("ANTHROPIC_API_KEY"), CLAUDE_AGENT_SDK_CLIENT_APP: CLIENT_APP },
});

export const claude: Adapter = {
  id: "claude",

  async status() {
    let sdk: Sdk;
    try {
      sdk = await loadSdk();
    } catch (e) {
      return baseStatus("claude", { problem: `The Claude Agent SDK couldn’t load: ${(e as Error).message}` });
    }
    // Start a session that never sends a prompt, ask who's signed in, then close it. Costs nothing.
    const abort = new AbortController();
    const idle: AsyncIterable<never> = { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) };
    const q = sdk.query({ prompt: idle, options: { ...baseOptions(process.cwd()), abortController: abort } });
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timed out talking to Claude Code")), 25_000));
    try {
      const [account, models] = await Promise.race([Promise.all([q.accountInfo(), q.supportedModels()]), timeout]);
      const signedIn = Boolean(account.subscriptionType || account.tokenSource || account.apiKeySource);
      const list: ModelOption[] = models
        .filter((m) => !/^claude-/.test(m.value) || m.value === "default")
        .map((m) => ({ id: m.value, label: m.displayName, contextWindow: CONTEXT[m.value] ?? DEFAULT_CONTEXT }));
      return baseStatus("claude", {
        installed: true,
        version: sdkVersion() && `Agent SDK ${sdkVersion()}`,
        signedIn,
        account: account.subscriptionType ?? (account.apiKeySource ? "API key" : undefined),
        models: list,
        defaultModel: list.find((m) => m.id === "sonnet")?.id ?? list[0]?.id,
        problem: signedIn ? undefined : "Claude Code isn’t signed in.",
        fix: signedIn ? undefined : FIX,
      });
    } catch (e) {
      const msg = (e as Error).message;
      return baseStatus("claude", {
        installed: true,
        version: sdkVersion() && `Agent SDK ${sdkVersion()}`,
        problem: explainFailure("claude", msg),
        fix: FIX,
      });
    } finally {
      abort.abort();
      try {
        q.close();
      } catch {}
    }
  },

  async run({ instructions, message, model, cwd, signal, onEvent }) {
    const sdk = await loadSdk();
    const abort = new AbortController();
    signal.addEventListener("abort", () => abort.abort(), { once: true });
    let stderr = "";
    const q = sdk.query({
      prompt: message,
      options: {
        ...baseOptions(cwd),
        model: model || undefined,
        systemPrompt: instructions,
        maxTurns: 80,
        includePartialMessages: true,
        abortController: abort,
        stderr: (d: string) => {
          stderr = (stderr + d).slice(-8000);
        },
      },
    });

    let toolCalls = 0;
    let partial = "";
    let sessionId: string | undefined;
    try {
      for await (const m of q) {
        if (m.type === "system" && m.subtype === "init") {
          sessionId = m.session_id;
          onEvent({ type: "session", text: m.session_id });
          onEvent({ type: "activity", text: `Started ${m.model}` });
        } else if (m.type === "stream_event") {
          const ev = m.event;
          if (ev.type === "message_start") partial = "";
          else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            partial += ev.delta.text;
            onEvent({ type: "partial", text: partial });
          }
        } else if (m.type === "assistant") {
          if (m.error) throw new AgentError(explainFailure("claude", `${m.error} ${JSON.stringify(m.message.content).slice(0, 300)}`));
          for (const block of m.message.content) {
            if (block.type !== "tool_use" && block.type !== "server_tool_use") continue;
            toolCalls++;
            const input = (block.input ?? {}) as { query?: string; url?: string };
            const text = input.query ? `Searching the web: ${input.query}` : input.url ? `Reading ${input.url}` : `Using ${block.name}`;
            onEvent({ type: "tool", text });
          }
        } else if (m.type === "result") {
          if (m.subtype === "success" && !m.is_error) {
            return {
              text: m.result,
              sessionId,
              toolCalls,
              usage: { inputTokens: m.usage?.input_tokens, outputTokens: m.usage?.output_tokens },
            };
          }
          const detail = "errors" in m && Array.isArray(m.errors) ? m.errors.join("; ") : "result" in m ? String(m.result) : m.subtype;
          throw new AgentError(
            m.subtype === "error_max_turns"
              ? "The session used too many turns without finishing. Try again or use copy/paste."
              : explainFailure("claude", detail || stderr),
          );
        }
      }
    } catch (e) {
      if (signal.aborted) throw new AgentError("Cancelled.");
      if (e instanceof AgentError) throw e;
      throw new AgentError(explainFailure("claude", `${(e as Error).message}\n${stderr}`));
    }
    throw new AgentError(explainFailure("claude", stderr || "Claude Code ended without a result."));
  },
};
