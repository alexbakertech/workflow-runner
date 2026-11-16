import { NextResponse } from "next/server";
import { activeByRun } from "@/lib/server/jobs";
import { startNextRound } from "@/lib/server/runs";

type Ctx = { params: Promise<{ id: string }> };

/** Start the next round: { stepIndex } of a review whose decision is "loop", or of a step recommending more research (plus { answers }). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { stepIndex, answers } = (await req.json()) as { stepIndex?: number; answers?: string };
  if (!Number.isInteger(stepIndex)) return NextResponse.json({ error: "Missing stepIndex." }, { status: 400 });
  if ((await activeByRun())[id] !== undefined)
    return NextResponse.json({ error: "An agent is still working on this run. Wait for it or cancel it first." }, { status: 409 });
  try {
    const next = await startNextRound(id, stepIndex!, typeof answers === "string" ? answers : "");
    return NextResponse.json({ id: next.id, round: next.round });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
