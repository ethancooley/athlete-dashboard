// Server-side configuration. Nothing personal lives in the repo: your event, goal, plan and thresholds come from
//   1. env vars ATHLETE_CONFIG and PLAN_JSON (JSON strings, the right choice on Vercel), or
//   2. git-ignored files config/athlete.config.json and config/plan.json (the right choice when self-hosting), or
//   3. the built-in defaults and a generated sample plan (what a fresh clone shows).
import fs from "fs";
import path from "path";
import { samplePlan } from "./samplePlan";
import { toSec } from "./time";

export const DEFAULTS = {
  title: "Training Dashboard",
  timezone: "UTC",
  historyStart: null,            // YYYY-MM-DD. null = the last 60 days
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
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b || {})) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" ? merge(a[k], b[k]) : b[k]; return o; };

export const paceSec = (p) => toSec(String(p).replace(/\s*\/?\s*mi.*$/, ""));

export function todayIn(tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" }).format(new Date()); }

export function getSetup() {
  const cfg = merge(DEFAULTS, readJson("ATHLETE_CONFIG", "athlete.config.json") || {});
  let plan = readJson("PLAN_JSON", "plan.json");
  const sample = !plan;
  if (!plan) plan = samplePlan(todayIn(cfg.timezone), cfg);
  if (!cfg.event.date) cfg.event.date = plan.race;
  if (!plan.race) plan.race = cfg.event.date;
  if (!cfg.trainStart) cfg.trainStart = plan.weeks[0].days[0].date;
  if (!cfg.goalPaceBand) { const g = paceSec(cfg.event.goalPace); cfg.goalPaceBand = [g - 10, g + 8]; }
  return { cfg, plan, sample };
}
