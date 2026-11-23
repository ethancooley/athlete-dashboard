import { NextResponse } from "next/server";
import { makeToken, sha256, safeEqual, COOKIE } from "../../../lib/auth";

const tries = new Map(); // ip -> [timestamps]; best-effort throttle per server instance
export async function POST(req) {
  const ip = (req.headers.get("x-forwarded-for") || "x").split(",")[0].trim();
  const now = Date.now();
  const recent = (tries.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 6) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  let body = {};
  try { body = await req.json(); } catch {}
  const good = safeEqual(await sha256(String(body.password || "")), await sha256(process.env.DASH_PASSWORD || "\u0000"));
  if (!good) {
    tries.set(ip, [...recent, now]);
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  tries.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(process.env.SESSION_SECRET, 30), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400,
  });
  return res;
}
