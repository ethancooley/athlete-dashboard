"use client";
import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import TopBar from "./TopBar";
import { f1, hms, paceMi, shortDate } from "../lib/fmt";
import ActivityModal from "./ActivityModal";
import { blockStats, blockWindow, planWeeks, paceOf } from "../lib/history";
import { everyWeekOption, blockWeeksOption, blockFitnessOption } from "../lib/historyCharts";

const fmtRange = (w) => `${shortDate(w.start)}, ${w.start.slice(0, 4)} to ${shortDate(w.end)}, ${w.end.slice(0, 4)}`;

function Card({ b, st, race, sel, onClick }) {
  return (
    <button className={"bcard" + (sel ? " sel" : "")} onClick={onClick} aria-pressed={sel}>
      <h3>{b.name}</h3>
      <div className="d">{fmtRange(st.win)}{st.win.estimated ? <span className="est"> · start estimated</span> : null}</div>
      {(b.result || race) && <div className="res">{b.result || (race.time_sec ? hms(race.time_sec) + " · " + race.name : race.name)}</div>}
      <dl>
        <div><dt>Run miles</dt><dd>{Math.round(st.totalMi)}</dd></div>
        <div><dt>Avg per week</dt><dd>{st.avgWk == null ? "-" : f1(st.avgWk)}</dd></div>
        <div><dt>Peak week</dt><dd>{f1(st.peakWk)}</dd></div>
        <div><dt>{st.hasPlan ? "Plan followed" : "Longest run"}</dt><dd>{st.hasPlan ? (st.adherence == null ? "-" : Math.round(st.adherence * 100) + "%") : st.longest ? f1(st.longest.mi) + " mi" : "-"}</dd></div>
      </dl>
    </button>
  );
}

