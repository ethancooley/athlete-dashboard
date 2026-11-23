# Training dashboard

A private, self-hosted dashboard for endurance training. It turns a training plan plus your watch data into a
quiet, fast view of the week, your recovery, each run and the race ahead.

- **Overview**: countdown, this week against plan, a readiness gauge with a hard-day gate, today, and the plan strip
- **Training**: weekly mileage against plan, fitness, fatigue and form
- **Recovery**: overnight HRV against its baseline and your gate, resting heart rate, sleep
- **Runs**: every run, with a detail view: route map, pace, heart rate and elevation on one axis, splits, time in zone
- **Race**: goal, checkpoints, and a Riegel projection from a recent race result

Next.js 14, ECharts, MapLibre. One password protects everything. Data is fetched server-side, so no key reaches the browser.

## Try it in two minutes (no account, no data source)

```
npm install
MOCK=1 DASH_PASSWORD=demo SESSION_SECRET=$(openssl rand -hex 32) npm run dev
```

Open http://localhost:3000 and sign in with `demo`. You will see a generated sample plan and synthetic training data.

## Use your own data

1. **Plan and event.** Copy `config/athlete.config.example.json` to `config/athlete.config.json` and
   `config/plan.example.json` to `config/plan.json`, then edit them. Both files are git-ignored.
   On a host such as Vercel, put the same JSON in the `ATHLETE_CONFIG` and `PLAN_JSON` environment variables instead.
2. **Data source.** The included provider reads from an [athletedata](https://athletedata.com) MCP server. Set
   `ATHLETEDATA_MCP_URL` (and `ATHLETEDATA_MCP_TOKEN` if you have one). To use another source, implement
   `getDashboard` and `getActivity` in `lib/providers/` (the shapes are described in `lib/providers/index.js`) and select it there.
3. **Secrets.** `DASH_PASSWORD` is what you type to sign in. `SESSION_SECRET` is a random string (`openssl rand -hex 32`).

Copy `.env.example` to `.env.local` and fill it in.

## Configuration

| Key | Meaning |
|---|---|
| `timezone` | IANA zone used to decide what "today" is |
| `historyStart` | First date to load (default: the last 60 days) |
| `trainStart` | Start of the build, used for the countdown bar (default: first plan day) |
| `event` | `name`, `date`, `goalTime`, `goalPace` (per mile), `distanceKm`, optional `lede` |
| `anchor` | A recent race result (`label`, `name`, `seconds`, `distanceKm`). Enables the Riegel projection |
| `gates` | Hard-day gate: `hrvFloor` (ms), `hrvDays` (mornings in a row), `rhrDelta` (bpm above the 14-day average) |
| `goalPaceBand` | `[low, high]` seconds per mile shaded on the run chart (default: goal pace, -10 s to +8 s) |

A plan is `{ race, weeks: [{ num, title, dates, focus, planned, days: [{ date, dow, label, miles, text, type, tag }] }] }`.
`type` is one of `norm`, `key`, `race`, `strength`, `rest`. Optional `splits` replaces the even-pace checkpoint table.

## Deploy on Vercel

1. Import this repo in Vercel. The framework is detected as Next.js.
2. Add the environment variables above, then deploy.
3. Optional custom domain: Project > Settings > Domains, then add the CNAME record Vercel shows at your DNS host.

## Privacy

The repository contains code, a generated sample plan and synthetic demo data only. Your plan, goals and secrets live in
environment variables or git-ignored files. Everything, including the API routes, is behind the password.
Never prefix secrets with `NEXT_PUBLIC_`.

## Notes

- Data refreshes at most every 5 minutes per server instance. The Refresh button forces a fresh pull.
- `lib/mcp.js` speaks the MCP streamable-HTTP protocol. It follows the spec but has not been verified against every server.
  If `/api/data` shows an error, the message names the failing call.
- Route maps load dark tiles from CARTO in the browser and fall back to a plain dark ground if unreachable.

## License

MIT
