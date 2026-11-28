#!/usr/bin/env node
/**
 * Tiny HTTP wrapper around refreshWeights so you can `curl` the local
 * box to trigger a refresh ad-hoc. Also what systemd / cron can hit
 * on a weekly schedule.
 *
 * Usage:
 *   node scripts/weights-server.mjs
 *
 * Required env (same as refresh-weights.mjs):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   PORT              default 3100
 *   REFRESH_TOKEN     when set, /refresh requires ?token=<REFRESH_TOKEN>
 */

import http from "node:http";
import { refreshWeights } from "./refresh-weights.mjs";

const PORT = Number(process.env.PORT ?? 3100);
const TOKEN = process.env.REFRESH_TOKEN ?? null;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname !== "/refresh") {
    res.writeHead(404);
    res.end();
    return;
  }
  if (TOKEN) {
    const t = url.searchParams.get("token") ?? "";
    if (t !== TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
  }
  try {
    console.log(`[weights-server] ${new Date().toISOString()} refresh fired`);
    const result = await refreshWeights();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e?.stack ?? e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
  }
});

server.listen(PORT, () => {
  console.log(
    `[weights-server] listening on :${PORT}${TOKEN ? " (token required)" : ""}`,
  );
});
