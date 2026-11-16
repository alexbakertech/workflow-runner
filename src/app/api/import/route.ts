import { NextResponse } from "next/server";
import { verifyRun } from "@/lib/server/hash";
import { getRun, newRunId, saveTemplate, writeRunRaw } from "@/lib/server/store";
import type { WorkflowRun } from "@/lib/types";
import { validateTemplate } from "@/lib/workflow";

/**
 * Accepts any JSON the user drops on the home page and works out what it is:
 *  - a workflow template            → saved to the workflow list
 *  - a workflow run (output file)   → imported and verified
 */
export async function POST(req: Request) {
  const { data, fileName = "upload.json" } = (await req.json()) as { data: unknown; fileName?: string };
  const fail = (error: string, details?: string[]) => NextResponse.json({ error, details }, { status: 400 });
  const d = data as Record<string, unknown>;

  if (d?.format === "workflow-run") {
    const run = data as WorkflowRun;
    if (!run.template?.definition || !Array.isArray(run.steps)) return fail("This run file is missing its workflow.");
    const verification = verifyRun(run);
    const { template } = validateTemplate(run.template.definition);
    // Only add the run's workflow to the list if it still matches its fingerprint.
    if (template && verification.templateHashOk) await saveTemplate(template, run.template.sourceFile || fileName);
    const imported: WorkflowRun = {
      ...run,
      id: run.id && !(await getRun(run.id)) ? run.id : newRunId(),
      importVerification: { ...verification, importedAt: new Date().toISOString(), sourceFile: fileName },
    };
    await writeRunRaw(imported);
    return NextResponse.json({ kind: "run", id: imported.id, verification });
  }

  if (d?.format === "workflow-template" || Array.isArray(d?.steps)) {
    const { template, errors } = validateTemplate({ format: "workflow-template", ...d });
    if (!template) return fail("This workflow file has problems:", errors);
    const entry = await saveTemplate(template, fileName);
    return NextResponse.json({ kind: "template", hash: entry.hash, tag: entry.tag, title: template.title });
  }

  return fail("This file isn’t a workflow or a run file. Load a workflow JSON (to start a run) or a .run.json file (to view its summary).");
}
