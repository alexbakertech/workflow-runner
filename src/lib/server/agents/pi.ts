import "server-only";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelOption } from "../../agents";
import { AgentError, IN_DOCKER, baseStatus, explainFailure, run, tail, type Adapter } from "./shared";

// pi is only used for local models. Its subscription logins (Anthropic, OpenAI, …) are never offered.
const agentDir = () => process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");

/** Providers the user defined in pi's models.json — their own model servers. */
async function localProviders(): Promise<string[]> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(agentDir(), "models.json"), "utf8")) as { providers?: Record<string, unknown> };
    return Object.keys(raw.providers ?? {});
  } catch {
    return [];
  }
}

const parseSize = (s: string) => {
  const m = /^([\d.]+)\s*([KM]?)$/i.exec(s.trim());
  if (!m) return undefined;
  return Math.round(Number(m[1]) * (m[2].toUpperCase() === "M" ? 1e6 : m[2].toUpperCase() === "K" ? 1e3 : 1));
};

interface PiMessage {
  role?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input?: number; output?: number; cacheRead?: number };
  stopReason?: string;
  errorMessage?: string;
}
interface PiEvent {
  type: string;
  id?: string;
  message?: PiMessage;
  assistantMessageEvent?: { type: string; delta?: string };
  toolName?: string;
  args?: { query?: string; url?: string; urls?: string[] };
  isError?: boolean;
  aborted?: boolean;
}

const textOf = (m?: PiMessage) => (m?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");

export const pi: Adapter = {
  id: "pi",

  async status() {
    let version: string | undefined;
    try {
      const v = await run("pi", ["--version"], { timeoutMs: 15_000 });
      if (v.code !== 0) throw new Error(v.stderr);
      version = `pi ${v.stdout.trim()}`;
    } catch {
      return baseStatus("pi", { problem: "pi isn’t installed here.", fix: ["npm i -g @earendil-works/pi-coding-agent"] });
    }
    const providers = await localProviders();
    if (!providers.length)
      return baseStatus("pi", {
        installed: true,
        version,
        problem: `No local model providers found in ${path.join(agentDir(), "models.json")}. Add your model servers to that file.`,
        fix: IN_DOCKER
          ? ["cp docker-compose.override.example.yml docker-compose.override.yml   # on the host, to use your own ~/.pi/agent"]
          : undefined,
      });

    const models: ModelOption[] = [];
    try {
      const r = await run("pi", ["--list-models", "--offline"], { timeoutMs: 30_000 });
      for (const line of r.stdout.split(/\r?\n/).slice(1)) {
        const [provider, id, context, maxOut] = line.trim().split(/\s{2,}/);
        if (!provider || !id || !providers.includes(provider)) continue;
        models.push({ id: `${provider}/${id}`, label: `${id} · ${provider}`, contextWindow: parseSize(context ?? ""), maxOutput: parseSize(maxOut ?? "") });
      }
    } catch {}
    return baseStatus("pi", {
      installed: true,
      version,
      // Local servers need no sign-in.
      signedIn: models.length > 0,
      account: `${models.length} local model${models.length === 1 ? "" : "s"}`,
      models,
      defaultModel: models[0]?.id,
      problem: models.length ? undefined : "pi found no models for your local providers.",
    });
  },

  async run({ instructions, message, model, cwd, signal, onEvent }) {
    const slash = model.indexOf("/");
    if (slash < 0) throw new AgentError("Pick a local model in Settings first.");
    const provider = model.slice(0, slash);
    if (!(await localProviders()).includes(provider))
      throw new AgentError(`“${provider}” isn’t one of your local providers in pi’s models.json.`);

    // Passed as a file so long text never goes through the command line.
    const instructionsFile = path.join(cwd, "instructions.md");
    await fs.writeFile(instructionsFile, instructions, "utf8");
    const args = [
      "-p",
      "--mode",
      "json",
      "--no-session",
      // No file or shell tools; extension tools (e.g. pi-exa web search) stay available.
      "--no-builtin-tools",
      "--no-context-files",
      "--no-skills",
      "--no-prompt-templates",
      "--no-themes",
      "--provider",
      provider,
      "--model",
      model.slice(slash + 1),
      "--append-system-prompt",
      instructionsFile,
    ];

    let last: PiMessage | undefined;
    let partial = "";
    let toolCalls = 0;
    let sessionId: string | undefined;
    const usage = { inputTokens: 0, outputTokens: 0 };

    const r = await run("pi", args, {
      cwd,
      stdin: message,
      signal,
      onLine: (line) => {
        let e: PiEvent;
        try {
          e = JSON.parse(line);
        } catch {
          return;
        }
        if (e.type === "session" && e.id) {
          sessionId = e.id;
          onEvent({ type: "session", text: e.id });
          onEvent({ type: "activity", text: `Started ${model.slice(slash + 1)}` });
        } else if (e.type === "message_start" && e.message?.role === "assistant") {
          partial = "";
        } else if (e.type === "message_update" && e.assistantMessageEvent?.type === "text_delta") {
          partial += e.assistantMessageEvent.delta ?? "";
          onEvent({ type: "partial", text: partial });
        } else if (e.type === "message_update" && e.assistantMessageEvent?.type === "thinking_start") {
          onEvent({ type: "activity", text: "Thinking…" });
        } else if (e.type === "tool_execution_start") {
          toolCalls++;
          const a = e.args ?? {};
          const what = a.query ? `: ${a.query}` : a.url ? ` ${a.url}` : a.urls?.length ? ` ${a.urls[0]}` : "";
          onEvent({ type: "tool", text: `${(e.toolName ?? "tool").replace(/_/g, " ")}${what}` });
        } else if (e.type === "message_end" && e.message?.role === "assistant") {
          last = e.message;
          usage.inputTokens += (e.message.usage?.input ?? 0) + (e.message.usage?.cacheRead ?? 0);
          usage.outputTokens += e.message.usage?.output ?? 0;
        }
      },
    }).catch((err: Error) => {
      throw new AgentError(`Couldn’t start pi: ${err.message}`);
    });

    if (signal.aborted) throw new AgentError("Cancelled.");
    if (last?.stopReason === "error" || last?.errorMessage) throw new AgentError(explainFailure("pi", last.errorMessage ?? "Model error"));
    if (r.code !== 0) throw new AgentError(explainFailure("pi", tail(r.stderr) || `pi exited with code ${r.code}`));
    const text = textOf(last);
    if (!text.trim()) throw new AgentError("The model finished without a reply.");
    const warnings =
      last?.stopReason === "length"
        ? ["The reply hit this model’s output limit and is probably cut off. Raise maxTokens for it in pi’s models.json, or use another provider."]
        : undefined;
    return { text, sessionId, toolCalls, usage, warnings };
  },
};
