"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import TopBar from "./TopBar";
import PlanEditor from "./PlanEditor";

const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; });
const monthsBetween = (from, to) => { const out = []; let s = from; while (s <= to) { const d = new Date(s + "T12:00:00Z"); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)); const end = e.toISOString().slice(0, 10) < to ? e.toISOString().slice(0, 10) : to; out.push([s, end]); const n = new Date(e); n.setUTCDate(n.getUTCDate() + 1); s = n.toISOString().slice(0, 10); } return out; };

export default function AdminView() {
  const [st, setSt] = useState(null), [err, setErr] = useState(""), [log, setLog] = useState(""), [busy, setBusy] = useState(false), [from, setFrom] = useState(""), [text, setText] = useState("");
  const stop = useRef(false);
  const say = (m) => setLog((l) => l + m + "\n");
  const load = useCallback(() => fetch("/api/admin/status").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setSt(j); setFrom((f) => f || j.historyStart || ""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function backfill() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { setErr("Enter the start date as YYYY-MM-DD"); return; }
    setBusy(true); setErr(""); setLog(""); stop.current = false;
    try {
      for (const [a, b] of monthsBetween(from, st.today)) { if (stop.current) { say("Stopped."); break; } const r = await post("/api/admin/sync", { from: a, to: b }); say(`${a} to ${b}: ${r.acts} activities, ${r.daily} days`); }
      if (!stop.current) { const r = await post("/api/admin/sync", { bests: true }); say(`Best efforts: ${r.bests}`); say("Done."); }
    } catch (e) { setErr(e.message); say("Stopped on an error. Run it again; finished months are safe to repeat."); }
    setBusy(false); load();
  }
  async function doImport() {
    setBusy(true); setErr(""); setLog("");
    try { JSON.parse(text); const r = await post("/api/admin/import", JSON.parse(text)); say(`Imported ${r.blocks} blocks, ${r.races} races, ${r.plans} new plan versions.` + (r.skipped.length ? " Skipped: " + r.skipped.join(", ") : "")); }
    catch (e) { setErr(e.message); }
    setBusy(false); load();
  }
  async function closeNow() {
    setBusy(true); setErr(""); setLog("");
    try { const r = await post("/api/admin/sync", { close: true }); say(`Filled ${r.races} race time${r.races === 1 ? "" : "s"} and ${r.blocks} block result${r.blocks === 1 ? "" : "s"}.` + (r.notes.length ? " " + r.notes.join("; ") : "")); }
    catch (e) { setErr(e.message); }
    setBusy(false); load();
  }
  const c = st && st.counts, last = st && st.state.find((s) => s.key === "last_sync");
  return (
    <>
      <TopBar active="/admin" />
      <main className="wrap admin">
        <section className="sec">
          <h2>Admin</h2>
          <p className="lede">Load your history, keep it current, and import blocks, races and plans.</p>
          {err && <div className="banner err">{err}</div>}
          {st && st.demo && <div className="banner">Demo mode: syncing creates synthetic data.</div>}
          <div className="p"><h3>Stored</h3>
            {c ? <div className="tiles" style={{ margin: 0 }}>
              <div className="tile"><b>{c.acts}</b><span>Activities</span></div><div className="tile"><b>{c.daily}</b><span>Daily rows</span></div><div className="tile"><b>{c.blocks}</b><span>Blocks</span></div><div className="tile"><b>{c.races}</b><span>Races</span></div><div className="tile"><b>{c.plans}</b><span>Plan versions</span></div>
            </div> : <div className="empty">Loading</div>}
            {c && c.first && <p className="chart-note">Activities from {c.first} to {c.last}.{last ? " Last sync " + new Date(last.value.at).toLocaleString() + "." : ""} A nightly job refreshes the last 14 days.</p>}
          </div>
          <div className="p"><h3>Backfill history</h3>
            <p className="chart-note" style={{ marginTop: 0 }}>Pulls activities and daily metrics one month at a time from the date below. Safe to run again.</p>
            <p><label>From <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" style={{ background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", font: "inherit", marginLeft: 6 }} /></label></p>
            <button onClick={backfill} disabled={busy || !st}>{busy ? "Working..." : "Run backfill"}</button> {busy && <button onClick={() => { stop.current = true; }}>Stop</button>}
            <div className="log" aria-live="polite">{log}</div>
          </div>
          <div className="p"><h3>Import blocks, races and plans</h3>
            <p className="chart-note" style={{ marginTop: 0 }}>Paste JSON with <code>blocks</code>, <code>races</code> and <code>plans</code>. Same slug or id overwrites; an unchanged plan is not versioned twice.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{"blocks":[],"races":[],"plans":[]}' aria-label="Import JSON" />
            <p className="chart-note">A block may include <code>settings</code> (<code>event</code>, <code>anchor</code>, <code>gates</code>, <code>goalPaceBand</code>, <code>trainStart</code>) that apply while it is the active block.</p>
            <p style={{ marginTop: 8 }}><input type="file" accept="application/json,.json" onChange={async (e) => { const f = e.target.files[0]; if (f) setText(await f.text()); }} /> <button onClick={doImport} disabled={busy || !text.trim()}>Import</button></p>
          </div>
          <PlanEditor />
          <div className="p"><h3>Close finished blocks</h3>
            <p className="chart-note" style={{ marginTop: 0 }}>Runs nightly. For each past race without a time, it takes the time from the run on race day that matches the distance, then writes the block's result if it is empty. Nothing already filled in is changed.</p>
            <button onClick={closeNow} disabled={busy}>Run now</button>
          </div>
        </section>
      </main>
    </>
  );
}
