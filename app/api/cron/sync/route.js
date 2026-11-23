import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { getSetup, todayIn } from "../../../../lib/config";
import { syncRange, syncBests, shift } from "../../../../lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const h = (s) => createHash("sha256").update(String(s)).digest();
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Without CRON_SECRET set, this route refuses to run.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!timingSafeEqual(h(given), h(secret))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const setup = getSetup(), today = todayIn(setup.cfg.timezone);
    const r = await syncRange(setup, shift(today, -14), today);
    const b = await syncBests().catch((e) => ({ bests_error: String(e.message).slice(0, 120) }));
    return NextResponse.json({ ok: true, ...r, ...b });
  } catch (e) { return NextResponse.json({ error: String(e.message || e).slice(0, 300) }, { status: 502 }); }
}
