import { NextResponse } from "next/server";
import { PROVIDERS, type ProviderId } from "@/lib/agents";
import { AgentError } from "@/lib/server/agents/shared";
import { startFollowUp } from "@/lib/server/jobs";

type Ctx = { params: Promise<{ id: string }> };

/** Follow-up on a step that recommended more research: { stepIndex, answers?, kind?: "research" | "answers", provider?, model? }. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as { stepIndex?: number; answers?: string; kind?: string; provider?: ProviderId; model?: string };
  if (!Number.isInteger(body.stepIndex)) return NextResponse.json({ error: "Missing stepIndex." }, { status: 400 });
  const provider = PROVIDERS.some((p) => p.id === body.provider) ? body.provider : undefined;
  try {
    const kind = body.kind === "answers" ? "answers" : "research";
    const job = await startFollowUp(id, body.stepIndex!, typeof body.answers === "string" ? body.answers : "", kind, provider, body.model);
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json({ error: e instanceof AgentError ? e.message : "Couldn’t start the follow-up." }, { status: 409 });
  }
}
