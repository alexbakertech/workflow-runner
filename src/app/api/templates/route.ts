import { NextResponse } from "next/server";
import { deleteTemplate, listRuns, listTemplates } from "@/lib/server/store";

export async function GET() {
  const [templates, runs] = await Promise.all([listTemplates(), listRuns()]);
  return NextResponse.json({
    templates: templates.map((t) => ({ ...t, runCount: runs.filter((r) => r.templateHash === t.hash).length })),
  });
}

export async function DELETE(req: Request) {
  const hash = new URL(req.url).searchParams.get("hash");
  if (!hash || !(await deleteTemplate(hash)))
    return NextResponse.json({ error: "Only uploaded workflows can be removed." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
