// Pure helpers, safe on the client and the server.
export const toSec = (hms) => { const p = String(hms).split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]; };
