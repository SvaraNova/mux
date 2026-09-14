import readline from "node:readline";
import { RelayClient } from "../client/RelayClient.js";
import type { ActiveUser, RelayEvent } from "@mux/protocol";

export interface TeamMcpServerOptions {
  relayUrl?: string;
  workspace?: string;
  agentName?: string;
  agentProvider?: string;
  userName?: string;
}

export class TeamMcpServer {
  private client: RelayClient | null = null;
  private relayUrl: string;
  private workspace: string;
  private agentName: string;
  private agentProvider: string;
  private userName: string;
  private isConnected = false;
  private activeUsers: ActiveUser[] = [];
  private recentEvents: RelayEvent[] = [];
  private pendingReplies = new Map<string, (reply: string) => void>();
  private incomingQuestions = new Map<string, { requestId: string; fromAgentName: string; fromAgentId: string; question: string; timestamp: string }>();

  constructor(options: TeamMcpServerOptions = {}) {
    this.relayUrl = options.relayUrl || process.env.MUX_RELAY_URL || "ws://127.0.0.1:7331";
    this.workspace = options.workspace || process.env.MUX_WORKSPACE || "default";
    this.agentName = options.agentName || process.env.MUX_AGENT_NAME || "Local Agent";
    this.agentProvider = options.agentProvider || process.env.MUX_AGENT_PROVIDER || "agy";
    this.userName = options.userName || process.env.USER || "developer";
  }

  public async start(): Promise<void> {
    this.connectRelay();
    this.listenStdio();
  }

