import { q } from "./db";
import { hms, paceMi } from "./fmt";

// jsonb does not keep key order, so plans are compared with sorted keys.
const stable = (v) => (Array.isArray(v) ? "[" + v.map(stable).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}" : JSON.stringify(v));
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export async function upsertActivities(rows) {
  for (const part of chunk(rows, 200)) {
    await q(`INSERT INTO activities (id,date,type,name,mi,sec,hr,maxhr,elev,watts,run,start_ts)
      SELECT id,date,type,name,mi,sec,hr,maxhr,elev,watts,run,start_ts FROM jsonb_to_recordset($1::jsonb)
        AS x(id text,date text,type text,name text,mi real,sec int,hr real,maxhr real,elev real,watts real,run boolean,start_ts bigint)
      ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,type=EXCLUDED.type,name=EXCLUDED.name,mi=EXCLUDED.mi,sec=EXCLUDED.sec,hr=EXCLUDED.hr,maxhr=EXCLUDED.maxhr,elev=EXCLUDED.elev,watts=EXCLUDED.watts,run=EXCLUDED.run,start_ts=EXCLUDED.start_ts`,
      [JSON.stringify(part.map((a) => ({ id: a.id, date: a.date, type: a.type, name: a.name, mi: a.mi, sec: Math.round(a.sec), hr: a.hr, maxhr: a.maxhr, elev: a.elev, watts: a.watts, run: !!a.run, start_ts: a.start })))]);
  }
}
export async function upsertDaily(rows) {
  for (const part of chunk(rows, 200)) {
    await q(`INSERT INTO daily (date,ctl,atl,tsb,hrv,rhr,sleep_min,sleep_score,recovery,readiness,load)
      SELECT date,ctl,atl,tsb,hrv,rhr,sleep_min,sleep_score,recovery,readiness,load FROM jsonb_to_recordset($1::jsonb)
        AS x(date text,ctl real,atl real,tsb real,hrv real,rhr real,sleep_min real,sleep_score real,recovery real,readiness real,load real)
      ON CONFLICT (date) DO UPDATE SET ctl=EXCLUDED.ctl,atl=EXCLUDED.atl,tsb=EXCLUDED.tsb,hrv=EXCLUDED.hrv,rhr=EXCLUDED.rhr,sleep_min=EXCLUDED.sleep_min,sleep_score=EXCLUDED.sleep_score,recovery=EXCLUDED.recovery,readiness=EXCLUDED.readiness,load=EXCLUDED.load`,
      [JSON.stringify(part.map((d) => ({ date: d.date, ctl: d.ctl, atl: d.atl, tsb: d.tsb, hrv: d.hrv, rhr: d.rhr, sleep_min: d.sleepMin, sleep_score: d.sleepScore, recovery: d.recovery, readiness: d.readiness, load: d.load })))]);
  }
}
export async function replaceBestEfforts(rows) {
  for (const r of rows) {
    await q(`INSERT INTO best_efforts (distance,time_sec,achieved_on,activity_id,prev_sec,prev_on,first_effort_on) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (distance) DO UPDATE SET time_sec=EXCLUDED.time_sec,achieved_on=EXCLUDED.achieved_on,activity_id=EXCLUDED.activity_id,prev_sec=EXCLUDED.prev_sec,prev_on=EXCLUDED.prev_on,first_effort_on=EXCLUDED.first_effort_on`,
      [r.distance, r.time_sec, r.achieved_on, r.activity_id, r.prev_sec ?? null, r.prev_on ?? null, r.first_effort_on ?? null]);
  }
}
export async function setState(key, value) {
  await q(`INSERT INTO sync_state (key,value,updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`, [key, JSON.stringify(value)]);
}

const str = (v, n = 400) => (v == null ? null : String(v).slice(0, n));
const num = (v) => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));
const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
// Per-block settings the dashboard may override while the block is active. Anything else is dropped.
const SETTING_KEYS = ["event", "anchor", "gates", "goalPaceBand", "trainStart"];
const settingsOf = (v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = {}; for (const k of SETTING_KEYS) if (v[k] !== undefined) o[k] = v[k];
  const j = JSON.stringify(o); return Object.keys(o).length && j.length < 4000 ? j : null;
};
const slug = (v) => (typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,60}$/.test(v) ? v : null);

