"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import TopBar from "./TopBar";
import { hms, paceMi, shortDate } from "../lib/fmt";
import { STD, stdOf, personalRecords, paceOf, matchRun } from "../lib/history";
import ActivityModal from "./ActivityModal";
import { progressionOption } from "../lib/historyCharts";

const when = (d) => `${shortDate(d)}, ${d.slice(0, 4)}`;
const src = (s) => (s === "official" ? "Official" : "Watch time");
const effortLabel = (d) => (d === "1k" ? "1 km" : d === "mile" ? "Mile" : d === "5k" ? "5K" : d === "10k" ? "10K" : d.replace(/^./, (c) => c.toUpperCase()));

export default function RecordsView() {
  const [data, setData] = useState(null), [err, setErr] = useState(""), [open, setOpen] = useState(null);
  useEffect(() => { fetch("/api/history").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not load records"); setData(j); }).catch((e) => setErr(e.message)); }, []);
  const acts = data ? data.acts : [];
  const forRace = (r) => matchRun(r, acts);
  const forEffort = (b) => { if (!b.activity_id) return null; return acts.find((a) => a.id === String(b.activity_id)) || { id: String(b.activity_id), name: effortLabel(b.distance) + " best effort", date: b.achieved_on }; };
  const prs = useMemo(() => (data ? personalRecords(data.races) : {}), [data]);
  const done = useMemo(() => (data ? data.races.filter((r) => !r.planned) : []), [data]);
  const upcoming = useMemo(() => (data ? data.races.filter((r) => r.planned).sort((a, b) => (a.date < b.date ? -1 : 1)) : []), [data]);
  const prog = useMemo(() => STD.map((s) => ({ k: s.k, pts: done.filter((r) => r.time_sec && r.distance_km && r.kind !== "bike" && stdOf(r.distance_km) === s.k).map((r) => ({ date: r.date, sec: r.time_sec, label: r.name })) })).filter((x) => x.pts.length >= 2), [done]);
  const bests = data ? data.bests.slice().sort((a, b) => a.time_sec - b.time_sec) : [];
  const order = ["1k", "mile", "5k", "10k", "half marathon", "marathon"];
  const sortedBests = bests.sort((a, b) => order.indexOf(a.distance) - order.indexOf(b.distance));
  const be = data && data.state.find((s) => s.key === "best_efforts");
  const warn = be && be.value && be.value.coverage && be.value.coverage.from;
  return (
    <>
      <TopBar active="/records" />
      <main className="wrap">
        <section className="sec">
          <h2>Records</h2>
          <p className="lede">Race results are the records. Select a race, PR or best effort to open its route and details. Best efforts found inside training runs are listed separately, so a watch auto-detect can never replace a real race time.</p>
          {err && <div className="banner err">{err}</div>}
          {!data && !err && <div className="p skeleton" style={{ height: 200 }} />}
          {data && <>
            <div className="prs">{STD.map((s) => { const r = prs[s.k]; return (
              <div key={s.k} className={"p" + (r && forRace(r) ? " clk" : "")} onClick={r && forRace(r) ? () => setOpen(forRace(r)) : undefined} title={r && forRace(r) ? "Open this run" : undefined}><h4>{s.k}</h4>{r ? <><div className="pr">{hms(r.time_sec)}</div><div className="m">{paceMi(paceOf(r.time_sec, r.distance_km))}/mi</div><div className="m">{r.name} · {when(r.date)}</div><div className="m">{src(r.source)}</div></> : <div className="m" style={{ marginTop: 14 }}>No result recorded</div>}</div>); })}</div>

            {prog.length > 0 && <div className="grid" style={{ marginTop: 14 }}>{prog.map((g) => <div key={g.k} className="p s6"><h3>{g.k} progression <small>race and time-trial results</small></h3><EChart option={progressionOption(g.pts, g.k)} height={200} /></div>)}</div>}

            <h2 style={{ marginTop: 28, fontSize: 15 }}>Race results</h2>
            <div className="p" style={{ marginTop: 10 }}><div className="tw"><table><thead><tr><th style={{ textAlign: "left" }}>Event</th><th>Date</th><th>Distance</th><th>Time</th><th>Pace /mi</th><th>Source</th></tr></thead>
              <tbody>{done.length ? done.map((r) => { const run = forRace(r); return <tr key={r.id} className={run ? "clk" : undefined} onClick={run ? () => setOpen(run) : undefined} tabIndex={run ? 0 : undefined} onKeyDown={run ? (e) => e.key === "Enter" && setOpen(run) : undefined}><td style={{ textAlign: "left" }}>{r.name}{r.place && <span style={{ display: "block", color: "var(--dim)", fontSize: 11 }}>{r.place}</span>}{r.notes && <span style={{ display: "block", color: "var(--dim)", fontSize: 11 }}>{r.notes}</span>}</td><td>{when(r.date)}</td><td>{r.distance_km ? (stdOf(r.distance_km) || (r.distance_km * 0.621371).toFixed(1) + " mi") : "-"}</td><td>{r.time_sec ? hms(r.time_sec) : "-"}</td><td>{r.time_sec && r.distance_km && r.kind !== "bike" ? paceMi(paceOf(r.time_sec, r.distance_km)) : "-"}</td><td>{src(r.source)}</td></tr>; }) : <tr><td colSpan="6" className="empty">No results yet. Import them from Admin.</td></tr>}</tbody></table></div></div>

            {upcoming.length > 0 && <><h2 style={{ marginTop: 28, fontSize: 15 }}>Upcoming</h2>
              <div className="p" style={{ marginTop: 10 }}><div className="tw"><table><thead><tr><th style={{ textAlign: "left" }}>Event</th><th>Date</th><th>Goal</th></tr></thead>
                <tbody>{upcoming.map((r) => <tr key={r.id}><td style={{ textAlign: "left" }}>{r.name}</td><td>{when(r.date)}</td><td>{r.goal_sec ? hms(r.goal_sec) : "-"}</td></tr>)}</tbody></table></div></div></>}

            <h2 style={{ marginTop: 28, fontSize: 15 }}>Best efforts inside runs</h2>
            <p className="lede" style={{ marginTop: 4 }}>The fastest stretch of each distance inside any GPS run{warn ? ", counted from " + when(warn) : ""}. These are not race results and not guaranteed lifetime bests.</p>
            <div className="p"><div className="tw"><table><thead><tr><th style={{ textAlign: "left" }}>Distance</th><th>Time</th><th>Pace /mi</th><th>Date</th><th>Previous best</th></tr></thead>
              <tbody>{sortedBests.length ? sortedBests.map((b) => { const km = { "1k": 1, mile: 1.609344, "5k": 5, "10k": 10, "half marathon": 21.0975, marathon: 42.195 }[b.distance]; const run = forEffort(b); return <tr key={b.distance} className={run ? "clk" : undefined} onClick={run ? () => setOpen(run) : undefined} tabIndex={run ? 0 : undefined} onKeyDown={run ? (e) => e.key === "Enter" && setOpen(run) : undefined}><td style={{ textAlign: "left" }}>{effortLabel(b.distance)}</td><td>{hms(b.time_sec)}</td><td>{km ? paceMi(paceOf(b.time_sec, km)) : "-"}</td><td>{when(b.achieved_on)}</td><td>{b.prev_sec ? hms(b.prev_sec) + " · " + when(b.prev_on) : "-"}</td></tr>; }) : <tr><td colSpan="5" className="empty">No best efforts synced yet. Run the sync in Admin.</td></tr>}</tbody></table></div></div>
          </>}
          {open && <ActivityModal run={open} band={null} onClose={() => setOpen(null)} />}
        </section>
      </main>
    </>
  );
}
