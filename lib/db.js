// Postgres access. Production uses DATABASE_URL (Neon on Vercel). Tests use an in-process PGlite (PGLITE=1).
let handle = null, ready = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS activities (id text PRIMARY KEY, date text NOT NULL, type text, name text, mi real, sec int, hr real, maxhr real, elev real, watts real, run boolean, start_ts bigint)`,
  `CREATE INDEX IF NOT EXISTS activities_date ON activities (date)`,
  `CREATE TABLE IF NOT EXISTS daily (date text PRIMARY KEY, ctl real, atl real, tsb real, hrv real, rhr real, sleep_min real, sleep_score real, recovery real, readiness real, load real)`,
  `CREATE TABLE IF NOT EXISTS blocks (slug text PRIMARY KEY, name text NOT NULL, kind text, start_date text, end_date text, race_date text, goal text, result text, notes text, position int DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS plan_versions (id serial PRIMARY KEY, block_slug text NOT NULL, version int NOT NULL, created_at timestamptz DEFAULT now(), note text, plan jsonb NOT NULL, UNIQUE (block_slug, version))`,
  `CREATE TABLE IF NOT EXISTS races (id text PRIMARY KEY, date text NOT NULL, name text NOT NULL, kind text, distance_km real, time_sec real, source text, place text, notes text, activity_id text, planned boolean DEFAULT false, goal_sec real, block_slug text)`,
  `CREATE TABLE IF NOT EXISTS best_efforts (distance text PRIMARY KEY, time_sec real, achieved_on text, activity_id text, prev_sec real, prev_on text, first_effort_on text)`,
  `CREATE TABLE IF NOT EXISTS sync_state (key text PRIMARY KEY, value jsonb, updated_at timestamptz DEFAULT now())`,
];

async function open() {
  if (process.env.PGLITE === "1") {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(process.env.PGLITE_DIR || undefined);
    return { query: async (sql, params) => (await db.query(sql, params)).rows };
  }
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("No database. Add a Postgres database (Neon on Vercel) so DATABASE_URL is set.");
  const pg = (await import("pg")).default;
  const pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000 });
  return { query: async (sql, params) => (await pool.query(sql, params)).rows };
}

export async function q(sql, params = []) {
  if (!handle) handle = open();
  const h = await handle;
  if (!ready) ready = (async () => { for (const s of SCHEMA) await h.query(s); })();
  await ready;
  return h.query(sql, params);
}
