import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS, PROVIDERS, type AgentSettings, type ProviderId, type ProviderStatus } from "../../agents";
import { DATA_DIR } from "../store";
import { claude } from "./claude";
import { codex } from "./codex";
import { pi } from "./pi";
import type { Adapter } from "./shared";

export const adapters: Record<ProviderId, Adapter> = { claude, codex, pi };

// ---------- Status (cached; checks spawn processes) ----------

const STATUS_TTL = 5 * 60_000;
const g = globalThis as unknown as { __wfStatus?: Map<ProviderId, { at: number; value: Promise<ProviderStatus> }> };
const cache = (g.__wfStatus ??= new Map());

export function providerStatus(id: ProviderId, refresh = false): Promise<ProviderStatus> {
  const hit = cache.get(id);
  if (!refresh && hit && Date.now() - hit.at < STATUS_TTL) return hit.value;
  const value = adapters[id].status().catch(
    (e: Error): ProviderStatus => ({ id, installed: false, signedIn: false, models: [], problem: e.message, checkedAt: new Date().toISOString() }),
  );
  cache.set(id, { at: Date.now(), value });
  return value;
}

export function allStatuses(refresh = false): Promise<ProviderStatus[]> {
  return Promise.all(PROVIDERS.map((p) => providerStatus(p.id, refresh)));
}

// ---------- Settings ----------

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export async function getSettings(): Promise<AgentSettings> {
  try {
    const raw = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")) as { agents?: Partial<AgentSettings> };
    return { ...DEFAULT_SETTINGS, ...raw.agents, models: { ...raw.agents?.models } };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<AgentSettings>): Promise<AgentSettings> {
  const next = { ...(await getSettings()), ...patch };
  if (next.defaultProvider && !adapters[next.defaultProvider]) next.defaultProvider = null;
  await fs.mkdir(DATA_DIR, { recursive: true });
  let file: Record<string, unknown> = {};
  try {
    file = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
  } catch {}
  await fs.writeFile(SETTINGS_FILE, JSON.stringify({ ...file, agents: next }, null, 2));
  return next;
}
