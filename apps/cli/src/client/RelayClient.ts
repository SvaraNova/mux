import { WebSocket } from "ws";
import { EventEmitter } from "node:events";
import {
  type ServerMessage,
  type RelayEvent,
  type ServerWelcomeMessage,
  ServerMessageSchema,
} from "@mux/protocol";

export interface RelayClientOptions {
  url: string;
  workspace: string;
  joinCode?: string;
  user: {
    id: string;
    name: string;
  };
  autoReconnect?: boolean;
}

export type RelayClientEvents = {
  connect: () => void;
  disconnect: (reason?: string) => void;
  welcome: (welcome: ServerWelcomeMessage) => void;
  event: (event: RelayEvent) => void;
  error: (err: { code: string; message: string }) => void;
};

export class RelayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isClosedExplicitly = false;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private connected = false;

  constructor(public readonly options: RelayClientOptions) {
    super();
  }

  connect(): void {
    this.isClosedExplicitly = false;
    let wsUrl = this.options.url;
    if (wsUrl.startsWith("http://")) {
      wsUrl = wsUrl.replace("http://", "ws://");
    } else if (wsUrl.startsWith("https://")) {
      wsUrl = wsUrl.replace("https://", "wss://");
    } else if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      wsUrl = `ws://${wsUrl}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        this.connected = true;
        this.emit("connect");
        this.startHeartbeat();

        // Send client.join
        this.send({
          type: "client.join",
          workspace: this.options.workspace,
          joinCode: this.options.joinCode,
          user: this.options.user,
        });
      });

      this.ws.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          const res = ServerMessageSchema.safeParse(parsed);
          if (!res.success) {
            return;
          }

          const msg = res.data;
          switch (msg.type) {
            case "server.welcome":
              this.emit("welcome", msg);
              break;
            case "server.event":
              this.emit("event", msg.event);
              break;
            case "server.error":
              this.emit("error", { code: msg.code, message: msg.message });
              break;
            case "server.pong":
              break;
          }
        } catch {
          // ignore parse errors
        }
      });

      this.ws.on("close", () => {
        this.handleDisconnect("connection closed");
      });

      this.ws.on("error", (err) => {
        this.handleDisconnect(err.message);
      });
    } catch (err: any) {
      this.handleDisconnect(err.message);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendMessage(text: string, channel = "general", recipientId?: string): void {
    this.send({
      type: "client.send_message",
      text,
      channel: recipientId ? undefined : channel,
      recipientId,
    });
  }

  registerAgent(agent: {
    id: string;
    name: string;
    provider: string;
    ownerId: string;
    status: "idle" | "working" | "error" | "offline";
    currentTask?: string | null;
  }): void {
    this.send({
      type: "client.register_agent",
      agent,
    });
  }

  sendAgentStatus(
    agentId: string,
    status: "idle" | "working" | "error" | "offline",
    task?: string | null
  ): void {
    this.send({
      type: "client.agent_status",
      agentId,
      status,
      task: task || null,
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.send({
          type: "client.heartbeat",
          timestamp: new Date().toISOString(),
        });
      }
    }, 15000);
  }

  private handleDisconnect(reason?: string): void {
    if (this.connected) {
      this.connected = false;
      this.emit("disconnect", reason);
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (!this.isClosedExplicitly && this.options.autoReconnect !== false) {
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = undefined;
          this.connect();
        }, 2000);
      }
    }
  }

  disconnect(): void {
    this.isClosedExplicitly = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.ws) {
      try {
        this.send({ type: "client.leave" });
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
  }
}
