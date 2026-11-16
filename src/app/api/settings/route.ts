import { NextResponse } from "next/server";
import { REVISE_POLICIES, type AgentSettings } from "@/lib/agents";
import { getSettings, saveSettings } from "@/lib/server/agents";

export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<AgentSettings>;
  const patch: Partial<AgentSettings> = {};
  if ("defaultProvider" in body) patch.defaultProvider = body.defaultProvider ?? null;
  if (body.models && typeof body.models === "object") patch.models = body.models;
  if (typeof body.autoAdvance === "boolean") patch.autoAdvance = body.autoAdvance;
  if (REVISE_POLICIES.some((p) => p.id === body.onRevise)) patch.onRevise = body.onRevise;
  return NextResponse.json({ settings: await saveSettings(patch) });
}