  private connectRelay(): void {
    const userId = `agent-${this.agentProvider}-${this.userName.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
    this.client = new RelayClient({
      url: this.relayUrl,
      workspace: this.workspace,
      user: {
        id: userId,
        name: `${this.userName}'s ${this.agentName}`,
      },
      autoReconnect: true,
    });

    this.client.on("welcome", (msg) => {
      this.isConnected = true;
      if (msg.activeUsers) this.activeUsers = msg.activeUsers;
      if (msg.recentEvents) {
        this.recentEvents = msg.recentEvents;
        for (const evt of msg.recentEvents) {
          if (evt.type === "agent.ask" && evt.payload?.requestId) {
            this.incomingQuestions.set(evt.payload.requestId, {
              requestId: evt.payload.requestId,
              fromAgentName: evt.payload.fromAgentName || evt.sender.name,
              fromAgentId: evt.payload.fromAgentId || evt.sender.id,
              question: evt.payload.question,
              timestamp: evt.timestamp,
            });
          }
        }
      }

      // Register agent
      this.client?.registerAgent({
        id: userId,
        name: this.agentName,
        provider: this.agentProvider,
        ownerId: userId,
        status: "idle",
        currentTask: null,
      });
    });

    this.client.on("event", (evt) => {
      this.recentEvents.push(evt);
      if (this.recentEvents.length > 50) this.recentEvents.shift();

      if (evt.type === "agent.ask" && evt.payload?.requestId) {
        this.incomingQuestions.set(evt.payload.requestId, {
          requestId: evt.payload.requestId,
          fromAgentName: evt.payload.fromAgentName || evt.sender.name,
          fromAgentId: evt.payload.fromAgentId || evt.sender.id,
          question: evt.payload.question,
          timestamp: evt.timestamp,
        });
      }

      if (evt.type === "agent.reply") {
        const reqId = evt.payload?.requestId;
        if (reqId) {
          this.incomingQuestions.delete(reqId);
          if (this.pendingReplies.has(reqId)) {
            const resolver = this.pendingReplies.get(reqId)!;
            this.pendingReplies.delete(reqId);
            resolver(evt.payload?.reply || "No reply content");
          }
        }
      }
    });

    this.client.connect();
  }

  private listenStdio(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed);
        const response = await this.handleJsonRpc(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch (err: any) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: `Parse error: ${err.message}` },
          }) + "\n"
        );
      }
    });
  }

  private async handleJsonRpc(req: any): Promise<any> {
    const { id, method, params } = req;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "mux-team-mcp",
              version: "0.1.0",
            },
            capabilities: {
              tools: {},
            },
          },
        };

      case "notifications/initialized":
        return null;

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "team_send_message",
                description:
                  "Send a message or code update to the shared multiplayer workspace channel or directly to a teammate.",
                inputSchema: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "The text message, status update, or question to send to the team.",
                    },
                    recipient: {
                      type: "string",
                      description: "Optional recipient ID/username for private direct messaging.",
                    },
                  },
                  required: ["text"],
                },
              },
              {
                name: "team_ask_agent",
                description:
                  "Ask an AI coding agent running on a teammate's computer across the local network (LAN) a question, and wait for its response.",
                inputSchema: {
                  type: "object",
                  properties: {
                    agent_name: {
                      type: "string",
                      description: "Name or provider of the target agent (e.g. 'claude', 'codex', 'agy').",
                    },
                    question: {
                      type: "string",
                      description: "The specific question or code clarification to ask the teammate's agent.",
                    },
                    timeout_seconds: {
                      type: "number",
                      description: "Optional timeout in seconds to wait for reply (default: 30).",
                    },
                  },
                  required: ["agent_name", "question"],
                },
              },
              {
                name: "team_broadcast_status",
                description:
                  "Notify the collaborative workspace about what task you are currently working on or when you have finished.",
                inputSchema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["working", "idle"],
                      description: "Your current agent status.",
                    },
                    task: {
                      type: "string",
                      description: "Brief description of the task being executed.",
                    },
                  },
                  required: ["status"],
                },
              },
              {
                name: "team_get_context",
                description:
                  "Retrieve real-time context of the multiplayer workspace: who is online, which agents are working, and recent team messages.",
                inputSchema: {
                  type: "object",
                  properties: {},
                },
              },
              {
                name: "team_claim_task",
                description:
                  "Claim a task and declare files you are working on to prevent merge conflicts with other agents.",
                inputSchema: {
                  type: "object",
                  properties: {
                    task_name: {
                      type: "string",
                      description: "The name of the feature or task you are claiming.",
                    },
                    files: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of file paths you intend to edit.",
                    },
                  },
                  required: ["task_name"],
                },
              },
              {
                name: "team_reply_agent",
                description:
                  "Reply to a question asked by another teammate or teammate's AI agent across the LAN workspace.",
                inputSchema: {
                  type: "object",
                  properties: {
                    request_id: {
                      type: "string",
                      description: "The request ID of the question you are replying to.",
                    },
                    reply: {
                      type: "string",
                      description: "Your answer, explanation, or code clarification.",
                    },
                    to_agent_id: {
                      type: "string",
                      description: "Optional recipient agent or user ID.",
                    },
                  },
                  required: ["request_id", "reply"],
                },
              },
            ],
          },
        };

      case "tools/call": {
        const { name, arguments: args } = params || {};
        try {
          const content = await this.executeTool(name, args);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
                },
              ],
            },
          };
        } catch (err: any) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32000,
              message: `Tool execution failed: ${err.message}`,
            },
          };
        }
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method '${method}' not found`,
          },
        };
    }
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    if (!this.client) {
      throw new Error("Relay client is not initialized.");
    }

    switch (toolName) {
      case "team_send_message": {
        const { text, recipient } = args || {};
        if (!text) throw new Error("Missing 'text' argument");
        this.client.sendMessage(text, undefined, recipient);
        return `Message successfully sent to ${recipient ? `@${recipient}` : "#general"}`;
      }

      case "team_broadcast_status": {
        const { status, task } = args || {};
        const userId = this.client.options.user.id;
        this.client.sendAgentStatus(userId, status, task);
        return `Status updated to '${status}'${task ? ` (Task: ${task})` : ""}`;
      }

      case "team_get_context": {
        const onlineUsers = this.activeUsers.filter((u) => u.isOnline);
        const recentChats = this.recentEvents
          .filter((e) => e.type === "message.channel" || e.type === "agent.status" || e.type === "agent.ask" || e.type === "agent.reply")
          .slice(-10)
          .map((e) => ({
            time: e.timestamp,
            sender: e.sender.name,
            type: e.type,
            details: e.payload,
          }));

        return {
          workspace: this.workspace,
          relayUrl: this.relayUrl,
          onlineTeammates: onlineUsers.map((u) => ({
            name: u.name,
            agent: u.agent ? `${u.agent.provider} (${u.agent.status})` : "none",
          })),
          pendingQuestions: Array.from(this.incomingQuestions.values()),
          recentActivity: recentChats,
        };
      }

      case "team_claim_task": {
        const { task_name, files = [] } = args || {};
        const announceText = `📌 [Task Claimed] "${task_name}" by ${this.agentName}${
          files.length > 0 ? ` (Files: ${files.join(", ")})` : ""
        }`;
        this.client.sendMessage(announceText, "general");
        const userId = this.client.options.user.id;
        this.client.sendAgentStatus(userId, "working", task_name);
        return `Successfully claimed task "${task_name}" and announced to team.`;
      }

      case "team_reply_agent": {
        const { request_id, reply, to_agent_id } = args || {};
        if (!request_id || !reply) throw new Error("Missing request_id or reply");

        this.client.agentReply(to_agent_id, reply, request_id);
        this.incomingQuestions.delete(request_id);
        return `Reply successfully sent for request ${request_id}.`;
      }

      case "team_ask_agent": {
        const { agent_name, question, timeout_seconds = 30 } = args || {};
        if (!agent_name || !question) throw new Error("Missing agent_name or question");

        const reqId = this.client.agentAsk(agent_name, question);

        // Await reply with timeout
        const timeoutMs = timeout_seconds * 1000;
        return new Promise<string>((resolve) => {
          const timer = setTimeout(() => {
            if (this.pendingReplies.has(reqId)) {
              this.pendingReplies.delete(reqId);
              resolve(
                `Question was broadcast to ${agent_name} on the team relay, but response timed out after ${timeout_seconds}s. The request remains visible in workspace activity stream.`
              );
            }
          }, timeoutMs);

          this.pendingReplies.set(reqId, (reply) => {
            clearTimeout(timer);
            resolve(`Reply from ${agent_name}: ${reply}`);
          });
        });
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  public close(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }
}
