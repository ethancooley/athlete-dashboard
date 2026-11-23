import { NextResponse } from "next/server";
import { getDashboard } from "../../../lib/providers";
import { getSetup } from "../../../lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
let cache = null; // per-instance, 5 minutes
export async function GET(req) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  if (!refresh && cache && Date.now() - cache.at < 5 * 60 * 1000) return NextResponse.json(cache.data);
  try {
    const data = await getDashboard(getSetup());
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    if (cache) return NextResponse.json({ ...cache.data, stale: true, error: String(e.message || e).slice(0, 200) });
    return NextResponse.json({ error: String(e.message || e).slice(0, 300) }, { status: 502 });
  }
}
