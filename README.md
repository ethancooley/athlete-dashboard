# Training dashboard

A private, self-hosted dashboard for endurance training. It turns a training plan plus your watch data into a
quiet, fast view of the week, your recovery, each run and the race ahead.

- **Overview**: countdown, this week against plan, a readiness gauge with a hard-day gate, today, and the plan strip
- **Training**: weekly mileage against plan, fitness, fatigue and form
- **Recovery**: overnight HRV against its baseline and your gate, resting heart rate, sleep
- **Runs**: every run; select one to open a detail overlay with the route map, pace, heart rate and elevation on one axis, splits and time in zone
- **Race**: goal, checkpoints, and a Riegel projection from a recent race result
- **History**: every week on record with your training blocks shaded and races marked, a card per block (miles, peak week, plan followed, result), and a detail view with plan vs actual, fitness, the plan as it was written, and every run in the block (select one to open it)
- **Records**: race results and personal records by distance, progression charts, and Garmin best efforts kept separate from real results. Results, PRs and best efforts open the run behind them
- **Admin**: backfill history, import blocks and races, edit the plan (every save is a new version), and close finished blocks

Next.js 14, ECharts, MapLibre, Postgres. One password protects everything. Data is fetched server-side, so no key reaches the browser.

## Try it in two minutes (no account, no data source)

```
npm install
MOCK=1 DASH_PASSWORD=demo SESSION_SECRET=$(openssl rand -hex 32) npm run dev
```

Open http://localhost:3000 and sign in with `demo`. You will see a generated sample plan and synthetic training data. An install with no plan in the database shows the same sample plan. To try History, Records and Admin too, add `PGLITE=1` (an in-process database, nothing to install).

## Use your own data

Four steps. Steps 1 to 3 get the live dashboard running; the database section below adds plans, History and Records.

1. **Global settings.** Copy `config/athlete.config.example.json` to `config/athlete.config.json` and edit it (git-ignored).
   On a host such as Vercel, put the same JSON in the `ATHLETE_CONFIG` environment variable instead.
   Your event, goal and plan are not in config: they live in the database, per training block (see below). There is no plan environment variable.
