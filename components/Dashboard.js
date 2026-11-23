"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import EChart from "./EChart";
import { C } from "../lib/theme";
import { f1, hms, paceMi, shortDate, stamp } from "../lib/fmt";
import { allDays, weekOf, status, weekMiles, dayActs, gate } from "../lib/plan";
import { weeksOption, loadOption, hrvOption, rhrOption, sleepOption, runOption } from "../lib/charts";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false, loading: () => <div className="skeleton" style={{ height: 340 }} /> });

function actLine(a) { const p = []; if (a.mi > 0.05) { p.push(f1(a.mi) + " mi", paceMi(a.sec / a.mi) + "/mi"); if (a.hr) p.push(Math.round(a.hr) + " bpm"); } if (a.swim) p.push("swim"); if (a.lift) p.push("lift"); return p.join(" · "); }
const dayTitle = (d) => (d.miles > 0 ? d.miles + " mi" + (d.tag ? " · " + d.tag : "") : d.type === "strength" ? "Lift and swim" : "Rest");

function Gauge({ score }) {
  const r = 40, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score));
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`Recovery score ${score} out of 100`}>
      <circle cx="52" cy="52" r={r} fill="none" stroke={C.line} strokeWidth="8" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={C.blue} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 52 52)" />
      <text x="52" y="52" textAnchor="middle" dominantBaseline="central" fill={C.ink} fontSize="26" fontWeight="600">{score}</text>
    </svg>
  );
}
function DayCard({ d, isToday, acts, today }) {
  const s = status(acts, d, today), a = s && s.a;
  return (
    <div className={"dc" + (isToday ? " today" : "")}>
      <div className="d"><span>{d.dow} {d.label}</span>{s && <span className={"chip " + s.k}>{s.t}</span>}</div>
      <div className="w"><b>{dayTitle(d)}</b>{d.text}</div>
      {a && actLine(a) && <div className="act">{actLine(a)}</div>}
    </div>
  );
}

