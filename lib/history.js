// Pure helpers for the History and Records pages (client and server safe).
import { toSec } from "./time";

const MI = 1609.344;
export const shiftDay = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const mondayOf = (d) => { const x = new Date(d + "T12:00:00Z"); return shiftDay(d, -((x.getUTCDay() + 6) % 7)); };
export const weeksBetween = (a, b) => { const o = []; for (let m = mondayOf(a); m <= b; m = shiftDay(m, 7)) o.push(m); return o; };

export function weeklyRuns(acts) {
  const m = new Map();
  for (const a of acts) { if (!a.run) continue; const k = mondayOf(a.date), w = m.get(k) || { mi: 0, runs: 0, sec: 0, long: 0 }; w.mi += a.mi; w.runs++; w.sec += a.sec; w.long = Math.max(w.long, a.mi); m.set(k, w); }
  return m;
}

// A block's window. Blocks without a start fall back to 16 weeks before their end, flagged as estimated.
export function blockWindow(b, today) {
  const end = b.end || b.race_date || today;
  const est = !b.start;
  return { start: b.start || shiftDay(end, -112), end, estimated: est };
}

export function planWeeks(plan) {
  return plan && Array.isArray(plan.weeks) ? plan.weeks.filter((w) => w.days && w.days.length === 7).map((w) => ({ num: w.num, title: w.title, focus: w.focus, planned: w.planned, start: w.days[0].date, end: w.days[6].date, days: w.days })) : [];
}

export function blockStats(b, acts, daily, plan, today) {
  const win = blockWindow(b, today), runs = acts.filter((a) => a.run && a.date >= win.start && a.date <= win.end);
  const weeks = weeksBetween(win.start, win.end), wk = weeklyRuns(runs), vals = weeks.map((m) => (wk.get(m) ? wk.get(m).mi : 0));
  const complete = weeks.filter((m) => shiftDay(m, 6) <= today);
  const cv = complete.map((m) => (wk.get(m) ? wk.get(m).mi : 0));
  const pw = planWeeks(plan), done = pw.filter((w) => w.start >= win.start && w.end <= today && w.planned > 0);
  const adh = done.length ? done.reduce((s, w) => s + runs.filter((a) => a.date >= w.start && a.date <= w.end).reduce((t, a) => t + a.mi, 0), 0) / done.reduce((s, w) => s + w.planned, 0) : null;
  const dd = daily.filter((d) => d.date >= win.start && d.date <= win.end && d.ctl != null);
  const longest = runs.reduce((m, a) => (a.mi > m.mi ? a : m), { mi: 0 });
  return {
    win, runs, weeks: weeks.length, totalMi: runs.reduce((s, a) => s + a.mi, 0), avgWk: cv.length ? cv.reduce((s, x) => s + x, 0) / cv.length : null, peakWk: Math.max(0, ...vals),
    longest: longest.mi ? { mi: longest.mi, date: longest.date } : null, adherence: adh, hasPlan: pw.length > 0,
    ctl: dd.length ? { start: dd[0].ctl, end: dd[dd.length - 1].ctl, peak: Math.max(...dd.map((d) => d.ctl)) } : null, dataDays: new Set(runs.map((a) => a.date)).size,
  };
}

export const STD = [{ k: "5K", km: 5 }, { k: "10K", km: 10 }, { k: "Half marathon", km: 21.0975 }, { k: "Marathon", km: 42.195 }];
export const stdOf = (km) => { const s = STD.find((x) => Math.abs(km - x.km) / x.km < 0.03); return s ? s.k : null; };
export const paceOf = (sec, km) => sec / (km / (MI / 1000));
export const parseTime = (t) => toSec(t);

// Best result per standard distance from the race list (finished, not planned). Official results outrank watch times only if faster or equal.
export function personalRecords(races) {
  const out = {};
  for (const r of races) {
    if (r.planned || !r.time_sec || !r.distance_km || r.kind === "bike") continue;
    const k = stdOf(r.distance_km); if (!k) continue;
    if (!out[k] || r.time_sec < out[k].time_sec) out[k] = r;
  }
  return out;
}
