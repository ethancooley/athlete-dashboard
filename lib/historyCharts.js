import { C, FONT } from "./theme";
import { shortDate, hms } from "./fmt";
import { weeklyRuns, shiftDay, weeksBetween, blockWindow, planWeeks } from "./history";

const AXL = { color: C.dim, fontFamily: FONT, fontSize: 11 };
const AX = { axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false }, axisLabel: AXL, splitLine: { lineStyle: { color: C.line, opacity: 0.6 } } };
const TT = { backgroundColor: "#191a1e", borderColor: C.line, borderWidth: 1, textStyle: { color: C.ink, fontFamily: FONT, fontSize: 12 }, confine: true, extraCssText: "box-shadow:none;border-radius:8px" };
const LEG = { top: 0, right: 0, textStyle: { color: C.mut, fontFamily: FONT, fontSize: 11 }, itemWidth: 12, itemHeight: 8, icon: "roundRect" };
const dot = { borderColor: C.panel, borderWidth: 2 };

// Every week of history: run miles as bars, fitness (CTL) below on its own axis, blocks as bands, races as lines.
export function everyWeekOption({ acts, daily, blocks, races, today }) {
  const firstAct = acts.find((a) => a.run);
  if (!firstAct) return null;
  const weeks = weeksBetween(firstAct.date, today), wk = weeklyRuns(acts);
  const ctlBy = new Map(); for (const d of daily) if (d.ctl != null) ctlBy.set(d.date, d.ctl);
  const ctl = weeks.map((m) => { for (let i = 6; i >= 0; i--) { const v = ctlBy.get(shiftDay(m, i)); if (v != null) return Math.round(v * 10) / 10; } return null; });
  const idx = (d) => { const m = weeks.indexOf(weeks.find((w, i) => d >= w && (i === weeks.length - 1 || d < weeks[i + 1]))); return m; };
  const bands = blocks.map((b, i) => { const w = blockWindow(b, today); const s = Math.max(0, idx(w.start < weeks[0] ? weeks[0] : w.start)), e = Math.max(s, idx(w.end > today ? today : w.end)); return [{ xAxis: s, name: b.name, itemStyle: { color: i % 2 ? "rgba(255,255,255,.035)" : "rgba(79,142,247,.07)" }, label: { show: e - s >= 6, position: "insideTop", color: C.mut, fontSize: 10, fontFamily: FONT, formatter: b.name } }, { xAxis: e }]; });
  const raceLines = races.filter((r) => !r.planned && r.date >= weeks[0] && r.date <= today).map((r) => ({ xAxis: idx(r.date), label: { show: false }, name: r.name }));
  return {
    animationDuration: 500, legend: LEG, grid: [{ left: 40, right: 10, top: 26, height: "48%" }, { left: 40, right: 10, top: "66%", height: "22%" }],
    tooltip: { ...TT, trigger: "axis", axisPointer: { type: "line" }, formatter: (p) => { const i = p[0].dataIndex, m = weeks[i], w = wk.get(m); return `<b>Week of ${shortDate(m)}</b>, ${m.slice(0, 4)}<br>${w ? w.mi.toFixed(1) + " mi in " + w.runs + " runs" : "No runs"}<br>Fitness (CTL) ${ctl[i] == null ? "-" : ctl[i]}`; } },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    xAxis: [0, 1].map((g) => ({ type: "category", gridIndex: g, data: weeks.map((m) => m.slice(2, 7)), ...AX, splitLine: { show: false }, boundaryGap: g === 0,
      axisLabel: g === 0 ? { show: false } : { ...AXL, interval: (i) => i === 0 || weeks[i].slice(0, 7) !== weeks[i - 1].slice(0, 7), formatter: (v, i) => { const m = weeks[i]; if (!m) return ""; const mo = new Date(m + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }); return m.slice(5, 7) === "01" || i === 0 ? mo + " '" + m.slice(2, 4) : mo; }, hideOverlap: true } })),
    yAxis: [{ type: "value", gridIndex: 0, ...AX }, { type: "value", gridIndex: 1, scale: true, ...AX }],
    series: [
      { name: "Run miles per week", type: "bar", xAxisIndex: 0, yAxisIndex: 0, data: weeks.map((m) => (wk.get(m) ? +wk.get(m).mi.toFixed(1) : 0)), itemStyle: { color: C.blue, borderRadius: [2, 2, 0, 0] }, barCategoryGap: "25%",
        markArea: bands.length ? { silent: true, data: bands } : undefined,
        markLine: raceLines.length ? { symbol: "none", silent: true, lineStyle: { color: C.amber, type: "solid", width: 1.5 }, label: { show: false }, data: raceLines } : undefined },
      { name: "Fitness (CTL)", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: ctl, showSymbol: false, connectNulls: true, lineStyle: { width: 2, color: C.amber }, itemStyle: { color: C.amber, ...dot } },
    ],
  };
}

