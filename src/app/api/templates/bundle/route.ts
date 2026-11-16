import { singleFileBundle } from "@/lib/bundle";
import { getTemplate } from "@/lib/server/store";

export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get("hash");
  if (!hash) return Response.json({ error: "Add ?hash= with the workflow's hash (see GET /api/templates)." }, { status: 400 });
  const entry = await getTemplate(hash);
  if (!entry) return Response.json({ error: "Workflow not found." }, { status: 404 });
  const { fileName, content } = singleFileBundle(entry.template);
  return new Response(content, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"` } });
}
