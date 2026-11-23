import { C, FONT } from "./theme";
import { f1, paceMi, kmhToPaceMi, shortDate } from "./fmt";
import { weekOf, weekMiles } from "./plan";

const AXL = { color: C.dim, fontFamily: FONT, fontSize: 11 };
const AX = { axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false }, axisLabel: AXL, splitLine: { lineStyle: { color: C.line, opacity: 0.6 } } };
const TT = { backgroundColor: "#191a1e", borderColor: C.line, borderWidth: 1, textStyle: { color: C.ink, fontFamily: FONT, fontSize: 12 }, confine: true, extraCssText: "box-shadow:none;border-radius:8px" };
const catX = (dates) => ({ type: "category", data: dates.map(shortDate), ...AX, axisLabel: { ...AXL, hideOverlap: true }, splitLine: { show: false }, boundaryGap: false });
const dot = { borderColor: C.panel, borderWidth: 2 };
const LEG = { top: 0, right: 0, textStyle: { color: C.mut, fontFamily: FONT, fontSize: 11 }, itemWidth: 12, itemHeight: 8, icon: "roundRect" };

export function weeksOption(plan, acts, today) {
  const cats = plan.weeks.map((w) => (w.num === 0 ? "R" : String(w.num)));
  const actual = plan.weeks.map((w) => (w.days[0].date <= today ? Math.round(weekMiles(acts, w, today) * 10) / 10 : null));
  const cw = weekOf(plan, today), ci = cw ? plan.weeks.indexOf(cw) : -1;
  return {
    animationDuration: 500, grid: { left: 34, right: 6, top: 10, bottom: 24 },
    tooltip: { ...TT, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,.04)" } }, formatter: (p) => { const i = p[0].dataIndex, w = plan.weeks[i]; return `<b>${w.title}</b> · ${w.dates}<br>Plan ${w.planned} mi<br>Ran ${actual[i] == null ? "-" : actual[i] + " mi"}`; } },
    xAxis: { type: "category", data: cats, ...AX, splitLine: { show: false } }, yAxis: { type: "value", max: 70, interval: 20, ...AX },
    series: [
      { name: "Plan", type: "bar", data: plan.weeks.map((w) => w.planned), barWidth: "62%", itemStyle: { color: C.grey, borderRadius: [3, 3, 0, 0] }, markLine: ci >= 0 ? { symbol: "none", silent: true, lineStyle: { color: C.mut, type: "dashed", width: 1 }, label: { show: false }, data: [{ xAxis: ci }] } : undefined },
      { name: "Ran", type: "bar", data: actual, barWidth: "30%", barGap: "-48%", z: 3, itemStyle: { color: C.blue, borderRadius: [3, 3, 0, 0] } },
    ],
  };
}
export function loadOption(daily) {
  const d = daily.filter((x) => x.ctl != null);
  return {
    animationDuration: 500, legend: LEG, grid: { left: 34, right: 10, top: 26, bottom: 24 }, tooltip: { ...TT, trigger: "axis" },
    xAxis: catX(d.map((x) => x.date)), yAxis: { type: "value", ...AX },
    series: [
      { name: "Form (TSB)", type: "bar", data: d.map((x) => x.tsb), barWidth: "50%", itemStyle: { color: C.grey, borderRadius: 2 } },
      { name: "Fitness (CTL)", type: "line", data: d.map((x) => x.ctl), smooth: false, symbolSize: 5, lineStyle: { width: 2, color: C.blue }, itemStyle: { color: C.blue, ...dot } },
      { name: "Fatigue (ATL)", type: "line", data: d.map((x) => x.atl), smooth: false, symbolSize: 5, lineStyle: { width: 2, color: C.amber }, itemStyle: { color: C.amber, ...dot } },
    ],
  };
}
export function hrvOption(daily, floor = 70) {
  const d = daily.filter((x) => x.hrv != null);
  return {
    animationDuration: 500, legend: LEG, grid: { left: 34, right: 10, top: 26, bottom: 24 }, tooltip: { ...TT, trigger: "axis" },
    xAxis: catX(d.map((x) => x.date)), yAxis: { type: "value", scale: true, ...AX },
    series: [
      { name: "Overnight HRV", type: "line", data: d.map((x) => x.hrv), symbolSize: 5, lineStyle: { width: 2, color: C.blue }, itemStyle: { color: C.blue, ...dot },
        markLine: { symbol: "none", silent: true, lineStyle: { color: C.bad, type: "dashed", width: 1 }, label: { color: C.mut, fontSize: 11, formatter: floor + " ms gate", position: "insideStartTop" }, data: [{ yAxis: floor }] } },
      { name: "60-day baseline", type: "line", data: d.map((x) => x.hrvBase), showSymbol: false, lineStyle: { width: 1.5, color: C.mut, type: "dashed" }, itemStyle: { color: C.mut } },
    ],
  };
}
export function rhrOption(daily) {
  const d = daily.filter((x) => x.rhr != null);
  return {
    animationDuration: 500, legend: LEG, grid: { left: 34, right: 10, top: 26, bottom: 24 }, tooltip: { ...TT, trigger: "axis" },
    xAxis: catX(d.map((x) => x.date)), yAxis: { type: "value", scale: true, ...AX },
    series: [
      { name: "Resting HR", type: "line", data: d.map((x) => x.rhr), symbolSize: 5, lineStyle: { width: 2, color: C.amber }, itemStyle: { color: C.amber, ...dot } },
      { name: "60-day baseline", type: "line", data: d.map((x) => x.rhrBase), showSymbol: false, lineStyle: { width: 1.5, color: C.mut, type: "dashed" }, itemStyle: { color: C.mut } },
    ],
  };
}
export function sleepOption(daily) {
  const d = daily.filter((x) => x.sleepMin != null);
  return {
    animationDuration: 500, legend: LEG, grid: { left: 34, right: 10, top: 26, bottom: 24 },
    tooltip: { ...TT, trigger: "axis", formatter: (p) => { const i = p[0].dataIndex, x = d[i]; return `<b>${shortDate(x.date)}</b><br>Slept ${f1(x.sleepMin / 60)} h<br>Need ${x.sleepNeed ? f1(x.sleepNeed / 60) + " h" : "-"}<br>Sleep score ${x.sleepScore ?? "-"}`; } },
    xAxis: { ...catX(d.map((x) => x.date)), boundaryGap: true }, yAxis: { type: "value", min: 0, max: 10, interval: 2, ...AX },
    series: [
      { name: "Hours slept", type: "bar", data: d.map((x) => +(x.sleepMin / 60).toFixed(2)), barWidth: "50%", itemStyle: { color: C.blue, borderRadius: [3, 3, 0, 0] } },
      { name: "Sleep need", type: "line", data: d.map((x) => (x.sleepNeed ? +(x.sleepNeed / 60).toFixed(2) : null)), showSymbol: false, lineStyle: { width: 1.5, color: C.mut, type: "dashed" }, itemStyle: { color: C.mut } },
    ],
  };
}

