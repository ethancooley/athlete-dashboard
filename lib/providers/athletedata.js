import { callTool } from "../mcp";
import { rowsOf } from "../json";
import { todayIn } from "../config";

const MI = 1609.344, FT = 3.28084;
const RUN_TYPES = ["RUNNING", "TREADMILL_RUNNING", "TRAIL_RUNNING", "TRACK_RUNNING", "VIRTUAL_RUN"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function windows(from, to, days = 10) {
  const out = []; let end = new Date(to + "T00:00:00"); const first = new Date(from + "T00:00:00");
  while (end >= first) { let st = new Date(end); st.setDate(st.getDate() - (days - 1)); if (st < first) st = new Date(first); out.push({ start_date: iso(st), end_date: iso(end) }); end = new Date(st); end.setDate(end.getDate() - 1); }
  return out;
}
const shift = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dedupe = (rows, key) => { const s = new Set(); return rows.filter((r) => { const k = key(r); if (s.has(k)) return false; s.add(k); return true; }); };

function normActs(rows) {
  return rows.filter((a) => a && a.local_date && a.activityId).map((a) => ({
    id: String(a.activityId), date: a.local_date, type: a.activityType, name: a.activityName || a.activityType,
    mi: (a.distanceInMeters || 0) / MI, sec: a.durationInSeconds || 0,
    hr: a.averageHeartRateInBeatsPerMinute || null, maxhr: a.maxHeartRateInBeatsPerMinute || null,
    elev: a.totalElevationGainInMeters != null ? a.totalElevationGainInMeters * FT : null,
    watts: a.power ? a.power.avg_watts : null, start: a.startTimeInSeconds || 0, run: RUN_TYPES.includes(a.activityType),
  })).filter((a) => !(a.run && (a.mi < 0.1 || a.sec < 60)));
}
function normDaily(rows) {
  return rows.filter((r) => r && r.date).map((r) => ({
    date: r.date, ctl: r.ctl ?? null, atl: r.atl ?? null, tsb: r.tsb ?? null, hrv: r.hrv ?? null, rhr: r.restingHr ?? null,
    sleepMin: r.sleepDurationMin ?? null, sleepScore: r.sleepScore ?? null, recovery: r.recoveryScore ?? null, readiness: r.readinessScoreV2 ?? null,
    verdict: r.readinessVerdict ?? null, hrvBase: r.hrvBaseline60d ?? null, rhrBase: r.rhrBaseline60d ?? null, sleepNeed: r.sleepNeedMin ?? null, load: r.dailyLoad ?? null,
  })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function allDaily(from, today) {
  let rows = [], cursor, pages = 0;
  do {
    const args = { start: from, end: today }; if (cursor) args.cursor = cursor;
    const res = await callTool("get_daily_metrics", args);
    rows = rows.concat(rowsOf(res, ["rows"]) || []);
    cursor = res && typeof res === "object" ? res.next_cursor : null;
  } while (cursor && ++pages < 6);
  return dedupe(rows, (r) => r.date);
}

export async function fetchRange({ from, to }) {
  const [acts, daily] = await Promise.all([
    Promise.all(windows(from, to).map((w) => callTool("garmin_get_activities", { ...w, limit: 500 }).then((r) => rowsOf(r, ["activities"]) || []))).then((p) => dedupe(p.flat(), (r) => r.activityId)),
    allDaily(from, to),
  ]);
  return { acts: normActs(acts), daily: normDaily(daily) };
}

const SECONDS = (t) => { const p = String(t).split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
// Fastest stretch per distance inside GPS runs (athletedata get_pace_curve). Not lifetime PRs: coverage is reported with it.
export async function fetchBestEfforts() {
  const res = await callTool("get_pace_curve", { window_days: 9999 });
  const dr = res && res.distance_records;
  const recs = dr && Array.isArray(dr.records) ? dr.records : [];
  return {
    coverage: dr && dr.coverage ? { from: dr.coverage.records_from, warning: dr.coverage.warning || null } : null,
    rows: recs.map((r) => ({ distance: r.distance, time_sec: r.elapsed_sec ?? SECONDS(r.time), achieved_on: r.achieved_on, activity_id: r.source_activity_id ? String(r.source_activity_id) : null, prev_sec: r.previous ? SECONDS(r.previous.time) : null, prev_on: r.previous ? r.previous.achieved_on : null, first_effort_on: r.first_effort_on || null })),
  };
}

export async function getDashboard({ cfg }) {
  const today = todayIn(cfg.timezone);
  const from = shift(today, -(cfg.liveDays || 60)); // the live dashboard only needs recent weeks; History reads the rest from the database
  const [r, pmc, pred] = await Promise.all([
    fetchRange({ from, to: today }),
    callTool("get_pmc_status", {}).catch(() => null),
    callTool("get_race_prediction", { distance: "marathon" }).catch(() => null),
  ]);
  return {
    source: "live", today, generatedAt: Date.now(), acts: r.acts, daily: r.daily,
    pmc: pmc && typeof pmc === "object" ? { ctl: pmc.ctl, atl: pmc.atl, tsb: pmc.tsb, form: pmc.form_status, trend: pmc.fitness_trend, ramp: pmc.ramp_rate } : null,
    prediction: pred && typeof pred === "object" ? pred : null,
  };
}

// "t=120 hr107 10.4km/h alt209.2m 1.23km pos35.17136,-80.87086"
function parseStream(lines) {
  return (lines || []).map((l) => {
    const t = /t=(\d+)/.exec(l); if (!t) return null;
    const g = (re) => { const m = re.exec(l); return m ? +m[1] : null; };
    const pos = /pos(-?[\d.]+),(-?[\d.]+)/.exec(l);
    return { t: +t[1], hr: g(/\bhr(\d+)/), kmh: g(/([\d.]+)km\/h/), alt: g(/alt(-?[\d.]+)m/), km: g(/(?:^|\s)([\d.]+)km(?![/\w])/), lat: pos ? +pos[1] : null, lng: pos ? +pos[2] : null };
  }).filter(Boolean);
}
export async function getActivity(id) {
  const [stream, file] = await Promise.all([
    callTool("get_activity_stream", { source_activity_id: id, source: "garmin", channels: "hr,velocity,altitude,distance,lat,lng", sample_seconds: 20 }).catch((e) => ({ error: e.message })),
    callTool("garmin_get_activity_file", { id: Number(id), sample_seconds: 600 }).catch((e) => ({ error: e.message })),
  ]);
  const f = file && typeof file === "object" ? file : {};
  return {
    id, points: parseStream(stream && stream.stream && stream.stream.samples), streamStatus: stream && (stream.status || stream.error) || null,
    laps: Array.isArray(f.laps) ? f.laps : [], session: (f.sessions && f.sessions[0]) || null,
    zones: f.deviceTimeInZone && f.deviceTimeInZone.hrZones ? f.deviceTimeInZone.hrZones.zones : null,
  };
}
