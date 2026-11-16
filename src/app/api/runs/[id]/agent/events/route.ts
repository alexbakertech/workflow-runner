import type { AgentJob } from "@/lib/agents";
import { jobsForRun, subscribe } from "@/lib/server/jobs";

type Ctx = { params: Promise<{ id: string }> };

/** Server-sent events: a snapshot of this run's recent jobs, then every change as it happens. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send("snapshot", { jobs: await jobsForRun(id) });
      const unsubscribe = subscribe((job: AgentJob) => {
        if (job.runId === id) send("job", job);
      });
      // Comments keep proxies and browsers from timing the connection out.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 20_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup(), { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
