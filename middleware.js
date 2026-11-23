import { NextResponse } from "next/server";
import { verifyToken, COOKIE } from "./lib/auth";

export async function middleware(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !process.env.DASH_PASSWORD) {
    return new NextResponse("Server is not configured: set DASH_PASSWORD and SESSION_SECRET.", { status: 500 });
  }
  const ok = await verifyToken(secret, req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
// Everything is private except the login page, its API, and static assets.
export const config = { matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"] };
