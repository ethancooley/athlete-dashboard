export const allDays = (plan) => plan.weeks.flatMap((w) => w.days);
export const weekOf = (plan, d) => plan.weeks.find((w) => w.days[0].date <= d && w.days[6].date >= d);

export function dayActs(acts, date) {
  const l = acts.filter((a) => a.date === date), runs = l.filter((a) => a.run);
  const mi = runs.reduce((s, a) => s + a.mi, 0), sec = runs.reduce((s, a) => s + a.sec, 0);
  const hs = runs.filter((a) => a.hr).reduce((s, a) => s + a.sec, 0), hw = runs.filter((a) => a.hr).reduce((s, a) => s + a.hr * a.sec, 0);
  return { mi, sec, n: runs.length, hr: hs ? hw / hs : null, swim: l.some((a) => a.type === "LAP_SWIMMING" || a.type === "OPEN_WATER_SWIMMING"), lift: l.some((a) => a.type === "STRENGTH_TRAINING") };
}
export function status(acts, d, today) {
  if (d.date > today) return null;
  const a = dayActs(acts, d.date), isToday = d.date === today;
  if (d.type === "strength") { const g = (a.lift ? 1 : 0) + (a.swim ? 1 : 0); if (g === 2) return { k: "done", t: "Done", a }; if (g === 1) return { k: "partial", t: a.lift ? "Lift only" : "Swim only", a }; return isToday ? { k: "today", t: "Today", a } : { k: "missed", t: "Missed", a }; }
  if (d.miles === 0) return { k: "rest", t: a.mi > 0.3 ? "Ran" : "Rest", a };
  const r = a.mi / d.miles;
  if (r >= 0.9) return { k: "done", t: "Done", a };
  if (r >= 0.5 || a.mi > 0.3) return { k: "partial", t: Math.round(r * 100) + "%", a };
  return isToday ? { k: "today", t: "Today", a } : { k: "missed", t: "Missed", a };
}
export const weekMiles = (acts, w, today) => w.days.reduce((s, d) => s + (d.date <= today ? dayActs(acts, d.date).mi : 0), 0);

import { toSec } from "./time";

// Even-pace checkpoint table from a goal time, used when the plan has no splits of its own.
export function evenSplits(ev) {
  const goal = toSec(ev.goalTime), km = ev.distanceKm || 42.195, fmt = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const pts = [["5K", 5], ["10K", 10], ["15K", 15], ["20K", 20], ["Half", 21.0975], ["30K", 30], ["35K", 35], ["40K", 40]].filter((p) => p[1] < km);
  return [...pts.map(([n, k]) => ({ n, t: fmt((goal * k) / km), note: "" })), { n: "Finish", t: fmt(goal), note: "Even pace" }];
}

// Hard-day gate: HRV under a floor for N mornings running, or resting HR a set number of bpm above its prior 14-day average.
export function gate(daily, g = { hrvFloor: 70, hrvDays: 2, rhrDelta: 5 }) {
  const hv = daily.filter((d) => d.hrv != null), h = hv[hv.length - 1], lastN = hv.slice(-g.hrvDays);
  const rl = daily.filter((d) => d.rhr != null), r = rl[rl.length - 1];
  const prev = rl.slice(-15, -1).map((x) => x.rhr), base = prev.length ? prev.reduce((s, x) => s + x, 0) / prev.length : null;
  const reasons = [];
  if (h && lastN.length === g.hrvDays && lastN.every((x) => x.hrv < g.hrvFloor)) reasons.push("HRV has been under " + g.hrvFloor + " ms " + g.hrvDays + " mornings in a row");
  if (r && base && r.rhr >= base + g.rhrDelta) reasons.push("Resting HR is " + Math.round(r.rhr - base) + " bpm above its 2-week average");
  return { hold: reasons.length > 0, reasons, hrv: h, rhr: r, rhrAvg: base };
}
