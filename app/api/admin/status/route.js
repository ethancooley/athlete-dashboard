import { NextResponse } from "next/server";
import { getSetup, todayIn } from "../../../../lib/config";
import { counts } from "../../../../lib/store";
import { q } from "../../../../lib/db";
import { fail } from "../../../../lib/guard";
import { isMock } from "../../../../lib/providers";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { cfg } = getSetup();
    const state = await q(`SELECT key, value, updated_at FROM sync_state`);
    return NextResponse.json({ counts: await counts(), state, today: todayIn(cfg.timezone), historyStart: cfg.historyStart, demo: isMock() });
  } catch (e) { return fail(e); }
}
