"use client";
import { useState } from "react";
export default function Login() {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) { window.location.href = "/"; return; }
    const j = await r.json().catch(() => ({})); setErr(j.error || "Could not sign in."); setBusy(false);
  }
  return (
    <main className="login"><form onSubmit={submit}>
      <h1>Training dashboard</h1><p>Sign in to continue.</p>
      <input type="password" autoComplete="current-password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
      <button disabled={busy || !pw}>{busy ? "Signing in..." : "Sign in"}</button><div className="err" role="alert">{err}</div>
    </form></main>
  );
}
