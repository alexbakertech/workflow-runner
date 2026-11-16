import { NextResponse } from "next/server";
import { verifyRun } from "@/lib/server/hash";
import { deleteRun, getRun, updateRun } from "@/lib/server/store";
import type { WorkflowRun } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const run = await getRun((await params).id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json({ run, verification: verifyRun(run) });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { run } = (await req.json()) as { run: WorkflowRun };
  const current = await getRun(id);
  // A copy from before the next round started would write the old round's steps over the new one.
  if (current && (current.round ?? 1) !== (run.round ?? 1))
    return NextResponse.json(
      { error: `This run has moved on to round ${current.round ?? 1}.`, run: current, verification: verifyRun(current) },
      { status: 409 },
    );
  const saved = await updateRun(id, (existing) => {
    // A step an agent filled in that this client hasn't loaded yet wins over the client's stale copy.
    let agentNewer = false;
    const steps = run.steps.map((s, i) => {
      const cur = existing.steps[i];
      if (cur?.agent?.jobId && cur.agent.jobId !== s.agent?.jobId) {
        agentNewer = true;
        return cur;
      }
      return s;
    });
    // The workflow definition and its hash are fixed when the run is created.
    return {
      ...run,
      steps,
      ...(agentNewer ? { position: existing.position, status: existing.status, completedAt: existing.completedAt } : {}),
      id,
      format: "workflow-run",
      formatVersion: 1,
      template: existing.template,
      tag: existing.tag,
      createdAt: existing.createdAt,
      importVerification: existing.importVerification,
      // Rounds are started on the server.
      round: existing.round,
      roundStartedAt: existing.roundStartedAt,
      carryOver: existing.carryOver,
      rounds: existing.rounds,
      followUps: existing.followUps,
    };
  });
  if (!saved) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json({ run: saved, verification: verifyRun(saved) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await deleteRun((await params).id);
  return NextResponse.json({ ok: true });
}
