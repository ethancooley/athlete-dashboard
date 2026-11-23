// Pure plan editing, used by the Admin plan editor. Edits change one day at a time; a week's planned miles are
// recomputed from its days when any of them changed.
export const DAY_TYPES = ["norm", "key", "rest", "strength", "race"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function applyEdits(plan, edits) {
  if (!plan || !Array.isArray(plan.weeks)) throw new Error("Plan has no weeks");
  if (!Array.isArray(edits) || !edits.length) throw new Error("No edits given");
  if (edits.length > 120) throw new Error("Too many edits at once");
  const next = JSON.parse(JSON.stringify(plan)), touched = new Set();
  for (const e of edits) {
    if (!e || !DAY.test(e.date)) throw new Error("Each edit needs a date (YYYY-MM-DD)");
    let hit = null, wk = null;
    for (const w of next.weeks) for (const d of w.days || []) if (d.date === e.date) { hit = d; wk = w; }
    if (!hit) throw new Error("No day " + e.date + " in this plan");
    if (e.miles !== undefined) { const m = Number(e.miles); if (!isFinite(m) || m < 0 || m > 120) throw new Error("Miles must be 0 to 120 (" + e.date + ")"); hit.miles = Math.round(m * 10) / 10; }
    if (e.text !== undefined) { const t = String(e.text).trim(); if (!t || t.length > 300) throw new Error("Workout text must be 1 to 300 characters (" + e.date + ")"); hit.text = t; }
    if (e.type !== undefined) { if (!DAY_TYPES.includes(e.type)) throw new Error("Type must be one of " + DAY_TYPES.join(", ")); hit.type = e.type; }
    if (e.tag !== undefined) { const t = e.tag == null ? "" : String(e.tag).trim(); if (t.length > 40) throw new Error("Tag is too long (" + e.date + ")"); hit.tag = t || null; }
    touched.add(wk);
  }
  for (const w of touched) w.planned = Math.round(w.days.reduce((s, d) => s + (Number(d.miles) || 0), 0) * 10) / 10;
  return next;
}