// Import blocks, races and plans from a JSON document. Idempotent: same slug/id overwrites, an identical plan is not versioned twice.
export async function importDoc(doc) {
  const out = { blocks: 0, races: 0, plans: 0, skipped: [] };
  for (const b of doc.blocks || []) {
    if (!slug(b.slug) || !str(b.name)) { out.skipped.push("block " + (b.slug || "?")); continue; }
    await q(`INSERT INTO blocks (slug,name,kind,start_date,end_date,race_date,goal,result,notes,position,settings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
      ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,race_date=EXCLUDED.race_date,goal=EXCLUDED.goal,result=COALESCE(EXCLUDED.result,blocks.result),notes=EXCLUDED.notes,position=EXCLUDED.position,settings=COALESCE(EXCLUDED.settings,blocks.settings)`,
      [b.slug, str(b.name, 120), str(b.kind, 30), day(b.start), day(b.end), day(b.race_date), str(b.goal), str(b.result), str(b.notes, 2000), num(b.position) ?? 0, settingsOf(b.settings)]);
    out.blocks++;
  }
  for (const r of doc.races || []) {
    const id = slug(r.id), date = day(r.date);
    if (!id || !date || !str(r.name)) { out.skipped.push("race " + (r.id || "?")); continue; }
    await q(`INSERT INTO races (id,date,name,kind,distance_km,time_sec,source,place,notes,activity_id,planned,goal_sec,block_slug) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,name=EXCLUDED.name,kind=EXCLUDED.kind,distance_km=EXCLUDED.distance_km,time_sec=COALESCE(EXCLUDED.time_sec,races.time_sec),source=COALESCE(EXCLUDED.source,races.source),place=EXCLUDED.place,notes=EXCLUDED.notes,activity_id=COALESCE(EXCLUDED.activity_id,races.activity_id),planned=(EXCLUDED.planned AND races.time_sec IS NULL),goal_sec=EXCLUDED.goal_sec,block_slug=EXCLUDED.block_slug`,
      [id, date, str(r.name, 160), str(r.kind, 30), num(r.distance_km), num(r.time_sec), str(r.source, 30), str(r.place, 60), str(r.notes, 1000), str(r.activity_id, 30), !!r.planned, num(r.goal_sec), slug(r.block) ]);
    out.races++;
  }
  for (const p of doc.plans || []) {
    if (!slug(p.block) || !p.plan || !Array.isArray(p.plan.weeks)) { out.skipped.push("plan " + (p.block || "?")); continue; }
    if (await savePlanVersion(p.block, p.plan, str(p.note, 300))) out.plans++;
  }
  return out;
}

// Append a plan version unless it equals the latest one. Returns the new version number, or 0 when nothing changed.
export async function savePlanVersion(block, plan, note) {
  const last = await q(`SELECT version, plan FROM plan_versions WHERE block_slug=$1 ORDER BY version DESC LIMIT 1`, [block]);
  if (last[0] && stable(last[0].plan) === stable(plan)) return 0;
  const v = (last[0] ? last[0].version : 0) + 1;
  await q(`INSERT INTO plan_versions (block_slug,version,note,plan) VALUES ($1,$2,$3,$4::jsonb)`, [block, v, note || null, JSON.stringify(plan)]);
  return v;
}
export async function planVersions(block) {
  return q(`SELECT version, created_at, note FROM plan_versions WHERE block_slug=$1 ORDER BY version DESC`, [block]);
}
export async function getPlan(block, version) {
  const r = version
    ? await q(`SELECT version, plan FROM plan_versions WHERE block_slug=$1 AND version=$2`, [block, version])
    : await q(`SELECT version, plan FROM plan_versions WHERE block_slug=$1 ORDER BY version DESC LIMIT 1`, [block]);
  return r[0] || null;
}
export async function blocksWithPlans() {
  return q(`SELECT b.slug, b.name, b.start_date AS start, b.end_date AS "end", (SELECT max(version) FROM plan_versions p WHERE p.block_slug=b.slug)::int AS version FROM blocks b WHERE EXISTS (SELECT 1 FROM plan_versions p WHERE p.block_slug=b.slug) ORDER BY b.start_date DESC NULLS LAST`);
}

// The plan the dashboard shows: the latest version of the block whose window contains today, else the next upcoming
// block, else the most recent one. Returns null when no block has a plan.
export async function activePlan(today) {
  const rows = await q(`SELECT DISTINCT ON (p.block_slug) p.block_slug AS slug, p.version, p.plan, b.name, b.start_date, b.end_date, b.race_date, b.settings
    FROM plan_versions p LEFT JOIN blocks b ON b.slug=p.block_slug ORDER BY p.block_slug, p.version DESC`);
  const c = rows.map((r) => {
    const w = (r.plan && r.plan.weeks) || [], first = w[0] && w[0].days && w[0].days[0] && w[0].days[0].date, lastW = w[w.length - 1], last = lastW && lastW.days && lastW.days.length ? lastW.days[lastW.days.length - 1].date : null;
    return { ...r, name: r.name || r.slug, start: r.start_date || r.plan.plan_start || first, end: r.end_date || r.race_date || r.plan.race || last };
  }).filter((x) => x.start && x.end && x.plan && Array.isArray(x.plan.weeks) && x.plan.weeks.length);
  const by = (f) => (a, b) => f(a, b);
  const now = c.filter((x) => x.start <= today && today <= x.end).sort(by((a, b) => b.start.localeCompare(a.start)))[0];
  const next = c.filter((x) => x.start > today).sort(by((a, b) => a.start.localeCompare(b.start)))[0];
  const past = c.filter((x) => x.end < today).sort(by((a, b) => b.end.localeCompare(a.end)))[0];
  const pick = now || next || past;
  return pick ? { slug: pick.slug, name: pick.name, version: pick.version, plan: pick.plan, settings: pick.settings || null } : null;
}

