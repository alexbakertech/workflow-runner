import { listSamples, loadSamples } from "@/lib/server/samples";
import { listRuns } from "@/lib/server/store";

export async function GET() {
  return Response.json({ samples: await listSamples(), anyRuns: (await listRuns()).length > 0 });
}
export async function POST() {
  return Response.json(await loadSamples());
}
