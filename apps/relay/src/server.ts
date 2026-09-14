import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createDatabase, type MuxDatabase } from "@mux/database";
import { ConnectionManager } from "./ws/connectionManager.js";
import { EventDispatcher } from "./ws/dispatcher.js";
import { handleHttpRequest } from "./routes/api.js";
import { getDefaultRelayConfig, type RelayConfig } from "./config.js";
import fs from "node:fs";
import path from "node:path";

export interface RelayServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  db: MuxDatabase;
  port: number;
  host: string;
  close: () => Promise<void>;
}

export async function createRelayServer(
  partialConfig: Partial<RelayConfig> = {}
): Promise<RelayServerInstance> {
  const defaultConfig = getDefaultRelayConfig();
  const config: RelayConfig = { ...defaultConfig, ...partialConfig };

  // Ensure DB directory exists if not memory
  if (config.dbPath !== ":memory:") {
    const dir = path.dirname(config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = createDatabase(config.dbPath);
  const connections = new ConnectionManager();
  const dispatcher = new EventDispatcher(db, connections);

  const server = http.createServer((req, res) => {
    handleHttpRequest(req, res, db);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket) => {
    const socketId = crypto.randomUUID();
    const conn = connections.add(socketId, ws);

    ws.on("message", (data) => {
      dispatcher.handleMessage(conn, data as Buffer);
    });

    ws.on("pong", () => {
      conn.isAlive = true;
    });

    ws.on("close", () => {
      dispatcher.handleDisconnect(conn);
      connections.remove(socketId);
    });

    ws.on("error", () => {
      dispatcher.handleDisconnect(conn);
      connections.remove(socketId);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(config.port, config.host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : config.port;

      const instance: RelayServerInstance = {
        server,
        wss,
        db,
        port: actualPort,
        host: config.host,
        close: async () => {
          connections.close();
          await new Promise<void>((res) => wss.close(() => res()));
          await new Promise<void>((res) => server.close(() => res()));
          db.close();
        },
      };

      resolve(instance);
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
}
