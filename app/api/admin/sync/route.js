import { NextResponse } from "next/server";
import { getSetup, todayIn } from "../../../../lib/config";
import { syncRange, syncBests, DAY, shift } from "../../../../lib/sync";
import { jsonOnly, fail } from "../../../../lib/guard";
import { isMock } from "../../../../lib/providers";
import { importDoc, closeBlocks } from "../../../../lib/store";
import { demoSeed } from "../../../../lib/demoSeed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req) {
  const bad = jsonOnly(req); if (bad) return bad;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.close) return NextResponse.json(await closeBlocks(todayIn(getSetup().cfg.timezone)));
    if (b.bests) return NextResponse.json(await syncBests());
    if (!DAY.test(b.from) || !DAY.test(b.to) || b.from > b.to) return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
    if (shift(b.from, 70) < b.to) return NextResponse.json({ error: "Range too long. Sync at most 70 days per call." }, { status: 400 });
    const r = await syncRange(getSetup(), b.from, b.to);
    if (isMock()) await importDoc(demoSeed()); // demo mode only: synthetic blocks so the History page has something to show
    return NextResponse.json(r);
  } catch (e) { return fail(e); }
}
