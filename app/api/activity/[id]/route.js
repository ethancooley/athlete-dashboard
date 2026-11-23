import { NextResponse } from "next/server";
import { getActivity } from "../../../../lib/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(_req, { params }) {
  if (!/^\d{5,20}$/.test(params.id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try { return NextResponse.json(await getActivity(params.id)); }
  catch (e) { return NextResponse.json({ error: String(e.message || e).slice(0, 300) }, { status: 502 }); }
}
