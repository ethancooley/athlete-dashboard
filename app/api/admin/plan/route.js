import { NextResponse } from "next/server";
import { blocksWithPlans, getPlan, planVersions, savePlanVersion } from "../../../../lib/store";
import { applyEdits } from "../../../../lib/planEdit";
import { jsonOnly, fail } from "../../../../lib/guard";

export const dynamic = "force-dynamic";
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;

// GET /api/admin/plan                -> blocks that have a plan
// GET /api/admin/plan?block=x[&version=n] -> that plan (latest by default) and its version list
export async function GET(req) {
  const u = new URL(req.url), block = u.searchParams.get("block"), v = Number(u.searchParams.get("version")) || null;
  try {
    if (!block) return NextResponse.json({ blocks: await blocksWithPlans() });
    if (!SLUG.test(block)) return NextResponse.json({ error: "Bad block" }, { status: 400 });
    const p = await getPlan(block, v);
    if (!p) return NextResponse.json({ error: "No such plan" }, { status: 404 });
    return NextResponse.json({ block, version: p.version, plan: p.plan, versions: await planVersions(block) });
  } catch (e) { return fail(e); }
}

// POST { block, edits:[{date, miles?, text?, type?, tag?}], note? }  -> saves a new version
// POST { block, restore: n, note? }                                  -> saves version n again as the newest version
export async function POST(req) {
  const bad = jsonOnly(req); if (bad) return bad;
  const b = await req.json().catch(() => null);
  if (!b || !SLUG.test(b.block || "")) return NextResponse.json({ error: "block is required" }, { status: 400 });
  try {
    const cur = await getPlan(b.block);
    if (!cur) return NextResponse.json({ error: "No plan for that block" }, { status: 404 });
    let next, note = String(b.note || "").slice(0, 300);
    if (b.restore) {
      const old = await getPlan(b.block, Number(b.restore));
      if (!old) return NextResponse.json({ error: "No such version" }, { status: 404 });
      next = old.plan; note = note || "Restored version " + old.version;
    } else next = applyEdits(cur.plan, b.edits);
    const v = await savePlanVersion(b.block, next, note);
    return NextResponse.json({ saved: !!v, version: v || cur.version });
  } catch (e) { return fail(e, /^(Each edit|No day|Miles|Workout|Type|Tag|Plan has|No edits|Too many)/.test(String(e.message)) ? 400 : 502); }
}