function Detail({ b, st, plan, ver, data }) {
  const pw = planWeeks(plan), [open, setOpen] = useState(null), [all, setAll] = useState(false);
  const wOpt = useMemo(() => blockWeeksOption(b, data.acts, plan, data.today), [b, data, plan]);
  const fOpt = useMemo(() => blockFitnessOption(b, data.daily, data.today), [b, data]);
  const sorted = st.runs.slice().sort((x, y) => y.mi - x.mi), longest = all ? sorted : sorted.slice(0, 8);
  return (
    <div className="grid" style={{ marginTop: 14 }}>
      <div className="p s7"><h3>Weekly miles <small>{st.hasPlan ? "plan and actual" : "actual"}</small></h3><EChart option={wOpt} height={240} /></div>
      <div className="p s5"><h3>Fitness and fatigue <small>CTL and ATL</small></h3>{fOpt ? <EChart option={fOpt} height={240} /> : <div className="empty">No fitness data for this block.</div>}</div>
      <div className="p s6"><h3>{all ? "All runs" : "Longest runs"} <small>select one for the map and details</small></h3><div className="tw"><table><thead><tr><th style={{ textAlign: "left" }}>Run</th><th>Miles</th><th>Pace</th><th>Avg HR</th></tr></thead>
        <tbody>{longest.length ? longest.map((a) => <tr key={a.id} className="clk" tabIndex={0} onClick={() => setOpen(a)} onKeyDown={(e) => e.key === "Enter" && setOpen(a)}><td style={{ textAlign: "left" }}>{a.name}<span style={{ display: "block", color: "var(--dim)", fontSize: 11 }}>{shortDate(a.date)}, {a.date.slice(0, 4)}</span></td><td>{f1(a.mi)}</td><td>{paceMi(a.sec / a.mi)}</td><td>{a.hr ? Math.round(a.hr) : "-"}</td></tr>) : <tr><td colSpan="4" className="empty">No runs in this window</td></tr>}</tbody></table></div>{sorted.length > 8 && <p style={{ margin: "8px 0 0" }}><button className="btn" onClick={() => setAll(!all)}>{all ? "Show the longest 8" : "Show all " + sorted.length + " runs"}</button></p>}</div>
      <div className="p s6"><h3>Block summary</h3>
        <div className="tiles" style={{ margin: 0 }}>
          <div className="tile"><b>{st.weeks}</b><span>Weeks</span></div><div className="tile"><b>{st.dataDays}</b><span>Days with a run</span></div>
          <div className="tile"><b>{st.ctl ? Math.round(st.ctl.start) + " to " + Math.round(st.ctl.end) : "-"}</b><span>Fitness, start to end</span></div><div className="tile"><b>{st.ctl ? Math.round(st.ctl.peak) : "-"}</b><span>Peak fitness</span></div>
        </div>
        {b.goal && <p className="chart-note"><b>Goal.</b> {b.goal}</p>}{b.notes && <p className="chart-note">{b.notes}</p>}
        {ver && <p className="chart-note">Plan version {ver.version}{ver.note ? ", " + ver.note : ""}. {data.versions[b.slug] > 1 ? data.versions[b.slug] + " versions are stored." : ""}</p>}
      </div>
      {pw.length > 0 && <div className="p" style={{ gridColumn: "span 12" }}><h3>The plan, week by week <small>{pw.length} weeks as planned</small></h3>
        <div className="tw"><table><thead><tr><th style={{ textAlign: "left" }}>Week</th><th style={{ textAlign: "left" }}>Focus</th><th>Plan mi</th><th>Ran mi</th></tr></thead>
          <tbody>{pw.map((w) => { const ran = data.acts.filter((a) => a.run && a.date >= w.start && a.date <= w.end).reduce((s, a) => s + a.mi, 0); const past = w.end <= data.today; return <tr key={w.start}><td style={{ textAlign: "left" }}>{w.title}<span style={{ display: "block", color: "var(--dim)", fontSize: 11 }}>{shortDate(w.start)} to {shortDate(w.end)}</span></td><td style={{ textAlign: "left" }}>{w.focus || ""}</td><td>{w.planned}</td><td>{past || ran > 0 ? f1(ran) : "-"}</td></tr>; })}</tbody></table></div></div>}
      {open && <ActivityModal run={open} band={null} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default function HistoryView() {
  const [data, setData] = useState(null), [err, setErr] = useState(""), [sel, setSel] = useState(null);
  useEffect(() => { fetch("/api/history").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not load history"); const versions = {}; j.versions.forEach((v) => { versions[v.block_slug] = v.n; }); setData({ ...j, versions }); }).catch((e) => setErr(e.message)); }, []);
  const planBy = useMemo(() => { const m = {}; if (data) data.plans.forEach((p) => { m[p.block_slug] = p; }); return m; }, [data]);
  const cards = useMemo(() => data ? data.blocks.map((b) => ({ b, st: blockStats(b, data.acts, data.daily, planBy[b.slug] && planBy[b.slug].plan, data.today), race: data.races.find((r) => r.block_slug === b.slug && !r.planned) })).sort((x, y) => (x.st.win.end < y.st.win.end ? 1 : -1)) : [], [data, planBy]);
  useEffect(() => { if (cards.length && !sel) setSel(cards[0].b.slug); }, [cards, sel]);
  const overview = useMemo(() => data ? everyWeekOption({ acts: data.acts, daily: data.daily, blocks: data.blocks, races: data.races, today: data.today }) : null, [data]);
  const cur = cards.find((c) => c.b.slug === sel);
  return (
    <>
      <TopBar active="/history" />
      <main className="wrap">
        <section className="sec" id="history">
          <h2>History</h2>
          <p className="lede">Every week on record, the training blocks inside it, and how each block went.</p>
          {err && <div className="banner err">{err}</div>}
          {!data && !err && <div className="p skeleton" style={{ height: 320 }} />}
          {data && data.acts.length === 0 && <div className="p"><div className="empty">No activities stored yet. Open Admin and run the backfill.</div></div>}
          {data && overview && <div className="p"><h3>Every week <small>{data.acts.find((a) => a.run).date.slice(0, 4)} to now, run miles and fitness</small></h3><EChart option={overview} height={340} />
            <div className="chart-note">Shaded bands are training blocks and amber lines are races. A week with no bar either had no run or no watch data, so check coverage before reading a gap as time off.</div></div>}
          {data && cards.length > 0 && <>
            <h2 style={{ marginTop: 28, fontSize: 15 }}>Training blocks</h2>
            <div className="bcards" style={{ marginTop: 10 }}>{cards.map((c) => <Card key={c.b.slug} b={c.b} st={c.st} race={c.race} sel={c.b.slug === sel} onClick={() => setSel(c.b.slug)} />)}</div>
            {cur && <Detail b={cur.b} st={cur.st} plan={planBy[cur.b.slug] && planBy[cur.b.slug].plan} ver={planBy[cur.b.slug]} data={data} />}
          </>}
          {data && data.acts.length > 0 && cards.length === 0 && <div className="p" style={{ marginTop: 12 }}><div className="empty">No blocks defined yet. Import them from Admin.</div></div>}
        </section>
      </main>
    </>
  );
}
