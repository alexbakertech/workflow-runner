import { NextResponse } from "next/server";
import { PROVIDERS, type ProviderId } from "@/lib/agents";
import { AgentError } from "@/lib/server/agents/shared";
import { cancelJobs, jobsForRun, startFix, startJob } from "@/lib/server/jobs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return NextResponse.json({ jobs: await jobsForRun((await params).id) });
}

/**
 * Start an agent on a step: { stepIndex, provider, model?, autoAdvance? }.
 * With { fixFrom } instead of stepIndex, corrects the step that check checked, then runs the check again.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as { stepIndex?: number; fixFrom?: number; provider?: ProviderId; model?: string; autoAdvance?: boolean };
  const fix = Number.isInteger(body.fixFrom);
  if ((!fix && !Number.isInteger(body.stepIndex)) || !PROVIDERS.some((p) => p.id === body.provider))
    return NextResponse.json({ error: "Choose a step and a provider." }, { status: 400 });
  try {
    const base = { runId: id, provider: body.provider!, model: typeof body.model === "string" ? body.model : "", autoAdvance: Boolean(body.autoAdvance) };
    const job = fix ? await startFix(base, body.fixFrom!) : await startJob({ ...base, stepIndex: body.stepIndex! });
    return NextResponse.json({ job });
  } catch (e) {
    const message = e instanceof AgentError ? e.message : "Couldn’t start the agent.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

/** Cancel whatever is queued or running for this run. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return NextResponse.json({ cancelled: await cancelJobs((await params).id) });
}
