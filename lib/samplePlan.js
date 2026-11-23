// A generic 12-week marathon build, generated relative to today so a fresh clone always shows a live-looking week.
// Your own plans live in the database; import them on the Admin page (same shape).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const lab = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const WEEKLY = [24, 28, 32, 26, 34, 38, 40, 32, 42, 36, 28, 0]; // last week is race week and is built separately

export function samplePlan(today, cfg) {
  const t = new Date(today + "T00:00:00Z");
  const monday = new Date(t); monday.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  const start = new Date(monday); start.setUTCDate(monday.getUTCDate() - 28); // four weeks done, the demo data covers them
  const goal = (cfg && cfg.event && cfg.event.goalPace) || "8:00";
  const weeks = WEEKLY.map((m, i) => {
    const ws = new Date(start); ws.setUTCDate(start.getUTCDate() + i * 7);
    const race = i === WEEKLY.length - 1;
    const long = Math.round(m * 0.32), tue = Math.round(m * 0.18), thu = Math.round(m * 0.17), wed = Math.round(m * 0.13);
    const sun = Math.max(3, m - long - tue - thu - wed);
    const plan = race
      ? [[0, "Upper body and core, easy swim", "strength", "Strength + swim"], [4, "4 mi easy", "norm"], [3, "3 mi easy + 4x20 sec strides", "norm"], [3, "3 mi easy", "norm"], [0, "Rest", "rest"], [2, "2 mi shakeout + 4x20 sec strides", "norm"], [26.2, "RACE DAY: " + ((cfg && cfg.event && cfg.event.name) || "Marathon"), "race", "Race"]]
      : [[0, "Upper body and core, easy swim", "strength", "Strength + swim"], [tue, `${tue} mi with ${Math.max(2, Math.round(tue / 3))} mi at goal pace (${goal}/mi)`, "key", "Quality"], [wed, `${wed} mi easy`, "norm"], [thu, `${thu} mi steady`, "norm"], [0, "Rest", "rest"], [long, `${long} mi long run, easy`, "key", "Long run"], [sun, `${sun} mi easy`, "norm"]];
    const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
    const days = plan.map((p, k) => { const d = new Date(ws); d.setUTCDate(ws.getUTCDate() + k); return { date: iso(d), dow: DOWS[order[k]], label: lab(d), miles: p[0], text: p[1], type: p[2], tag: p[3] || null }; });
    const we = new Date(ws); we.setUTCDate(ws.getUTCDate() + 6);
    return { num: i + 1, title: "Week " + (i + 1), dates: lab(ws) + " - " + lab(we), focus: race ? "Race week" : [4, 8, 11].includes(i + 1) ? "Down week" : "Build", phase: i < 4 ? 1 : i < 9 ? 2 : 3, planned: race ? 38.2 : m, days };
  });
  return {
    race: weeks[weeks.length - 1].days[6].date, plan_start: weeks[0].days[0].date,
    paces: [], gates: [], phases: [{ n: "Build", w: "Weeks 1-4", m: "24-32 mi", t: "Sample plan." }],
    weeks,
  };
}