2. **Data source.** The included provider reads from an [athletedata](https://athletedata.com) MCP server. Set
   `ATHLETEDATA_MCP_URL` (and `ATHLETEDATA_MCP_TOKEN` if you have one). To use another source, implement
   `getDashboard` and `getActivity` in `lib/providers/` (the shapes are described in `lib/providers/index.js`) and select it there.
3. **Secrets.** `DASH_PASSWORD` is what you type to sign in. `SESSION_SECRET` is a random string (`openssl rand -hex 32`).

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Needed | Purpose |
|---|---|---|
| `DASH_PASSWORD`, `SESSION_SECRET` | yes | Sign-in password and the key that signs the session cookie |
| `ATHLETEDATA_MCP_URL`, `ATHLETEDATA_MCP_TOKEN` | for real data | Data source (the token is sent as a Bearer key) |
| `DATABASE_URL` | for plans, History, Records | Postgres connection string (Neon on Vercel sets it) |
| `CRON_SECRET` | for the nightly sync | Authorizes the cron call to `/api/cron/sync` |
| `ATHLETE_CONFIG` | optional | Global settings as JSON |
| `MOCK=1` | optional | Synthetic demo data, no data source needed |
| `PGLITE=1` | optional | In-process database for local trials |

Set every variable before the first deploy that needs it. Vercel reads environment variables when a deployment is created, so a variable added later takes effect only on the next deployment.

## Plans, history and records (needs Postgres)

The live dashboard reads training data straight from your data source. Plans, blocks, races, History and Records live in a Postgres database that a sync keeps current.
The dashboard shows the latest plan version of the block whose dates contain today (failing that the next upcoming block, then the most recent). Starting a new block is one import: no environment variable or redeploy.

1. Add a Postgres database. On Vercel, Storage > Create Database > Neon, connected to the project. That sets `DATABASE_URL`. Locally, set `DATABASE_URL` yourself.
2. Set `CRON_SECRET` to a random string. Vercel Cron (see `vercel.json`) calls `/api/cron/sync` nightly to refresh the last 14 days and best efforts.
3. Open `/admin`, enter the date your history starts, and run the backfill. It loads one month at a time and is safe to repeat.
4. In `/admin`, import your blocks, races and plans as JSON (a full example is in `config/import.example.json`):

```json
{
  "blocks": [{ "slug": "spring-half", "name": "Spring half build", "kind": "race-build", "start": "2026-01-05", "end": "2026-03-29", "race_date": "2026-03-29", "goal": "Sub 1:45", "result": "1:43:10" }],
  "races":  [{ "id": "spring-half-2026", "date": "2026-03-29", "name": "City Half", "distance_km": 21.0975, "time_sec": 6190, "source": "official", "block": "spring-half" }],
  "plans":  [{ "block": "spring-half", "note": "as published", "plan": { "weeks": [] } }]
}
```

A block can carry `settings` (`event`, `anchor`, `gates`, `goalPaceBand`, `trainStart`, described below) that apply while it is the active block, so each build has its own goal.
`source` is `official` or `watch`. A race without a `time_sec` and `planned: true` shows under Upcoming. Re-importing a changed plan stores a new version and keeps the old one. A block without a `start` is shown with an estimated 16-week window and flagged as estimated.
Re-importing is safe: a result or race time already filled in is not overwritten by an import that leaves it empty.

**Editing a plan.** `/admin` has a plan editor: pick a block and week, change miles, workout, type or tag, and save. Every save is a new version; History keeps the old ones and you can restore any of them.

**Closing a block.** The nightly job looks at each past race that has no time, takes the time from the run on race day that matches the distance, then writes the block's result if it is empty. Nothing already filled in is overwritten (the Admin page has a Run now button).

**Run details.** Selecting a run anywhere opens an overlay with the route, charts, splits and zones. These are fetched live from the data source when you click, so they depend on what it returns for that activity.

Tables are created automatically on first use. Run `PGLITE=1 MOCK=1 npm run dev` to try the whole thing locally with an in-process database and synthetic data (demo mode also loads synthetic blocks).

## Configuration

Global keys go in `ATHLETE_CONFIG` or `config/athlete.config.json`. `event`, `anchor`, `gates`, `goalPaceBand` and `trainStart` can also be set per block (a block's value wins while it is active).

| Key | Meaning |
|---|---|
| `timezone` | IANA zone used to decide what "today" is |
| `historyStart` | Where the History backfill starts (set in Admin) |
| `liveDays` | Recent days the live dashboard loads on each refresh (default 60) |
| `trainStart` | Start of the build, used for the countdown bar (default: first plan day) |
| `event` | `name`, `date`, `goalTime`, `goalPace` (per mile), `distanceKm`, optional `lede` |
| `anchor` | A recent race result (`label`, `name`, `seconds`, `distanceKm`). Enables the Riegel projection |
| `gates` | Hard-day gate: `hrvFloor` (ms), `hrvDays` (mornings in a row), `rhrDelta` (bpm above the 14-day average) |
| `goalPaceBand` | `[low, high]` seconds per mile shaded on the run chart (default: goal pace, -10 s to +8 s) |

A plan is `{ race, weeks: [{ num, title, dates, focus, planned, days: [{ date, dow, label, miles, text, type, tag }] }] }`.
`type` is one of `norm`, `key`, `race`, `strength`, `rest`. Optional `splits` replaces the even-pace checkpoint table.

## Deploy on Vercel

1. Import this repo in Vercel. The framework is detected as Next.js.
2. Add a Neon database (Storage tab) so `DATABASE_URL` is set, then add the other environment variables above, then deploy.
3. Open `/admin`, run the backfill, and import your blocks and plan.
4. Optional custom domain: Project > Settings > Domains, then add the CNAME record Vercel shows at your DNS host.

## Privacy

The repository contains code, a generated sample plan and synthetic demo data only. Your plans, goals and history live in
your own database, and secrets live in environment variables or git-ignored files. Everything except the login page and the
secret-protected cron route is behind the password. Never prefix secrets with `NEXT_PUBLIC_`.

## Notes

- Data refreshes at most every 5 minutes per server instance. The Refresh button forces a fresh pull.
- `lib/mcp.js` speaks the MCP streamable-HTTP protocol. It follows the spec but has not been verified against every server.
  If `/api/data` shows an error, the message names the failing call.
- Activities older than about 30 days come from the data source's own archive, which names fields differently. The provider normalizes them, so old and recent runs look the same. After upgrading from a version that predates this, run the backfill again to correct stored rows.
- Route maps load dark tiles from CARTO in the browser and fall back to a plain dark ground if unreachable.

## License

MIT
