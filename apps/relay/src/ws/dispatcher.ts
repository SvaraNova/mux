import crypto from "node:crypto";
import {
  ClientMessageSchema,
  type ClientMessage,
  type ServerMessage,
  type RelayEvent,
} from "@mux/protocol";
import type { MuxDatabase } from "@mux/database";
import type { ConnectionManager, ClientConnection } from "./connectionManager.js";

export class EventDispatcher {
  constructor(
    private db: MuxDatabase,
    private connections: ConnectionManager
  ) {}

  handleMessage(conn: ClientConnection, rawData: string | Buffer): void {
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData.toString());
      } catch {
        this.sendError(conn, "INVALID_JSON", "Payload is not valid JSON");
        return;
      }

      const result = ClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        console.error("Relay dispatcher validation error:", result.error.issues);
        this.sendError(
          conn,
          "INVALID_MESSAGE",
          `Schema validation error: ${result.error.issues.map((i) => i.message).join(", ")}`
        );
        return;
      }

      const message = result.data;
      switch (message.type) {
        case "client.join":
          this.handleJoin(conn, message);
          break;
        case "client.send_message":
          this.handleSendMessage(conn, message);
          break;
        case "client.heartbeat":
          this.handleHeartbeat(conn, message);
          break;
        case "client.leave":
          this.handleLeave(conn, message.reason);
          break;
        case "client.register_agent":
          this.handleRegisterAgent(conn, message);
          break;
        case "client.agent_status":
          this.handleAgentStatus(conn, message);
          break;
      }
    } catch (err: any) {
      console.error("Error in dispatcher.handleMessage:", err);
    }
  }

  private handleJoin(
    conn: ClientConnection,
    message: Extract<ClientMessage, { type: "client.join" }>
  ): void {
    const timestamp = new Date().toISOString();
    let workspace = this.db.workspaces.findById(message.workspace);

    if (!workspace) {
      // Find by join code if provided or matches name
      workspace = this.db.workspaces.findByJoinCode(message.workspace);
    }

    if (!workspace) {
      // Auto-create workspace if not existing yet (LAN local convenience)
      const joinCode =
        message.joinCode ||
        `${message.workspace.toUpperCase().slice(0, 4)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      workspace = this.db.workspaces.create({
        id: message.workspace,
        name: message.workspace,
        join_code: joinCode,
        created_at: timestamp,
      });
    }

    // Upsert user in workspace
    this.db.users.upsert({
      id: message.user.id,
      workspaceId: workspace.id,
      name: message.user.name,
      isOnline: true,
      timestamp,
    });

    // Associate connection
    this.connections.associateUser(conn.socketId, workspace.id, message.user.id, message.user.name);

    // List active users
    const allUsers = this.db.users.listByWorkspace(workspace.id);
    const activeUsers = allUsers.map((u) => {
      const agentRow = this.db.agents.findByUserId(u.id);
      return {
        id: u.id,
        name: u.name,
        isOnline: u.is_online === 1,
        lastSeenAt: u.last_seen_at,
        agent: agentRow
          ? {
              id: agentRow.id,
              name: agentRow.name,
              provider: agentRow.provider,
              ownerId: agentRow.user_id,
              status: agentRow.status as "idle" | "working" | "error" | "offline",
              currentTask: agentRow.current_task,
            }
          : undefined,
      };
    });

    // List recent events
    const recentEvents = this.db.events.listRecent(workspace.id, 50);

    // Send welcome to this client
    const welcomeMsg: ServerMessage = {
      type: "server.welcome",
      workspace: {
        id: workspace.id,
        name: workspace.name,
        joinCode: workspace.join_code,
      },
      user: {
        id: message.user.id,
        name: message.user.name,
      },
      activeUsers,
      recentEvents,
    };
    this.connections.send(conn, welcomeMsg);

    // Create user.joined event
    const joinEvent: RelayEvent = {
      id: crypto.randomUUID(),
      type: "user.joined",
      projectId: workspace.id,
      sender: {
        type: "human",
        id: message.user.id,
        name: message.user.name,
      },
      timestamp,
      payload: {
        user: {
          id: message.user.id,
          name: message.user.name,
          joinedAt: timestamp,
        },
      },
    };

    // Save to DB and broadcast to other clients in workspace
    this.db.events.save(joinEvent);
    this.connections.broadcastToWorkspace(
      workspace.id,
      { type: "server.event", event: joinEvent },
      conn.socketId
    );
  }

  private handleSendMessage(
    conn: ClientConnection,
    message: Extract<ClientMessage, { type: "client.send_message" }>
  ): void {
    if (!conn.workspaceId || !conn.userId || !conn.userName) {
      this.sendError(conn, "UNAUTHENTICATED", "Must join a workspace before sending messages");
      return;
    }

    const timestamp = new Date().toISOString();
    const eventId = crypto.randomUUID();

    // Check if direct or channel message
    const isDirect = !!message.recipientId;
    const eventType = isDirect ? "message.direct" : "message.channel";

    const event: RelayEvent = {
      id: eventId,
      type: eventType,
      projectId: conn.workspaceId,
      sender: {
        type: "human",
        id: conn.userId,
        name: conn.userName,
      },
      target: isDirect
        ? { type: "human", id: message.recipientId! }
        : { type: "channel", id: message.channel || "general" },
      timestamp,
      payload: isDirect
        ? {
            recipientId: message.recipientId!,
            text: message.text,
          }
        : {
            channel: message.channel || "general",
            text: message.text,
          },
    };

    // Save message & event to database
    this.db.messages.save({
      id: eventId,
      workspace_id: conn.workspaceId,
      channel: isDirect ? null : message.channel || "general",
      sender_id: conn.userId,
      sender_name: conn.userName,
      recipient_id: isDirect ? message.recipientId! : null,
      text: message.text,
      created_at: timestamp,
    });

    this.db.events.save(event);

    // Broadcast to everyone in workspace (including sender so UI gets confirmation event)
    this.connections.broadcastToWorkspace(conn.workspaceId, {
      type: "server.event",
      event,
    });
  }

  private handleHeartbeat(
    conn: ClientConnection,
    _message: Extract<ClientMessage, { type: "client.heartbeat" }>
  ): void {
    this.connections.send(conn, {
      type: "server.pong",
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(conn: ClientConnection): void {
    this.handleLeave(conn, "disconnect");
  }

  private handleLeave(conn: ClientConnection, reason?: string): void {
    if (!conn.workspaceId || !conn.userId || !conn.userName) {
      return;
    }

    const timestamp = new Date().toISOString();
    this.db.users.setOnlineStatus(conn.userId, false, timestamp);

    const leaveEvent: RelayEvent = {
      id: crypto.randomUUID(),
      type: "user.left",
      projectId: conn.workspaceId,
      sender: {
        type: "human",
        id: conn.userId,
        name: conn.userName,
      },
      timestamp,
      payload: {
        userId: conn.userId,
        name: conn.userName,
        reason: reason || "client left",
      },
    };

    this.db.events.save(leaveEvent);
    this.connections.broadcastToWorkspace(
      conn.workspaceId,
      { type: "server.event", event: leaveEvent },
      conn.socketId
    );
  }

  private handleRegisterAgent(
    conn: ClientConnection,
    message: Extract<ClientMessage, { type: "client.register_agent" }>
  ): void {
    if (!conn.workspaceId || !conn.userId) {
      this.sendError(conn, "UNAUTHENTICATED", "Must join a workspace before registering an agent");
      return;
    }

    const timestamp = new Date().toISOString();
    this.db.agents.upsert({
      id: message.agent.id,
      workspaceId: conn.workspaceId,
      userId: conn.userId,
      name: message.agent.name,
      provider: message.agent.provider,
      status: message.agent.status,
      currentTask: message.agent.currentTask || null,
      timestamp,
    });

    const agentEvent: RelayEvent = {
      id: crypto.randomUUID(),
      type: "agent.registered",
      projectId: conn.workspaceId,
      sender: {
        type: "agent",
        id: message.agent.id,
        name: message.agent.name,
      },
      timestamp,
      payload: {
        agentId: message.agent.id,
        name: message.agent.name,
        provider: message.agent.provider,
        ownerId: conn.userId,
        status: message.agent.status,
        currentTask: message.agent.currentTask || null,
      },
    };

    this.db.events.save(agentEvent);
    this.connections.broadcastToWorkspace(conn.workspaceId, {
      type: "server.event",
      event: agentEvent,
    });
  }

  private handleAgentStatus(
    conn: ClientConnection,
    message: Extract<ClientMessage, { type: "client.agent_status" }>
  ): void {
    if (!conn.workspaceId || !conn.userId) {
      this.sendError(conn, "UNAUTHENTICATED", "Must join a workspace before updating agent status");
      return;
    }

    const timestamp = new Date().toISOString();
    this.db.agents.updateStatus(message.agentId, message.status, message.task || null, timestamp);

    const agent = this.db.agents.findById(message.agentId);

    const statusEvent: RelayEvent = {
      id: crypto.randomUUID(),
      type: "agent.status",
      projectId: conn.workspaceId,
      sender: {
        type: "agent",
        id: message.agentId,
        name: agent ? agent.name : message.agentId,
      },
      timestamp,
      payload: {
        agentId: message.agentId,
        name: agent ? agent.name : message.agentId,
        provider: agent ? agent.provider : "unknown",
        ownerId: conn.userId,
        status: message.status,
        task: message.task || null,
      },
    };

    this.db.events.save(statusEvent);
    this.connections.broadcastToWorkspace(conn.workspaceId, {
      type: "server.event",
      event: statusEvent,
    });
  }

  private sendError(conn: ClientConnection, code: string, message: string): void {
    this.connections.send(conn, {
      type: "server.error",
      code,
      message,
    });
  }
}
