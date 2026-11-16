import { NextResponse } from "next/server";
import { COOKIE, COOKIE_MAX_AGE, tokenMatches } from "@/lib/server/token";

export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!tokenMatches(token)) return NextResponse.json({ error: "That token doesn’t match." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, (token ?? "").trim().toLowerCase(), { httpOnly: true, sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
  return res;
}
