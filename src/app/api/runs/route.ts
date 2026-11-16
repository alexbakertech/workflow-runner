import { NextResponse } from "next/server";
import { createRun } from "@/lib/server/runs";
import { activeByRun } from "@/lib/server/jobs";
import { getTemplate, listRuns, saveRun } from "@/lib/server/store";

export async function GET() {
  const [runs, active] = await Promise.all([listRuns(), activeByRun()]);
  return NextResponse.json({ runs: runs.map((r) => (r.id in active ? { ...r, agentStep: active[r.id] } : r)) });
}

export async function POST(req: Request) {
  const { templateHash } = (await req.json()) as { templateHash?: string };
  const entry = templateHash ? await getTemplate(templateHash) : null;
  if (!entry) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  const run = await saveRun(createRun(entry));
  return NextResponse.json({ id: run.id });
}
