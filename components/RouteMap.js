"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const BLANK = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#0c0d0f" } }] };

// Route line colored by speed (slow = dark blue, fast = pale). Falls back to a plain dark ground if tiles can't load.
export default function RouteMap({ points }) {
  const el = useRef(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    const gps = points.filter((p) => p.lat != null && p.lng != null);
    if (gps.length < 2) { setNote("No GPS track for this run."); return; }
    setNote("");
    let map, dead = false;
    (async () => {
      let style = STYLE;
      try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000); const r = await fetch(STYLE, { signal: c.signal }); clearTimeout(t); if (!r.ok) throw 0; } catch { style = BLANK; }
      if (dead) return;
      const lons = gps.map((p) => p.lng), lats = gps.map((p) => p.lat);
      map = new maplibregl.Map({ container: el.current, style, bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], fitBoundsOptions: { padding: 36 }, attributionControl: { compact: true }, cooperativeGestures: true });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        const feats = gps.slice(1).map((p, i) => ({ type: "Feature", properties: { kmh: ((p.kmh || 0) + (gps[i].kmh || 0)) / 2 }, geometry: { type: "LineString", coordinates: [[gps[i].lng, gps[i].lat], [p.lng, p.lat]] } }));
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
        map.addLayer({ id: "casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0c0d0f", "line-width": 7, "line-opacity": 0.8 } });
        map.addLayer({ id: "line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 4, "line-color": ["interpolate", ["linear"], ["get", "kmh"], 6, "#2a4f9c", 10, "#4f8ef7", 14, "#a9c9ff", 18, "#f2f7ff"] } });
        const mk = (p, color) => new maplibregl.Marker({ color }).setLngLat([p.lng, p.lat]).addTo(map);
        mk(gps[0], "#3fb68b"); mk(gps[gps.length - 1], "#ee6b6b");
      });
    })();
    return () => { dead = true; map && map.remove(); };
  }, [points]);
  return (<div className="mapwrap"><div ref={el} className="map" />{note && <div className="empty maplabel">{note}</div>}<div className="legend"><span>slower</span><i /><span>faster</span></div></div>);
}
