import { firstJson } from "./json";

// Minimal MCP "streamable HTTP" client for the athletedata server. Server-side only.
// NOTE: written against the MCP spec; it has not been run against the live athletedata endpoint yet.
const URL_ = () => process.env.ATHLETEDATA_MCP_URL;
let sessionId = null, ready = null, nextId = 1;

function headers() {
  const h = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (process.env.ATHLETEDATA_MCP_TOKEN) h.Authorization = "Bearer " + process.env.ATHLETEDATA_MCP_TOKEN;
  if (sessionId) h["Mcp-Session-Id"] = sessionId;
  return h;
}
function parse(text, ct, id) {
  if (ct && ct.includes("text/event-stream")) {
    let found = null;
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { const m = JSON.parse(line.slice(5).trim()); if (m.id === id || m.error) found = m; } catch {}
    }
    return found;
  }
  try { return JSON.parse(text); } catch { return null; }
}
async function post(body, id) {
  const r = await fetch(URL_(), { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" });
  const sid = r.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const text = await r.text();
  if (!r.ok) { const e = new Error(`athletedata HTTP ${r.status}: ${text.slice(0, 160)}`); e.status = r.status; throw e; }
  return id == null ? null : parse(text, r.headers.get("content-type"), id);
}
async function init() {
  if (!URL_()) throw new Error("ATHLETEDATA_MCP_URL is not set");
  sessionId = null;
  const id = nextId++;
  const res = await post({ jsonrpc: "2.0", id, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "athlete-dashboard", version: "1.0.0" } } }, id);
  if (!res || res.error) throw new Error("athletedata initialize failed: " + JSON.stringify(res && res.error).slice(0, 160));
  await post({ jsonrpc: "2.0", method: "notifications/initialized" }, null);
}
export async function callTool(name, args = {}, retry = true) {
  try {
    if (!ready) ready = init().catch((e) => { ready = null; throw e; });
    await ready;
    const id = nextId++;
    const res = await post({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, id);
    if (!res) throw new Error("empty MCP response");
    if (res.error) throw new Error(`${name}: ${res.error.message || JSON.stringify(res.error)}`);
    const out = res.result || {};
    const text = (out.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (out.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
    if (out.structuredContent) return out.structuredContent;
    const j = firstJson(text);
    return j === undefined ? text : j;
  } catch (e) {
    if (retry && (e.status === 404 || e.status === 400 || /session/i.test(e.message))) { ready = null; sessionId = null; return callTool(name, args, false); }
    throw e;
  }
}
