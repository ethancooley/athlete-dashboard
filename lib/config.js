// Server-side configuration. Nothing personal lives in the repo.
//   Global settings (title, timezone, history start, footer) come from the ATHLETE_CONFIG env var (JSON string, the right
//   choice on Vercel) or a git-ignored config/athlete.config.json (the right choice when self-hosting), over the defaults.
//   Each training block can carry its own event, goal, anchor and gates; those override the global settings while the block is active.
//   Plans live in the database (see lib/active.js). With no database or no plan, a generated sample plan is shown.
import fs from "fs";
import path from "path";
import { toSec } from "./time";

export const DEFAULTS = {
  title: "Training Dashboard",
  timezone: "UTC",
  historyStart: null,            // YYYY-MM-DD. Where the History backfill starts (Admin page)
  liveDays: 60,                  // how many recent days the live dashboard pulls on each refresh
  trainStart: null,              // YYYY-MM-DD. null = first day of the plan
  event: { name: "Sample Marathon", date: null, goalTime: "3:30:00", goalPace: "8:00", distanceKm: 42.195, lede: null },
  anchor: null,                  // { label: "10K in 48:00", name: "10K", seconds: 2880, distanceKm: 10 } enables the Riegel projection
  gates: { hrvFloor: 70, hrvDays: 2, rhrDelta: 5 },
  goalPaceBand: null,            // [lowSecPerMile, highSecPerMile] shaded on the run chart. null = goal pace +/- 10 s
  footer: "Data from your Garmin watch through athletedata.",
};

const readJson = (env, file) => {
  const raw = process.env[env];
  if (raw) { try { return JSON.parse(raw); } catch { throw new Error(env + " is not valid JSON"); } }
  const p = path.join(process.cwd(), "config", file);
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { throw new Error("config/" + file + " is not valid JSON"); } }
  return null;
};
export const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b || {})) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" ? merge(a[k], b[k]) : b[k]; return o; };

export const paceSec = (p) => toSec(String(p).replace(/\s*\/?\s*mi.*$/, ""));

export function todayIn(tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" }).format(new Date()); }

// Global configuration only. Per-block settings and the plan are layered on by loadSetup (lib/active.js).
export function getSetup() {
  return { cfg: merge(DEFAULTS, readJson("ATHLETE_CONFIG", "athlete.config.json") || {}) };
}

// Fill the fields that depend on the plan.
export function withPlan(cfg, plan) {
  const c = merge(cfg, {});
  if (!c.event.date) c.event.date = plan.race;
  if (!plan.race) plan.race = c.event.date;
  if (!c.trainStart) c.trainStart = plan.weeks[0].days[0].date;
  if (!c.goalPaceBand) { const g = paceSec(c.event.goalPace); c.goalPaceBand = [g - 10, g + 8]; }
  return c;
}
