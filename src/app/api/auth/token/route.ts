import { NextResponse } from "next/server";
import path from "node:path";
import { COOKIE, COOKIE_MAX_AGE, TOKEN_FILE, getToken, regenerateToken, tokenSource } from "@/lib/server/token";

const info = () => ({
  token: getToken(),
  source: tokenSource(),
  file: path.relative(process.cwd(), TOKEN_FILE).split(path.sep).join("/"),
});

/** Shows the token to someone already signed in (the proxy guards this route). */
export function GET() {
  return NextResponse.json(info());
}

/** Makes a new token. Other devices will need to sign in again; this one stays signed in. */
export function POST() {
  const token = regenerateToken();
  if (!token) return NextResponse.json({ error: "The token is set by ACCESS_TOKEN in the environment, so it can’t be changed here." }, { status: 409 });
  const res = NextResponse.json(info());
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
  return res;
}
