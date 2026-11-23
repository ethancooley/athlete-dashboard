import { NextResponse } from "next/server";
// State-changing admin calls must be JSON (a cross-site form post cannot send that without a CORS preflight).
export const jsonOnly = (req) => ((req.headers.get("content-type") || "").includes("application/json") ? null : NextResponse.json({ error: "JSON body required" }, { status: 415 }));
export const fail = (e, status = 502) => NextResponse.json({ error: String((e && e.message) || e).slice(0, 300) }, { status });
