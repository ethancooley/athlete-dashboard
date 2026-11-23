// Synthetic blocks, races and plans for demo mode (MOCK=1). Nothing here is real.
import { samplePlan } from "./samplePlan";

export function demoSeed() {
  const cfg = { event: { goalPace: "9:00", name: "Demo Half Marathon" } };
  const spring = samplePlan("2025-03-03", cfg), fall = samplePlan("2025-09-01", { event: { goalPace: "9:00", name: "Demo Fall Half" } });
  const tag = (p) => ({ ...p, weeks: p.weeks.map((w) => ({ ...w })) });
  return {
    blocks: [
      { slug: "spring-half-2025", name: "Spring half build", kind: "race-build", start: spring.plan_start, end: spring.race, race_date: spring.race, goal: "Finish a half in 2:00 or better", result: "1:58:30, two minutes inside the goal", position: 1 },
      { slug: "fall-half-2025", name: "Fall half build", kind: "race-build", start: fall.plan_start, end: fall.race, race_date: fall.race, goal: "Run 1:55", result: "1:54:05, a new best", position: 2 },
    ],
    races: [
      { id: "demo-half-spring", date: spring.race, name: "Demo Spring Half", kind: "road", distance_km: 21.0975, time_sec: 7110, source: "official", place: "Demo City", block: "spring-half-2025" },
      { id: "demo-10k", date: "2025-07-12", name: "Demo Summer 10K", kind: "road", distance_km: 10, time_sec: 3130, source: "official", place: "Demo City" },
      { id: "demo-half-fall", date: fall.race, name: "Demo Fall Half", kind: "road", distance_km: 21.0975, time_sec: 6845, source: "official", place: "Demo City", block: "fall-half-2025" },
      { id: "demo-next", date: "2027-03-14", name: "Demo Spring Marathon", kind: "road", distance_km: 42.195, planned: true, goal_sec: 14400 },
    ],
    plans: [{ block: "spring-half-2025", note: "as published", plan: tag(spring) }, { block: "fall-half-2025", note: "as published", plan: tag(fall) }],
  };
}
