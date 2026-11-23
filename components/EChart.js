"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function EChart({ option, height = 240, onReady }) {
  const el = useRef(null), inst = useRef(null);
  useEffect(() => {
    inst.current = echarts.init(el.current, null, { renderer: "canvas" });
    const ro = new ResizeObserver(() => inst.current && inst.current.resize());
    ro.observe(el.current);
    if (onReady) onReady(inst.current);
    return () => { ro.disconnect(); inst.current && inst.current.dispose(); inst.current = null; };
  }, []);
  useEffect(() => { inst.current && inst.current.setOption(option, true); }, [option]);
  return <div ref={el} style={{ width: "100%", height }} role="img" aria-label="chart" />;
}
