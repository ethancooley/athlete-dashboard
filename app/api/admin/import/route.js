import { NextResponse } from "next/server";
import { importDoc } from "../../../../lib/store";
import { jsonOnly, fail } from "../../../../lib/guard";

export const dynamic = "force-dynamic";
export async function POST(req) {
  const bad = jsonOnly(req); if (bad) return bad;
  const text = await req.text();
  if (text.length > 2_000_000) return NextResponse.json({ error: "Too large (2 MB max)" }, { status: 413 });
  let doc; try { doc = JSON.parse(text); } catch { return NextResponse.json({ error: "Not valid JSON" }, { status: 400 }); }
  if (!doc || typeof doc !== "object") return NextResponse.json({ error: "Expected an object with blocks, races and plans" }, { status: 400 });
  try { return NextResponse.json(await importDoc(doc)); } catch (e) { return fail(e); }
}