function parseLaps(lines) {
  return (lines || []).map((l) => { const m = /^#(\d+)\s+\S+\s+\[(\w+)\]\s+(\S+)\s+([\d.]+)km\s+(\d+):(\d+)\/km\s+HR(\d+)\/(\d+)\s+cad(\d+)/.exec(l); if (!m || +m[4] < 0.2) return null; return { n: +m[1], dur: m[3], mi: +m[4] / 1.609344, pace: (+m[5] * 60 + +m[6]) * 1.609344, hr: +m[7], maxhr: +m[8], cad: +m[9] }; }).filter(Boolean);
}
const Tile = ({ v, l }) => (v == null || v === "" ? null : <div className="tile"><b>{v}</b><span>{l}</span></div>);

function RunDetail({ run, band }) {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => {
    let dead = false; setD(null); setErr("");
    fetch("/api/activity/" + run.id).then((r) => r.json().then((j) => ({ ok: r.ok, j }))).then(({ ok, j }) => { if (dead) return; if (!ok) setErr(j.error || "Could not load this run."); else setD(j); }).catch(() => !dead && setErr("Could not load this run."));
    return () => { dead = true; };
  }, [run.id]);
  const opt = useMemo(() => (d && d.points && d.points.length > 2 ? runOption(d.points, band) : null), [d]);
  if (err) return <div className="empty">{err}</div>;
  if (!d) return <div className="skeleton" style={{ height: 380 }} />;
  const s = d.session || {}, laps = parseLaps(d.laps);
  return (
    <div>
      <div className="lab-head"><h4>{run.name}</h4><span>{shortDate(run.date)} · {f1(run.mi)} mi · {hms(run.sec)} · {paceMi(run.sec / run.mi)}/mi</span></div>
      {d.demo && <div className="banner" style={{ marginTop: 10 }}>Demo mode: synthetic run, generated for the preview.</div>}
      <div className="tiles">
        <Tile v={s.avg_heart_rate ? s.avg_heart_rate + " bpm" : null} l="Average HR" /><Tile v={s.total_training_effect} l="Aerobic effect" /><Tile v={s.training_load_peak != null ? f1(s.training_load_peak) : null} l="Training load" />
        <Tile v={s.avg_cadence ? s.avg_cadence + " spm" : null} l="Cadence" /><Tile v={s.avg_stance_time ? Math.round(s.avg_stance_time) + " ms" : null} l="Ground contact" /><Tile v={s.avg_vertical_oscillation ? f1(s.avg_vertical_oscillation / 10) + " cm" : null} l="Vertical oscillation" />
        <Tile v={s.avg_step_length ? (s.avg_step_length / 1000).toFixed(2) + " m" : null} l="Step length" /><Tile v={s.avg_power ? s.avg_power + " W" : null} l="Average power" />
      </div>
      <div className="grid">
        <div className="s5 p" style={{ gridColumn: "span 12" }}><h3>Route <small>colored by speed</small></h3><RouteMap points={d.points || []} /></div>
        <div className="p" style={{ gridColumn: "span 12" }}><h3>Pace, heart rate and elevation <small>shaded = goal pace ({paceMi(band[0])} to {paceMi(band[1])}/mi)</small></h3>
          {opt ? <EChart option={opt} height={360} /> : <div className="empty">No stream data for this run{d.streamStatus ? " (" + d.streamStatus + ")" : ""}.</div>}</div>
        <div className="p s7"><h3>Splits</h3><div className="tw"><table><thead><tr><th>#</th><th>Mi</th><th>Time</th><th>Pace</th><th>HR avg / max</th><th>Cadence</th></tr></thead>
          <tbody>{laps.length ? laps.map((l) => <tr key={l.n}><td>{l.n}</td><td>{l.mi.toFixed(2)}</td><td>{l.dur}</td><td>{paceMi(l.pace)}</td><td>{l.hr} / {l.maxhr}</td><td>{l.cad}</td></tr>) : <tr><td colSpan="6" className="empty">No laps recorded</td></tr>}</tbody></table></div></div>
        <div className="p s5"><h3>Time in heart-rate zones</h3>
          {d.zones ? Object.keys(d.zones).sort().map((k) => <div className="zrow" key={k}><span>{k.toUpperCase()}</span><div className="zbar"><i style={{ width: d.zones[k].pct + "%" }} /></div><span>{d.zones[k].time} · {d.zones[k].pct}%</span></div>) : <div className="empty">No zone data</div>}</div>
      </div>
    </div>
  );
}

export default function Dashboard({ plan, cfg, planInfo }) {
  const [data, setData] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [sel, setSel] = useState(null);
  const load = useCallback(async (refresh) => {
    setBusy(true);
    try {
      const r = await fetch("/api/data" + (refresh ? "?refresh=1" : ""));
      if (r.status === 401) { window.location.href = "/login"; return; }
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Could not load data."); else { setData(j); setErr(j.error || ""); }
    } catch { setErr("Could not reach the server."); }
    setBusy(false);
  }, []);
  useEffect(() => { load(false); }, [load]);

  const today = data ? data.today : null, acts = data ? data.acts : [], daily = data ? data.daily : [];
  const days = useMemo(() => allDays(plan), [plan]);
  const gt = useMemo(() => gate(daily, cfg.gates), [daily, cfg]);
  const lastRec = daily.filter((d) => d.recovery != null).slice(-1)[0];
  const lastSleep = daily.filter((d) => d.sleepMin != null).slice(-1)[0];
  const runs = useMemo(() => acts.filter((a) => a.run).sort((a, b) => b.start - a.start), [acts]);
  const selRun = runs.find((r) => r.id === sel);
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; };

  const raceLabel = new Date(cfg.event.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const nav = (
    <header className="top"><div className="in">
      <div className="brand">{cfg.event.name}<span>{raceLabel} · goal {cfg.event.goalTime}</span></div>
      <nav aria-label="Sections">{["overview", "training", "recovery", "runs", "race"].map((s) => <a key={s} href={"#" + s}>{s[0].toUpperCase() + s.slice(1)}</a>)}<a href="/history">History</a><a href="/records">Records</a></nav>
      <div className={"sync" + (err && !data ? " bad" : data ? " ok" : "")}>
        <span><span className="dot" />{data ? (data.source === "demo" ? "Demo data" : "Synced " + stamp(data.generatedAt)) : busy ? "Loading..." : "Not loaded"}</span>
        <button onClick={() => load(true)} disabled={busy}>Refresh</button><button onClick={logout}>Sign out</button>
      </div>
    </div></header>
  );
  if (!data) return (<>{nav}<div className="wrap"><div className="grid" style={{ marginTop: 24 }}>{err ? <div className="p banner err" style={{ gridColumn: "span 12" }}>{err}</div> : [1, 2, 3].map((i) => <div key={i} className="p s4 skeleton" style={{ height: 150 }} />)}</div></div></>);

  const race = new Date(plan.race + "T00:00:00"), now = new Date(today + "T00:00:00"), start = new Date(cfg.trainStart + "T00:00:00");
  const left = Math.max(0, Math.round((race - now) / 864e5)), frac = Math.min(1, Math.max(0, (now - start) / (race - start)));
  const w = weekOf(plan, today), wm = w ? weekMiles(acts, w, today) : 0;
  const ti = days.findIndex((d) => d.date === today), tIdx = ti < 0 ? (today < days[0].date ? 0 : days.length - 1) : ti, td = days[tIdx], ts = status(acts, td, today);
  const from = Math.max(0, tIdx - 2), to = Math.min(days.length, tIdx + 6);
  const bank = acts.filter((a) => a.run && a.date >= cfg.trainStart && a.date <= today).reduce((s, a) => s + a.mi, 0);
  const pred = data.prediction;
  const an = cfg.anchor, riegel = an ? hms(an.seconds * Math.pow(cfg.event.distanceKm / an.distanceKm, 1.06)) : null;

  return (
    <>
      {nav}
      <main className="wrap">
        {err && <div className="banner warn">{err}{data.stale ? " Showing the last good data." : ""}</div>}
        {planInfo && planInfo.error && <div className="banner err">Could not read the plan from the database, so a sample plan is shown. {planInfo.error}</div>}
        {data.source === "demo" && <div className="banner">Demo mode: synthetic data, generated to preview the design. No Garmin connection is used.</div>}

        <section className="sec" id="overview">
          <h2>Overview</h2><p className="lede">Where you are against the plan, and whether today is a hard day.</p>
          <div className="grid">
            <div className="p s4"><h3>Countdown <small>{shortDate(cfg.trainStart)} to {shortDate(plan.race)}</small></h3>
              <div className="num">{left}<small>days to go</small></div><div className="bar"><i style={{ width: (frac * 100).toFixed(1) + "%" }} /></div><div className="sub">{Math.round(frac * 100)}% of the {plan.weeks.length}-week build complete</div></div>
            <div className="p s4"><h3>This week <small>{w ? (w.num === 0 ? "Recovery week" : "Week " + w.num + " · " + w.focus) : ""}</small></h3>
              <div className="num">{f1(wm)}<small>of {w ? w.planned : "-"} mi planned</small></div><div className="bar"><i style={{ width: Math.min(100, w && w.planned ? (wm / w.planned) * 100 : 0).toFixed(1) + "%" }} /></div>
              <div className="stats"><div><b>{f1(bank)}</b><span>Miles since start</span></div><div><b>{w ? w.days.reduce((s, d) => s + (d.date <= today ? dayActs(acts, d.date).n : 0), 0) : "-"}</b><span>Runs this week</span></div><div><b>{w ? (w.num === 0 ? "Rec" : w.num + " of " + plan.weeks.length) : "-"}</b><span>Plan week</span></div></div></div>
            <div className="p s4"><h3>Readiness <small>{lastRec ? shortDate(lastRec.date) : ""}</small></h3>
              <div className="gauge">{lastRec && <Gauge score={lastRec.recovery} />}
                <div className={"status" + (gt.hold ? " hold" : "")}><div className="ic" aria-hidden="true">{gt.hold ? "!" : "✓"}</div><div><b>{gt.hold ? "Keep it easy today" : "Cleared for hard sessions"}</b><span>{gt.hold ? gt.reasons.join(". ") : "HRV and resting HR are inside your gate."}</span></div></div></div>
              <div className="mini"><div><b>{gt.hrv ? gt.hrv.hrv + " ms" : "-"}</b><span>HRV</span></div><div><b>{gt.rhr ? gt.rhr.rhr + " bpm" : "-"}</b><span>Resting HR</span></div><div><b>{lastSleep ? f1(lastSleep.sleepMin / 60) + " h" : "-"}</b><span>Sleep</span></div></div></div>
            <div className="p today"><h3>Today <small>{td.dow} {td.label}</small></h3>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><h4>{dayTitle(td)}</h4>{ts && <span className={"chip " + ts.k}>{ts.t}</span>}</div><p className="d">{td.text}</p>
              {ts && ts.a && actLine(ts.a) && <div className="act" style={{ marginTop: 10 }}>{actLine(ts.a)}</div>}</div>
            <div className="p"><h3>Training plan <small>the days around today</small></h3><div className="days">{days.slice(from, to).map((d, k) => <DayCard key={d.date} d={d} isToday={from + k === tIdx} acts={acts} today={today} />)}</div></div>
          </div>
        </section>

        <section className="sec" id="training">
          <h2>Training</h2><p className="lede">Volume against the plan, and how fitness and fatigue are building.</p>
          <div className="grid">
            <div className="p"><h3>Weekly mileage <small>plan and actual</small></h3><EChart option={weeksOption(plan, acts, today)} height={240} /><div className="chart-note">Grey is the plan, blue is what you ran. The dashed line marks the current week.</div></div>
            <div className="p s8"><h3>Fitness, fatigue and form <small>load model</small></h3>{daily.some((d) => d.ctl != null) ? <EChart option={loadOption(daily)} height={260} /> : <div className="empty">No load data yet</div>}
              <div className="chart-note">Fitness (CTL) is a 42-day average of training load and fatigue (ATL) a 7-day one. Form (TSB) is fitness minus fatigue: positive means fresh, below about -10 means heavy. athletedata has about {daily.filter((d) => d.ctl != null).length} days of this so far, so fitness will read low until it has built up 6 weeks.</div></div>
            <div className="p s4"><h3>Load now <small>{data.pmc ? data.pmc.form : ""}</small></h3>
              {data.pmc ? <div className="stats" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                <div><b>{f1(data.pmc.ctl)}</b><span>Fitness (CTL)</span></div><div><b>{f1(data.pmc.atl)}</b><span>Fatigue (ATL)</span></div>
                <div><b>{f1(data.pmc.tsb)}</b><span>Form (TSB, start of day)</span></div><div><b>{data.pmc.ramp != null ? (data.pmc.ramp > 0 ? "+" : "") + f1(data.pmc.ramp) : "-"}</b><span>Ramp rate</span></div></div> : <div className="empty">No data</div>}
              {data.pmc && <div className="chart-note">Fitness trend: {data.pmc.trend}. Today counts as a zero-load day until you train, so fatigue reads low in the morning.</div>}</div>
          </div>
        </section>

        <section className="sec" id="recovery">
          <h2>Recovery</h2><p className="lede">The two gates that decide whether a hard session stands, plus sleep.</p>
          <div className="grid">
            <div className="p s6"><h3>Overnight HRV <small>ms</small></h3><EChart option={hrvOption(daily, cfg.gates.hrvFloor)} height={240} /><div className="chart-note">{cfg.gates.hrvDays === 1 ? "One morning" : cfg.gates.hrvDays + " mornings in a row"} under {cfg.gates.hrvFloor} ms moves the next hard session to an easy run.</div></div>
            <div className="p s6"><h3>Resting heart rate <small>bpm</small></h3><EChart option={rhrOption(daily)} height={240} /><div className="chart-note">A rise of 5 bpm or more above the 2-week average also moves the next hard session to an easy run.</div></div>
            <div className="p"><h3>Sleep <small>hours against your sleep need</small></h3><EChart option={sleepOption(daily)} height={220} /></div>
          </div>
        </section>

        <section className="sec" id="runs">
          <h2>Runs</h2><p className="lede">Every run from Garmin. Select one for the route, pace, heart rate, splits and zones.</p>
          <div className="grid"><div className="p"><div className="tw"><table className="runs"><thead><tr><th>Run</th><th>Miles</th><th>Pace /mi</th><th>Avg HR</th><th>Max HR</th><th>Power</th><th>Climb ft</th></tr></thead>
            <tbody>{runs.length ? runs.map((a) => (
              <tr key={a.id} className={"r" + (a.id === sel ? " sel" : "")} tabIndex={0} onClick={() => setSel(a.id)} onKeyDown={(e) => e.key === "Enter" && setSel(a.id)}>
                <td>{a.name}<span>{shortDate(a.date)}{a.type === "TREADMILL_RUNNING" ? " · treadmill" : ""}</span></td><td>{f1(a.mi)}</td><td>{paceMi(a.sec / a.mi)}</td><td>{a.hr || "-"}</td><td>{a.maxhr || "-"}</td><td>{a.watts ? a.watts + " W" : "-"}</td><td>{a.elev != null ? Math.round(a.elev) : "-"}</td></tr>
            )) : <tr><td colSpan="7" className="empty">No runs yet</td></tr>}</tbody></table></div></div>
            {selRun && <div className="p" id="detail"><RunDetail run={selRun} band={cfg.goalPaceBand} /></div>}</div>
        </section>

        <section className="sec" id="race">
          <h2>Race</h2><p className="lede">{cfg.event.lede || `Goal ${cfg.event.goalTime}, which is ${cfg.event.goalPace} per mile.`}</p>
          <div className="grid"><div className="p"><h3>Goal {an && <small>and projection from the {an.label}</small>}</h3>
            <div className="proj">{riegel && <div><b>{riegel}</b><span>Riegel projection</span></div>}<div><b>{cfg.event.goalTime}</b><span>Goal time</span></div><div><b>{cfg.event.goalPace}</b><span>Goal pace per mile</span></div></div>
            {an && <div className="chart-note" style={{ marginTop: 0 }}>The formula converts your {an.name || an.label} into a race-distance time. It ignores fueling and long-run durability, and real races usually come in slower, so treat it as a line to beat and not a forecast.</div>}
            {pred && <div className="chart-note">athletedata estimate: {pred.status === "no_estimate" ? "none yet. It needs a running threshold, so a 5K time trial or a 20 to 30 minute tempo will give it one." : pred.message || JSON.stringify(pred).slice(0, 200)}</div>}
            <div className="tw" style={{ marginTop: 10 }}><table className="race"><thead><tr><th>Checkpoint</th><th>Target</th><th>Note</th></tr></thead><tbody>{plan.splits.map((s) => <tr key={s.n}><td>{s.n}</td><td>{s.t}</td><td>{s.note}</td></tr>)}</tbody></table></div></div></div>
        </section>
        <p className="foot">{cfg.footer}{planInfo && planInfo.block ? " Plan: " + planInfo.block.name + ", version " + planInfo.block.version + "." : ""}</p>
      </main>
    </>
  );
}
