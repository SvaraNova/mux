import type { IncomingMessage, ServerResponse } from "node:http";
import type { MuxDatabase } from "@mux/database";
import type { ConnectionManager } from "../ws/connectionManager.js";

/** Active SSE subscribers: workspace → set of response streams */
const sseSubscribers = new Map<string, Set<ServerResponse>>();

/**
 * Push a relay event to all SSE subscribers for a workspace.
 * Called externally after any event is saved+broadcast.
 */
export function pushSseEvent(workspaceId: string, data: object): void {
  const subs = sseSubscribers.get(workspaceId);
  if (!subs) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of subs) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected — remove
      subs.delete(res);
    }
  }
}

export function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  db: MuxDatabase,
  _connections?: ConnectionManager
): void {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // CORS headers for LAN convenience
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // ─── GET /health ────────────────────────────────────────────────────────────
  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "0.1.0", timestamp: new Date().toISOString() }));
    return;
  }

  // ─── GET /api/workspaces ─────────────────────────────────────────────────────
  if (url.pathname === "/api/workspaces" && req.method === "GET") {
    const list = db.workspaces.list();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(list));
    return;
  }

  // ─── GET /api/workspaces/:id ──────────────────────────────────────────────────
  const workspaceMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (workspaceMatch && req.method === "GET") {
    const idOrCode = workspaceMatch[1]!;
    let ws = db.workspaces.findById(idOrCode);
    if (!ws) ws = db.workspaces.findByJoinCode(idOrCode);
    if (!ws) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Workspace not found" }));
      return;
    }
    const users = db.users.listByWorkspace(ws.id);
    const events = db.events.listRecent(ws.id, 20);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ workspace: ws, users, recentEvents: events }));
    return;
  }

  // ─── GET /api/events/stream?workspace=<id> — Live SSE audit stream ───────────
  if (url.pathname === "/api/events/stream" && req.method === "GET") {
    const workspaceId = url.searchParams.get("workspace");
    if (!workspaceId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "workspace query param is required" }));
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send a comment heartbeat immediately
    res.write(": connected\n\n");

    // Register this response as an SSE subscriber
    if (!sseSubscribers.has(workspaceId)) {
      sseSubscribers.set(workspaceId, new Set());
    }
    sseSubscribers.get(workspaceId)!.add(res);

    // Send recent events immediately so the consumer has context
    const recent = db.events.listRecent(workspaceId, 50);
    for (const evt of recent) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // Heartbeat every 20 s to keep the connection alive through proxies
    const hb = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(hb);
      }
    }, 20_000);

    req.on("close", () => {
      clearInterval(hb);
      sseSubscribers.get(workspaceId)?.delete(res);
    });
    return;
  }

  // ─── GET /api/events?workspace=<id>&limit=50&offset=0&type=<t>&channel=<ch>&since=<iso>
  if (url.pathname === "/api/events" && req.method === "GET") {
    const workspaceId = url.searchParams.get("workspace");
    if (!workspaceId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "workspace query param is required" }));
      return;
    }

    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const typeFilter = url.searchParams.get("type") || null;
    const channelFilter = url.searchParams.get("channel") || null;
    const since = url.searchParams.get("since") || null;

    // Fetch a large page and filter in memory (simple, good enough for LAN audit)
    let events = db.events.listRecent(workspaceId, 500);

    if (since) {
      const sinceTs = new Date(since).getTime();
      events = events.filter((e) => new Date(e.timestamp).getTime() >= sinceTs);
    }
    if (typeFilter) {
      events = events.filter((e) => e.type === typeFilter);
    }
    if (channelFilter) {
      events = events.filter(
        (e) =>
          e.target?.id === channelFilter ||
          e.payload?.channel === channelFilter
      );
    }

    const total = events.length;
    const page = events.slice(offset, offset + limit);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        total,
        limit,
        offset,
        events: page,
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}
