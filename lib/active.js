// Resolves what the dashboard shows: global config, then the active block's settings and plan from the database.
// The active block is the one whose window contains today; failing that the next upcoming one, then the most recent.
// With no database, no plan, or a database error, the generated sample plan is shown.
import { getSetup, todayIn, merge, withPlan } from "./config";
import { samplePlan } from "./samplePlan";
import { hasDb } from "./db";
import { activePlan } from "./store";

export async function loadSetup() {
  const { cfg: base } = getSetup();
  const today = todayIn(base.timezone);
  let found = null, error = null;
  if (hasDb()) { try { found = await activePlan(today); } catch (e) { error = String((e && e.message) || e).slice(0, 160); } }
  const cfg0 = found && found.settings ? merge(base, found.settings) : base;
  const plan = found ? found.plan : samplePlan(today, cfg0);
  const cfg = withPlan(cfg0, plan);
  return { cfg, plan, sample: !found, block: found ? { slug: found.slug, name: found.name, version: found.version } : null, error };
}