// Run detail: pace, heart rate and elevation stacked on one distance axis. Stretches inside the goal-pace band are shaded.
export function runOption(points, band = [400, 418]) {
  const pts = [];
  let km = 0;
  points.forEach((p, i) => {
    if (p.km != null) km = p.km; else if (i && p.kmh != null) km += ((p.t - points[i - 1].t) / 3600) * (((p.kmh || 0) + (points[i - 1].kmh || 0)) / 2);
    pts.push({ ...p, mi: km / 1.609344 });
  });
  const pace = pts.filter((p) => p.kmh && p.kmh >= 7).map((p) => [+p.mi.toFixed(2), Math.round(kmhToPaceMi(p.kmh))]);
  const hr = pts.filter((p) => p.hr).map((p) => [+p.mi.toFixed(2), p.hr]);
  const alt = pts.filter((p) => p.alt != null).map((p) => [+p.mi.toFixed(2), Math.round(p.alt * 3.28084)]);
  const spans = []; let st = null;
  pace.forEach(([x, s], i) => { const inMp = s >= band[0] && s <= band[1]; if (inMp && st == null) st = x; if ((!inMp || i === pace.length - 1) && st != null) { spans.push([{ xAxis: st }, { xAxis: x }]); st = null; } });
  const grids = [{ left: 48, right: 10, top: 10, height: "27%" }, { left: 48, right: 10, top: "40%", height: "20%" }, { left: 48, right: 10, top: "66%", height: "16%" }];
  const xs = [0, 1, 2].map((g) => ({ type: "value", gridIndex: g, ...AX, splitLine: { show: false }, min: 0, axisLabel: g === 2 ? AXL : { show: false } }));
  const yl = (name) => ({ name, nameLocation: "end", nameTextStyle: { color: C.dim, fontSize: 11, align: "left", padding: [0, 0, 0, -40] } });
  return {
    animationDuration: 500,
    tooltip: { ...TT, trigger: "axis", axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: C.dim } }, formatter: (ps) => `<b>${ps[0].axisValue} mi</b><br>` + ps.map((q) => q.seriesName === "Pace" ? `Pace ${paceMi(q.value[1])}/mi` : q.seriesName === "Heart rate" ? `Heart rate ${q.value[1]} bpm` : `Elevation ${q.value[1]} ft`).join("<br>") },
    grid: grids, xAxis: xs,
    yAxis: [
      { type: "value", gridIndex: 0, inverse: true, scale: true, ...AX, axisLabel: { ...AXL, formatter: (v) => paceMi(v) } },
      { type: "value", gridIndex: 1, scale: true, ...AX },
      { type: "value", gridIndex: 2, scale: true, ...AX },
    ],
    series: [
      { name: "Pace", type: "line", xAxisIndex: 0, yAxisIndex: 0, data: pace, showSymbol: false, lineStyle: { width: 2, color: C.blue }, markArea: spans.length ? { silent: true, itemStyle: { color: "rgba(79,142,247,.16)" }, data: spans } : undefined },
      { name: "Heart rate", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: hr, showSymbol: false, lineStyle: { width: 2, color: C.amber } },
      { name: "Elevation", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: alt, showSymbol: false, lineStyle: { width: 1.5, color: C.mut }, areaStyle: { color: "rgba(154,157,166,.14)" } },
    ],
  };
}
