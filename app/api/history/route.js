import { NextResponse } from "next/server";
import { loadHistory } from "../../../lib/store";
import { getSetup, todayIn } from "../../../lib/config";
import { fail } from "../../../lib/guard";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { cfg } = getSetup();
    return NextResponse.json({ ...(await loadHistory()), today: todayIn(cfg.timezone) });
  } catch (e) { return fail(e); }
}
