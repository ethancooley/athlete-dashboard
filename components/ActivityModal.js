"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import EChart from "./EChart";
import { f1, hms, paceMi, shortDate } from "../lib/fmt";
import { runOption } from "../lib/charts";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false, loading: () => <div className="skeleton" style={{ height: 340 }} /> });

function parseLaps(lines) {
  return (lines || []).map((l) => { const m = /^#(\d+)\s+\S+\s+\[(\w+)\]\s+(\S+)\s+([\d.]+)km\s+(\d+):(\d+)\/km\s+HR(\d+)\/(\d+)\s+cad(\d+)/.exec(l); if (!m || +m[4] < 0.2) return null; return { n: +m[1], dur: m[3], mi: +m[4] / 1.609344, pace: (+m[5] * 60 + +m[6]) * 1.609344, hr: +m[7], maxhr: +m[8], cad: +m[9] }; }).filter(Boolean);
}
const Tile = ({ v, l }) => (v == null || v === "" ? null : <div className="tile"><b>{v}</b><span>{l}</span></div>);

export function RunDetail({ run, band }) {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => {
    let dead = false; setD(null); setErr("");
    fetch("/api/activity/" + run.id).then((r) => r.json().then((j) => ({ ok: r.ok, j }))).then(({ ok, j }) => { if (dead) return; if (!ok) setErr(j.error || "Could not load this run."); else setD(j); }).catch(() => !dead && setErr("Could not load this run."));
    return () => { dead = true; };
  }, [run.id]);
  const opt = useMemo(() => (d && d.points && d.points.length > 2 ? runOption(d.points, band || undefined) : null), [d]);
  if (err) return <div className="empty">{err}</div>;
  if (!d) return <div className="skeleton" style={{ height: 380 }} />;
  const s = d.session || {}, laps = d.lapRows && d.lapRows.length ? d.lapRows : parseLaps(d.laps);
  return (
    <div>
      <div className="lab-head"><h4>{run.name}</h4><span>{run.date ? shortDate(run.date) : ""}{run.mi > 0 ? " · " + f1(run.mi) + " mi · " + hms(run.sec) + " · " + paceMi(run.sec / run.mi) + "/mi" : ""}</span></div>
      {d.demo && <div className="banner" style={{ marginTop: 10 }}>Demo mode: synthetic run, generated for the preview.</div>}
      <div className="tiles">
        <Tile v={s.avg_heart_rate ? s.avg_heart_rate + " bpm" : null} l="Average HR" /><Tile v={s.total_training_effect} l="Aerobic effect" /><Tile v={s.training_load_peak != null ? f1(s.training_load_peak) : null} l="Training load" />
        <Tile v={s.avg_cadence ? s.avg_cadence + " spm" : null} l="Cadence" /><Tile v={s.avg_stance_time ? Math.round(s.avg_stance_time) + " ms" : null} l="Ground contact" /><Tile v={s.avg_vertical_oscillation ? f1(s.avg_vertical_oscillation / 10) + " cm" : null} l="Vertical oscillation" />
        <Tile v={s.avg_step_length ? (s.avg_step_length / 1000).toFixed(2) + " m" : null} l="Step length" /><Tile v={s.avg_power ? s.avg_power + " W" : null} l="Average power" />
      </div>
      <div className="grid">
        <div className="s5 p" style={{ gridColumn: "span 12" }}><h3>Route <small>colored by speed</small></h3><RouteMap points={d.points || []} /></div>
        <div className="p" style={{ gridColumn: "span 12" }}><h3>Pace, heart rate and elevation <small>{band ? "shaded = goal pace (" + paceMi(band[0]) + " to " + paceMi(band[1]) + "/mi)" : ""}</small></h3>
          {opt ? <EChart option={opt} height={360} /> : <div className="empty">No stream data for this run{d.streamStatus ? " (" + d.streamStatus + ")" : ""}.</div>}</div>
        <div className="p s7"><h3>Splits</h3><div className="tw"><table><thead><tr><th>#</th><th>Mi</th><th>Time</th><th>Pace</th><th>HR avg / max</th><th>Cadence</th></tr></thead>
          <tbody>{laps.length ? laps.map((l) => <tr key={l.n}><td>{l.n}</td><td>{l.mi.toFixed(2)}</td><td>{l.dur}</td><td>{paceMi(l.pace)}</td><td>{l.hr != null ? l.hr + (l.maxhr != null ? " / " + l.maxhr : "") : "-"}</td><td>{l.cad != null ? l.cad : "-"}</td></tr>) : <tr><td colSpan="6" className="empty">No laps recorded</td></tr>}</tbody></table></div></div>
        <div className="p s5"><h3>Time in heart-rate zones</h3>
          {d.zones ? Object.keys(d.zones).sort().map((k) => <div className="zrow" key={k}><span>{k.toUpperCase()}</span><div className="zbar"><i style={{ width: d.zones[k].pct + "%" }} /></div><span>{d.zones[k].time} · {d.zones[k].pct}%</span></div>) : <div className="empty">No zone data</div>}</div>
      </div>
    </div>
  );
}


// Every detail of one activity (route, pace, heart rate, elevation, splits, zones) in an overlay, so it opens at the top of the screen wherever it was clicked.
export default function ActivityModal({ run, band, onClose }) {
  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!run) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={run.name || "Activity"}>
      <div className="modal">
        <button className="modal-x" onClick={onClose} aria-label="Close" autoFocus>Close</button>
        <RunDetail run={run} band={band} />
      </div>
    </div>
  );
}
