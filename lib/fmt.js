export const pad = (n) => String(n).padStart(2, "0");
export const f1 = (x) => String(Math.round(x * 10) / 10);
export const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`; };
export const paceMi = (spm) => { if (!(isFinite(spm) && spm > 0)) return "-"; let m = Math.floor(spm / 60), r = Math.round(spm % 60); if (r === 60) { m++; r = 0; } return m + ":" + pad(r); };
export const kmhToPaceMi = (kmh) => (kmh > 0 ? 3600 / (kmh / 1.609344) : null);
export const shortDate = (s) => new Date(s + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
export const stamp = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
