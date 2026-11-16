import { NextResponse } from "next/server";

/** Unauthenticated liveness check for the Docker healthcheck. */
export function GET() {
  return NextResponse.json({ ok: true });
}
