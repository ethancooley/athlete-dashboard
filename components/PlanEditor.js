"use client";
import { useCallback, useEffect, useState } from "react";

const TYPES = ["norm", "key", "rest", "strength", "race"];
const call = (url, body) => fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; });
const field = { background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", font: "inherit" };

// Edit one week of a block's plan. Saving writes a new version; earlier versions stay and can be restored.
export default function PlanEditor() {
  const [blocks, setBlocks] = useState(null), [block, setBlock] = useState(""), [data, setData] = useState(null), [wi, setWi] = useState(0), [draft, setDraft] = useState({}), [note, setNote] = useState(""), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);

  useEffect(() => { call("/api/admin/plan").then((j) => { setBlocks(j.blocks); if (j.blocks[0]) setBlock(j.blocks[0].slug); }).catch((e) => setErr(e.message)); }, []);
  const load = useCallback((slug, keepWeek) => { if (!slug) return; call("/api/admin/plan?block=" + encodeURIComponent(slug)).then((j) => { setData(j); setDraft({}); if (!keepWeek) { const t = new Date().toISOString().slice(0, 10), i = j.plan.weeks.findIndex((w) => w.days.some((d) => d.date >= t)); setWi(i >= 0 ? i : 0); } }).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { load(block); }, [block, load]);

  const week = data && data.plan.weeks[wi];
  const val = (d, k) => (draft[d.date] && draft[d.date][k] !== undefined ? draft[d.date][k] : d[k] == null ? "" : d[k]);
  const set = (d, k, v) => setDraft((x) => ({ ...x, [d.date]: { ...(x[d.date] || {}), [k]: v } }));
  const changed = Object.keys(draft).filter((k) => Object.keys(draft[k]).length);

  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const edits = changed.map((date) => ({ date, ...draft[date] }));
      const r = await call("/api/admin/plan", { block, edits, note });
      setMsg(r.saved ? "Saved as version " + r.version + "." : "No change from the current version."); setNote(""); load(block, true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function restore(v) {
    setBusy(true); setErr(""); setMsg("");
    try { const r = await call("/api/admin/plan", { block, restore: v }); setMsg(r.saved ? "Version " + v + " restored as version " + r.version + "." : "That is already the current version."); load(block, true); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }

  if (blocks && !blocks.length) return <div className="p"><h3>Edit plan</h3><p className="chart-note" style={{ marginTop: 0 }}>No plans yet. Import a block with a plan above, then edit it here.</p></div>;
  return (
    <div className="p"><h3>Edit plan</h3>
      <p className="chart-note" style={{ marginTop: 0 }}>Change a day and save. Each save is a new version, so the History page keeps what the plan said before. The dashboard shows the latest version of the block that contains today.</p>
      {err && <div className="banner err">{err}</div>}
      {msg && <div className="banner">{msg}</div>}
      {blocks && data && <>
        <p>
          <select value={block} onChange={(e) => setBlock(e.target.value)} style={field} aria-label="Block">{blocks.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select>{" "}
          <select value={wi} onChange={(e) => { setWi(Number(e.target.value)); }} style={field} aria-label="Week">{data.plan.weeks.map((w, i) => <option key={i} value={i}>{w.title}{w.dates ? " · " + w.dates : ""}</option>)}</select>{" "}
          <span className="chart-note">Version {data.version} of {data.versions.length}</span>
        </p>
        {week && <div className="tw"><table className="race"><thead><tr><th>Day</th><th>Miles</th><th>Workout</th><th>Type</th><th>Tag</th></tr></thead><tbody>
          {week.days.map((d) => <tr key={d.date}>
            <td>{d.dow}<span>{d.label}</span></td>
            <td><input type="number" min="0" max="120" step="0.1" value={val(d, "miles")} onChange={(e) => set(d, "miles", e.target.value)} style={{ ...field, width: 72 }} aria-label={"Miles " + d.date} /></td>
            <td><input value={val(d, "text")} onChange={(e) => set(d, "text", e.target.value)} style={{ ...field, width: "100%", minWidth: 180 }} aria-label={"Workout " + d.date} /></td>
            <td><select value={val(d, "type")} onChange={(e) => set(d, "type", e.target.value)} style={field} aria-label={"Type " + d.date}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
            <td><input value={val(d, "tag")} onChange={(e) => set(d, "tag", e.target.value)} style={{ ...field, width: 120 }} aria-label={"Tag " + d.date} /></td>
          </tr>)}
        </tbody></table></div>}
        <p style={{ marginTop: 8 }}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (optional)" style={{ ...field, width: 240 }} aria-label="Note for this version" />{" "}
          <button onClick={save} disabled={busy || !changed.length}>{busy ? "Saving..." : changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "No changes"}</button>{" "}
          {changed.length > 0 && <button onClick={() => setDraft({})} disabled={busy}>Discard</button>}</p>
        <details style={{ marginTop: 10 }}><summary className="chart-note">Versions</summary>
          <div className="tw"><table className="race"><thead><tr><th>Version</th><th>Saved</th><th>Note</th><th></th></tr></thead><tbody>
            {data.versions.map((v) => <tr key={v.version}><td>{v.version}</td><td>{new Date(v.created_at).toLocaleString()}</td><td>{v.note || ""}</td><td>{v.version !== data.version && <button onClick={() => restore(v.version)} disabled={busy}>Restore</button>}</td></tr>)}
          </tbody></table></div>
        </details>
      </>}
    </div>
  );
}
