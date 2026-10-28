#!/usr/bin/env node
/**
 * hf.mjs — thin CLI over the Higgsfield MCP server (https://mcp.higgsfield.ai/mcp).
 *
 *   node scripts/film/hf.mjs <tool> '<json-args>'
 *   node scripts/film/hf.mjs tools                  # list tool names
 *
 * Auth: reuses the OAuth access token Cline stored in
 * ~/.cline/data/settings/cline_mcp_settings.json (server "mcp-hf"), or
 * HIGGSFIELD_TOKEN env. The server is kept DISABLED in Cline (its tool list
 * breaks Anthropic's schema rules), so Cline never refreshes the token; on a
 * 401 this script refreshes it itself with the stored refresh_token at the
 * issuer's token endpoint and writes the new token set back into the same
 * record (atomic rename). Prints the tool result (text blocks) to stdout.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const URL_ = process.env.HIGGSFIELD_MCP_URL || "https://mcp.higgsfield.ai/mcp";

const SETTINGS = path.join(os.homedir(), ".cline/data/settings/cline_mcp_settings.json");

async function token() {
  if (process.env.HIGGSFIELD_TOKEN) return process.env.HIGGSFIELD_TOKEN;
  const j = JSON.parse(await fs.readFile(SETTINGS, "utf8"));
  const srv = Object.values(j.mcpServers || {}).find((s) => String(s.url || "").includes("higgsfield"));
  const t = srv?.oauth?.tokens?.access_token;
  if (!t) throw new Error("no Higgsfield token; set HIGGSFIELD_TOKEN");
  return t;
}

/** Refresh the stored OAuth tokens (public client, refresh_token grant) and persist them. */
async function refreshToken() {
  if (process.env.HIGGSFIELD_TOKEN) throw new Error("HTTP 401 with HIGGSFIELD_TOKEN set: token expired, get a fresh one");
  const raw = await fs.readFile(SETTINGS, "utf8");
  const j = JSON.parse(raw);
  const [name, srv] = Object.entries(j.mcpServers || {}).find(([, s]) => String(s.url || "").includes("higgsfield")) || [];
  const o = srv?.oauth;
  const endpoint = o?.discoveryState?.authorizationServerMetadata?.token_endpoint;
  const refresh = o?.tokens?.refresh_token;
  const clientId = o?.clientInformation?.client_id;
  if (!endpoint || !refresh || !clientId) throw new Error("HTTP 401 and no refresh_token/client_id/token_endpoint in the Cline record: re-authorize mcp-hf in Cline");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
  if (o.clientInformation.client_secret) body.set("client_secret", o.clientInformation.client_secret);
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`token refresh HTTP ${res.status}: ${text.slice(0, 300)} — re-authorize mcp-hf in Cline`);
  const t = JSON.parse(text);
  if (!t.access_token) throw new Error("token refresh returned no access_token");
  j.mcpServers[name].oauth.tokens = { ...o.tokens, ...t, refresh_token: t.refresh_token || refresh };
  j.mcpServers[name].oauth.lastAuthenticatedAt = Date.now();
  const tmp = `${SETTINGS}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(j, null, 2));
  await fs.rename(tmp, SETTINGS);
  console.error("hf: refreshed Higgsfield token");
  return t.access_token;
}

let id = 0;
let current = null;
async function rpc(method, params, tok, retried = false) {
  current ??= tok;
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${current}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const text = await res.text();
  if (res.status === 401 && !retried) {
    current = await refreshToken();
    return rpc(method, params, current, true);
  }
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}: ${text.slice(0, 500)}`);
  const line = text
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .pop();
  const msg = JSON.parse(line || text);
  if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
  return msg.result;
}

const [tool, rawArgs] = process.argv.slice(2);
if (!tool) {
  console.error("usage: hf.mjs <tool|tools> '<json-args>'");
  process.exit(1);
}
const tok = await token();

if (tool === "tools") {
  const r = await rpc("tools/list", {}, tok);
  for (const t of r.tools) console.log(t.name);
  process.exit(0);
}

// hf.mjs wait <jobId> [timeoutSec] — poll job_status until terminal; print JSON.
if (tool === "wait") {
  const jobId = rawArgs;
  const budget = Number(process.argv[4] || 600) * 1000;
  const t0 = Date.now();
  for (;;) {
    const r = await rpc("tools/call", { name: "job_status", arguments: { jobId, sync: true } }, tok);
    const sc = r.structuredContent || {};
    const g = sc.generation || sc;
    const st = g.status || "?";
    if (["completed", "failed", "canceled", "cancelled", "error", "nsfw"].includes(st)) {
      console.log(JSON.stringify(sc, null, 1));
      process.exit(st === "completed" ? 0 : 2);
    }
    if (Date.now() - t0 > budget) {
      console.error(`timeout after ${budget / 1000}s, status=${st}`);
      process.exit(3);
    }
    await new Promise((res) => setTimeout(res, ((sc.poll_after_seconds ?? 5) + 1) * 1000));
  }
}

const args = rawArgs ? JSON.parse(rawArgs) : {};
const r = await rpc("tools/call", { name: tool, arguments: args }, tok);
if (r.isError) console.error("TOOL ERROR");
for (const c of r.content || []) {
  if (c.type === "text") console.log(c.text);
  else console.log(JSON.stringify(c).slice(0, 2000));
}
if (r.structuredContent) console.log(JSON.stringify(r.structuredContent, null, 1));
process.exit(r.isError ? 2 : 0);