// One block: weekly miles against the plan.
export function blockWeeksOption(block, acts, plan, today) {
  const win = blockWindow(block, today), weeks = weeksBetween(win.start, win.end), wk = weeklyRuns(acts.filter((a) => a.date >= win.start && a.date <= win.end));
  const pw = planWeeks(plan), planned = weeks.map((m) => { const p = pw.find((x) => x.start === m); return p ? p.planned : null; });
  const hasPlan = planned.some((x) => x != null);
  const ran = weeks.map((m) => (shiftDay(m, 0) <= today ? +((wk.get(m) || { mi: 0 }).mi).toFixed(1) : null));
  return {
    animationDuration: 500, legend: hasPlan ? LEG : undefined, grid: { left: 36, right: 8, top: hasPlan ? 28 : 12, bottom: 24 },
    tooltip: { ...TT, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,.04)" } }, formatter: (p) => { const i = p[0].dataIndex; return `<b>Week of ${shortDate(weeks[i])}</b><br>Ran ${ran[i] == null ? "-" : ran[i] + " mi"}${planned[i] != null ? "<br>Plan " + planned[i] + " mi" : ""}`; } },
    xAxis: { type: "category", data: weeks.map((m, i) => String(i + 1)), ...AX, splitLine: { show: false } }, yAxis: { type: "value", ...AX },
    series: [
      ...(hasPlan ? [{ name: "Plan", type: "bar", data: planned, barWidth: "62%", itemStyle: { color: C.grey, borderRadius: [3, 3, 0, 0] } }] : []),
      { name: "Ran", type: "bar", data: ran, barWidth: hasPlan ? "30%" : "55%", barGap: "-48%", z: 3, itemStyle: { color: C.blue, borderRadius: [3, 3, 0, 0] } },
    ],
  };
}

export function blockFitnessOption(block, daily, today) {
  const win = blockWindow(block, today), d = daily.filter((x) => x.date >= win.start && x.date <= win.end && x.ctl != null);
  if (d.length < 3) return null;
  return {
    animationDuration: 500, legend: LEG, grid: { left: 36, right: 8, top: 28, bottom: 24 }, tooltip: { ...TT, trigger: "axis" },
    xAxis: { type: "category", data: d.map((x) => shortDate(x.date)), ...AX, splitLine: { show: false }, boundaryGap: false, axisLabel: { ...AXL, hideOverlap: true } }, yAxis: { type: "value", scale: true, ...AX },
    series: [
      { name: "Fitness (CTL)", type: "line", data: d.map((x) => x.ctl), showSymbol: false, lineStyle: { width: 2, color: C.blue }, itemStyle: { color: C.blue } },
      { name: "Fatigue (ATL)", type: "line", data: d.map((x) => x.atl), showSymbol: false, lineStyle: { width: 1.5, color: C.amber }, itemStyle: { color: C.amber } },
    ],
  };
}

export function progressionOption(points, name) {
  const pts = points.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    animationDuration: 500, grid: { left: 52, right: 14, top: 14, bottom: 24 },
    tooltip: { ...TT, trigger: "item", formatter: (p) => `<b>${pts[p.dataIndex].label}</b><br>${shortDate(pts[p.dataIndex].date)}, ${pts[p.dataIndex].date.slice(0, 4)}<br>${hms(pts[p.dataIndex].sec)}` },
    xAxis: { type: "category", data: pts.map((p) => p.date.slice(0, 7)), ...AX, splitLine: { show: false } }, yAxis: { type: "value", inverse: true, scale: true, ...AX, axisLabel: { ...AXL, formatter: (v) => hms(v) } },
    series: [{ name, type: "line", data: pts.map((p) => p.sec), symbolSize: 9, lineStyle: { width: 2, color: C.blue }, itemStyle: { color: C.blue, ...dot } }],
  };
}
