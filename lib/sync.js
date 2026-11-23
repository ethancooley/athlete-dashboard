import { fetchRange, fetchBestEfforts } from "./providers";
import { upsertActivities, upsertDaily, replaceBestEfforts, setState } from "./store";

export const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const shift = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export async function syncRange(setup, from, to) {
  const r = await fetchRange(setup, from, to);
  await upsertActivities(r.acts);
  await upsertDaily(r.daily);
  await setState("last_sync", { from, to, acts: r.acts.length, daily: r.daily.length, at: Date.now() });
  return { acts: r.acts.length, daily: r.daily.length };
}
export async function syncBests() {
  const b = await fetchBestEfforts();
  await replaceBestEfforts(b.rows);
  await setState("best_efforts", { coverage: b.coverage, n: b.rows.length, at: Date.now() });
  return { bests: b.rows.length };
}
