import type { IncomingMessage, ServerResponse } from "node:http";
import type { MuxDatabase } from "@mux/database";

export function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  db: MuxDatabase
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

  // Health endpoint
  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "0.1.0", timestamp: new Date().toISOString() }));
    return;
  }

  // List workspaces
  if (url.pathname === "/api/workspaces" && req.method === "GET") {
    const list = db.workspaces.list();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(list));
    return;
  }

  // Workspace details
  const workspaceMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (workspaceMatch && req.method === "GET") {
    const idOrCode = workspaceMatch[1];
    let ws = db.workspaces.findById(idOrCode);
    if (!ws) {
      ws = db.workspaces.findByJoinCode(idOrCode);
    }
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}
