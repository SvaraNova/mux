import { WebSocket } from "ws";
import type { ServerMessage } from "@mux/protocol";

export interface ClientConnection {
  socketId: string;
  ws: WebSocket;
  workspaceId?: string;
  userId?: string;
  userName?: string;
  isAlive: boolean;
  connectedAt: string;
  /** Channels this connection is actively subscribed to */
  channels: Set<string>;
}

export class ConnectionManager {
  private connections = new Map<string, ClientConnection>();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    this.startHeartbeat();
  }

  add(socketId: string, ws: WebSocket): ClientConnection {
    const conn: ClientConnection = {
      socketId,
      ws,
      isAlive: true,
      connectedAt: new Date().toISOString(),
      channels: new Set(["general"]), // auto-join #general
    };
    this.connections.set(socketId, conn);
    return conn;
  }

  get(socketId: string): ClientConnection | undefined {
    return this.connections.get(socketId);
  }

  remove(socketId: string): ClientConnection | undefined {
    const conn = this.connections.get(socketId);
    if (conn) {
      this.connections.delete(socketId);
    }
    return conn;
  }

  associateUser(socketId: string, workspaceId: string, userId: string, userName: string): void {
    const conn = this.connections.get(socketId);
    if (conn) {
      conn.workspaceId = workspaceId;
      conn.userId = userId;
      conn.userName = userName;
    }
  }

  /** Add connection to a channel */
  joinChannel(socketId: string, channel: string): void {
    const conn = this.connections.get(socketId);
    if (conn) conn.channels.add(channel);
  }

  /** Remove connection from a channel */
  leaveChannel(socketId: string, channel: string): void {
    const conn = this.connections.get(socketId);
    if (conn && channel !== "general") conn.channels.delete(channel); // can't leave #general
  }

  /** Get all unique channels with at least one active subscriber in a workspace */
  getActiveChannels(workspaceId: string): string[] {
    const channelSet = new Set<string>();
    for (const conn of this.connections.values()) {
      if (conn.workspaceId === workspaceId && conn.ws.readyState === WebSocket.OPEN) {
        for (const ch of conn.channels) channelSet.add(ch);
      }
    }
    return Array.from(channelSet).sort();
  }

  getByWorkspace(workspaceId: string): ClientConnection[] {
    const result: ClientConnection[] = [];
    for (const conn of this.connections.values()) {
      if (conn.workspaceId === workspaceId && conn.ws.readyState === WebSocket.OPEN) {
        result.push(conn);
      }
    }
    return result;
  }

  send(conn: ClientConnection, message: ServerMessage): void {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }

  broadcastToWorkspace(
    workspaceId: string,
    message: ServerMessage,
    excludeSocketId?: string
  ): void {
    const json = JSON.stringify(message);
    for (const conn of this.connections.values()) {
      if (
        conn.workspaceId === workspaceId &&
        conn.socketId !== excludeSocketId &&
        conn.ws.readyState === WebSocket.OPEN
      ) {
        conn.ws.send(json);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [socketId, conn] of this.connections.entries()) {
        if (!conn.isAlive) {
          conn.ws.terminate();
          this.connections.delete(socketId);
          continue;
        }
        conn.isAlive = false;
        conn.ws.ping();
      }
    }, 30000);
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const conn of this.connections.values()) {
      conn.ws.close();
    }
    this.connections.clear();
  }
}
