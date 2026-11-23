// Edge-safe (Web Crypto) session cookie: "<expiryMs>.<hmac>"
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
export async function makeToken(secret, days = 30) {
  const exp = String(Date.now() + days * 864e5);
  return exp + "." + (await hmac(secret, exp));
}
export async function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const i = token.indexOf(".");
  if (i < 1) return false;
  const exp = token.slice(0, i);
  if (!(Number(exp) > Date.now())) return false;
  return safeEqual(token.slice(i + 1), await hmac(secret, exp));
}
export const COOKIE = "ath_session";
