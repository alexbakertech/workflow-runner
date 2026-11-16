import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, COOKIE_MAX_AGE, tokenMatches } from "@/lib/server/token";

const PUBLIC = ["/login", "/api/auth/login", "/api/health"];

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  // A link with ?token=… signs this device in, then drops the token from the address bar.
  const fromQuery = searchParams.get("token");
  if (fromQuery && tokenMatches(fromQuery)) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("token");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, fromQuery.trim().toLowerCase(), { httpOnly: true, sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
    return res;
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (tokenMatches(req.cookies.get(COOKIE)?.value) || (bearer && tokenMatches(bearer))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in with the access token first." }, { status: 401 });
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
