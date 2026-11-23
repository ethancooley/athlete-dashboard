// Synthetic demo data for previews (MOCK=1). Nothing here comes from a real person: it is generated from a
// seeded random number generator so the dashboard can be shown without a Garmin connection.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MI = 1609.344;

const MOCK_START = "2025-01-06"; // a Monday
// Deterministic synthetic history from MOCK_START to `to`: a weekly rhythm with builds, down weeks and two taper-and-race weeks.
function build(to) {
  const acts = [], daily = [], start = new Date(MOCK_START + "T12:00:00Z"), end = new Date(to + "T12:00:00Z");
  let ctl = 30, atl = 28, id = 9000010000;
  const n = Math.round((end - start) / 864e5);
  for (let i = 0; i <= n; i++) {
    const r = rng(1000 + i), d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10), dow = d.getUTCDay(), wk = Math.floor(i / 7), phase = wk % 16, scale = phase === 3 || phase === 7 || phase === 11 ? 0.7 : phase >= 14 ? 0.6 : 0.8 + (phase / 16) * 0.6;
    let load = 0;
    const add = (type, name, mi, paceSec, hr, load_) => { acts.push({ id: String(id++), date, type, name, mi, sec: Math.round(mi ? mi * paceSec : paceSec), hr, maxhr: hr + 14 + Math.round(r() * 8), elev: mi ? 40 + r() * 160 : null, watts: mi ? Math.round(300 + (480 - paceSec) * 0.9) : null, start: Math.floor(d.getTime() / 1000), run: !!mi }); load += load_; };
    if (dow === 1) { add("STRENGTH_TRAINING", "Strength", 0, 1800, 92, 22); add("LAP_SWIMMING", "Pool Swim", 0, 1700, 118, 28); }
    else if (dow === 5) { /* rest from running */ }
    else if (dow === 6) add("RUNNING", "Long Run", Math.round((12 + r() * 4) * scale), 505 + r() * 25, 146 + Math.round(r() * 6), 95 * scale);
    else if (dow === 2 || dow === 4) add("RUNNING", dow === 2 ? "Tempo Run" : "Steady Run", Math.round((7 + r() * 2) * scale), 440 + r() * 25, 158 + Math.round(r() * 6), 78 * scale);
    else add("RUNNING", "Easy Run", Math.round((4 + r() * 3) * scale), 520 + r() * 30, 138 + Math.round(r() * 6), 45 * scale);
    ctl += (load - ctl) / 42; atl += (load - atl) / 7;
    const hrv = Math.round(72 + Math.sin(i / 3) * 6 + (r() - 0.5) * 8), rhr = Math.round(44 + (r() - 0.5) * 5 + (hrv < 66 ? 2 : 0));
    const sleepMin = Math.round(400 + r() * 110);
    daily.push({ date, ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +(ctl - atl).toFixed(1), hrv, rhr, sleepMin, sleepScore: Math.round(66 + (sleepMin - 400) / 5), recovery: Math.max(20, Math.min(95, Math.round(60 + (hrv - 70) * 2.2 - (rhr - 44) * 3))), readiness: null, verdict: null, hrvBase: 72, rhrBase: 44.5, sleepNeed: 490, load: load || null });
  }
  daily.forEach((x) => { x.readiness = x.recovery; });
  return { acts, daily };
}
export async function fetchRange({ from, to }) {
  const { acts, daily } = build(to);
  return { acts: acts.filter((a) => a.date >= from), daily: daily.filter((d) => d.date >= from) };
}
export async function fetchBestEfforts() {
  return { coverage: { from: MOCK_START, warning: "Synthetic demo data." }, rows: [
    { distance: "1k", time_sec: 215, achieved_on: "2025-06-10", activity_id: "9000010400", prev_sec: 221, prev_on: "2025-04-02" },
    { distance: "5k", time_sec: 1236, achieved_on: "2025-09-14", activity_id: "9000010900", prev_sec: 1262, prev_on: "2025-06-10" },
    { distance: "10k", time_sec: 2580, achieved_on: "2025-11-02", activity_id: "9000011200", prev_sec: null, prev_on: null },
    { distance: "half marathon", time_sec: 5700, achieved_on: "2026-03-22", activity_id: "9000012000", prev_sec: 5880, prev_on: "2025-10-12" },
  ] };
}
export function getDashboard({ cfg }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: cfg.timezone || "UTC" }).format(new Date());
  const all = build(today), cut = new Date(today + "T12:00:00Z"); cut.setUTCDate(cut.getUTCDate() - 34);
  const from = cut.toISOString().slice(0, 10), acts = all.acts.filter((a) => a.date >= from), daily = all.daily.filter((d) => d.date >= from), last = daily[daily.length - 1];
  return {
    source: "demo", today, generatedAt: Date.now(), acts, daily,
    pmc: { ctl: last.ctl, atl: last.atl, tsb: last.tsb, form: "synthetic", trend: "building", ramp: 1.8 },
    prediction: { status: "no_estimate", message: "Demo data has no race estimate." },
  };
}

// A synthetic loop run: easy start, a marathon-pace block in the middle, easy finish. The route is a made-up loop.
export function getActivity(id) {
  const r = rng(7), points = [];
  const lat0 = 40.78, lng0 = -73.97; // a made-up loop, not a real route
  let t = 0, km = 0;
  for (let k = 0; k <= 150; k++) {
    const f = k / 150, kmh = f < 0.25 ? 10.2 : f < 0.8 ? 12.07 : 9.9; // easy / goal pace (8:00/mi) / easy
    const speed = kmh + (r() - 0.5) * 0.5;
    if (k) { t += 20; km += (speed * 20) / 3600; }
    const a = f * Math.PI * 2;
    points.push({ t, hr: Math.round(124 + f * 28 + (kmh > 11 ? 14 : 0) + (r() - 0.5) * 3), kmh: +speed.toFixed(2), alt: +(24 + Math.sin(a * 2) * 6 + r() * 0.4).toFixed(1), km: +km.toFixed(3), lat: +(lat0 + Math.sin(a) * 0.006 + Math.sin(a * 3) * 0.0008).toFixed(6), lng: +(lng0 + Math.cos(a) * 0.011).toFixed(6) });
  }
  return {
    id, demo: true, points,
    laps: ["#1 interval [distance] 9m12s 1.61km 5:43/km HR128/140 cad168/172", "#2 interval [distance] 6m50s 1.61km 4:15/km HR148/158 cad176/180", "#3 interval [distance] 6m50s 1.61km 4:15/km HR151/160 cad176/181", "#4 interval [distance] 9m30s 1.61km 5:54/km HR146/152 cad168/171"],
    session: { avg_heart_rate: 146, total_training_effect: 3.1, training_load_peak: 82.4, avg_cadence: 174, avg_stance_time: 238, avg_vertical_oscillation: 91, avg_step_length: 1120, avg_power: 395 },
    zones: { z1: { time: "2m10s", pct: 5 }, z2: { time: "11m40s", pct: 28 }, z3: { time: "20m30s", pct: 49 }, z4: { time: "7m20s", pct: 18 }, z5: { time: "0s", pct: 0 } },
  };
}
