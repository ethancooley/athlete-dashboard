import { q } from "./db";

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
const slug = (v) => (typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,60}$/.test(v) ? v : null);

// Import blocks, races and plans from a JSON document. Idempotent: same slug/id overwrites, an identical plan is not versioned twice.
export async function importDoc(doc) {
  const out = { blocks: 0, races: 0, plans: 0, skipped: [] };
  for (const b of doc.blocks || []) {
    if (!slug(b.slug) || !str(b.name)) { out.skipped.push("block " + (b.slug || "?")); continue; }
    await q(`INSERT INTO blocks (slug,name,kind,start_date,end_date,race_date,goal,result,notes,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,race_date=EXCLUDED.race_date,goal=EXCLUDED.goal,result=EXCLUDED.result,notes=EXCLUDED.notes,position=EXCLUDED.position`,
      [b.slug, str(b.name, 120), str(b.kind, 30), day(b.start), day(b.end), day(b.race_date), str(b.goal), str(b.result), str(b.notes, 2000), num(b.position) ?? 0]);
    out.blocks++;
  }
  for (const r of doc.races || []) {
    const id = slug(r.id), date = day(r.date);
    if (!id || !date || !str(r.name)) { out.skipped.push("race " + (r.id || "?")); continue; }
    await q(`INSERT INTO races (id,date,name,kind,distance_km,time_sec,source,place,notes,activity_id,planned,goal_sec,block_slug) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,name=EXCLUDED.name,kind=EXCLUDED.kind,distance_km=EXCLUDED.distance_km,time_sec=EXCLUDED.time_sec,source=EXCLUDED.source,place=EXCLUDED.place,notes=EXCLUDED.notes,activity_id=EXCLUDED.activity_id,planned=EXCLUDED.planned,goal_sec=EXCLUDED.goal_sec,block_slug=EXCLUDED.block_slug`,
      [id, date, str(r.name, 160), str(r.kind, 30), num(r.distance_km), num(r.time_sec), str(r.source, 30), str(r.place, 60), str(r.notes, 1000), str(r.activity_id, 30), !!r.planned, num(r.goal_sec), slug(r.block) ]);
    out.races++;
  }
  for (const p of doc.plans || []) {
    if (!slug(p.block) || !p.plan || !Array.isArray(p.plan.weeks)) { out.skipped.push("plan " + (p.block || "?")); continue; }
    const last = await q(`SELECT version, plan FROM plan_versions WHERE block_slug=$1 ORDER BY version DESC LIMIT 1`, [p.block]);
    if (last[0] && stable(last[0].plan) === stable(p.plan)) continue;
    await q(`INSERT INTO plan_versions (block_slug,version,note,plan) VALUES ($1,$2,$3,$4::jsonb)`, [p.block, (last[0] ? last[0].version : 0) + 1, str(p.note, 300), JSON.stringify(p.plan)]);
    out.plans++;
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