// Close finished blocks: for each past race still without a time, find the run on race day that matches its distance
// and take the time from it; then write the block's result line if it has none. Nothing already filled in is overwritten.
export async function closeBlocks(today) {
  const out = { races: 0, blocks: 0, notes: [] };
  const open = await q(`SELECT id,date,name,distance_km,goal_sec,block_slug FROM races WHERE time_sec IS NULL AND date < $1 AND (kind IS NULL OR kind<>'bike')`, [today]);
  for (const r of open) {
    const runs = await q(`SELECT id,mi,sec FROM activities WHERE date=$1 AND run=true AND sec>0 AND mi>0`, [r.date]);
    let pick = null;
    if (r.distance_km) {
      const want = r.distance_km / 1.609344;
      pick = runs.filter((a) => Math.abs(a.mi - want) / want <= 0.08).sort((a, b) => Math.abs(a.mi - want) - Math.abs(b.mi - want))[0] || null;
    } else pick = runs.sort((a, b) => b.mi - a.mi)[0] || null;
    if (!pick) { out.notes.push("no matching run for " + r.id); continue; }
    await q(`UPDATE races SET time_sec=$2, activity_id=$3, source='watch', planned=false WHERE id=$1 AND time_sec IS NULL`, [r.id, pick.sec, pick.id]);
    out.races++;
  }
  const todo = await q(`SELECT b.slug, r.time_sec, r.distance_km, r.goal_sec FROM blocks b JOIN races r ON r.block_slug=b.slug
    WHERE (b.result IS NULL OR b.result='') AND r.time_sec IS NOT NULL AND r.date < $1 ORDER BY r.date DESC`, [today]);
  const seen = new Set();
  for (const b of todo) {
    if (seen.has(b.slug)) continue; seen.add(b.slug);
    let line = hms(b.time_sec);
    if (b.distance_km) line += ", " + paceMi(b.time_sec / (b.distance_km / 1.609344)) + "/mi";
    if (b.goal_sec) { const d = Math.round(b.time_sec - b.goal_sec); line += d === 0 ? ", on goal" : ", " + hms(Math.abs(d)) + (d < 0 ? " under" : " over") + " the " + hms(b.goal_sec) + " goal"; }
    await q(`UPDATE blocks SET result=$2 WHERE slug=$1 AND (result IS NULL OR result='')`, [b.slug, line]);
    out.blocks++;
  }
  return out;
}

export async function loadHistory() {
  const [acts, daily, blocks, plans, races, bests, state] = await Promise.all([
    q(`SELECT id,date,type,name,mi,sec,hr,maxhr,elev,watts,run FROM activities ORDER BY date,start_ts`),
    q(`SELECT date,ctl,atl,tsb,hrv,rhr,sleep_min AS "sleepMin" FROM daily ORDER BY date`),
    q(`SELECT slug,name,kind,start_date AS start,end_date AS "end",race_date,goal,result,notes,position FROM blocks ORDER BY start_date NULLS LAST, position`),
    q(`SELECT DISTINCT ON (block_slug) block_slug, version, created_at, note, plan FROM plan_versions ORDER BY block_slug, version DESC`),
    q(`SELECT id,date,name,kind,distance_km,time_sec,source,place,notes,activity_id,planned,goal_sec,block_slug FROM races ORDER BY date DESC`),
    q(`SELECT distance,time_sec,achieved_on,activity_id,prev_sec,prev_on,first_effort_on FROM best_efforts`),
    q(`SELECT key,value,updated_at FROM sync_state`),
  ]);
  const versions = await q(`SELECT block_slug, count(*)::int AS n FROM plan_versions GROUP BY block_slug`);
  return { acts, daily, blocks, plans, races, bests, state, versions };
}
export async function counts() {
  const r = await q(`SELECT (SELECT count(*) FROM activities)::int AS acts, (SELECT count(*) FROM daily)::int AS daily, (SELECT count(*) FROM blocks)::int AS blocks, (SELECT count(*) FROM races)::int AS races, (SELECT count(*) FROM plan_versions)::int AS plans, (SELECT min(date) FROM activities) AS first, (SELECT max(date) FROM activities) AS last`);
  return r[0];
}
