import { NextResponse } from "next/server";
import { allStatuses, getSettings } from "@/lib/server/agents";

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.has("refresh");
  const [providers, settings] = await Promise.all([allStatuses(refresh), getSettings()]);
  return NextResponse.json({ providers, settings });
}
