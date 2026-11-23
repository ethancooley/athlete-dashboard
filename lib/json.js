// Parse the first complete JSON value in a string, ignoring text before it or notes after it.
export function firstJson(t) {
  const st = t.search(/[\[{]/);
  if (st < 0) return undefined;
  let d = 0, ins = false, esc = false;
  for (let k = st; k < t.length; k++) {
    const c = t[k];
    if (ins) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') ins = false; continue; }
    if (c === '"') ins = true;
    else if (c === "{" || c === "[") d++;
    else if (c === "}" || c === "]") { d--; if (d === 0) { try { return JSON.parse(t.slice(st, k + 1)); } catch { return undefined; } } }
  }
  return undefined;
}
export function rowsOf(p, keys) {
  if (typeof p === "string") { const q = firstJson(p); if (q === undefined) return /no garmin|no data|not stored/i.test(p) ? [] : null; p = q; }
  if (Array.isArray(p)) return p;
  if (p && typeof p === "object") { for (const k of keys) if (Array.isArray(p[k])) return p[k]; const v = Object.values(p).find(Array.isArray); if (v) return v; }
  return null;
}
