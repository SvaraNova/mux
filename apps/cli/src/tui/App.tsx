import React, { useEffect, useState, useMemo } from "react";
import { Box } from "ink";
import crypto from "node:crypto";
import type { RelayClient } from "../client/RelayClient.js";
import type { ActiveUser, RelayEvent } from "@mux/protocol";
import { Header } from "./components/Header.js";
import { UserList } from "./components/UserList.js";
import { EventStream } from "./components/EventStream.js";
import { InputBar } from "./components/InputBar.js";
import { Banner } from "./components/Banner.js";
import { AgentTerminal } from "./components/AgentTerminal.js";
import {
  AgentRegistry,
  type AgentInfo,
  type AgentLogLine,
  type AgentProvider,
  type AgentStatus,
} from "../agent/index.js";

interface AppProps {
  client: RelayClient;
  projectName: string;
  userName: string;
  userId: string;
  relayUrl: string;
  targetDir?: string;
  initialProvider?: AgentProvider;
  onExit?: () => void;
}

export const App: React.FC<AppProps> = ({
  client,
  projectName,
  userName,
  userId,
  relayUrl,
  targetDir,
  initialProvider = "agy",
  onExit,
}) => {
  const resolvedTargetDir = targetDir || process.cwd();
  const [connected, setConnected] = useState(false);
  const [joinCode, setJoinCode] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogLine[]>([]);
  const [activeProvider, setActiveProvider] = useState<AgentProvider>(initialProvider);

  const registry = useMemo(() => {
    return new AgentRegistry({
      targetDir: resolvedTargetDir,
      defaultProvider: initialProvider,
      ownerId: userId,
    });
  }, [resolvedTargetDir, initialProvider, userId]);

  const [agentList, setAgentList] = useState<AgentInfo[]>(() => registry.list());

  const activeAdapter = registry.getActive();
  const [currentStatus, setCurrentStatus] = useState<AgentStatus>(activeAdapter.status);
  const [currentTask, setCurrentTask] = useState<string | null>(activeAdapter.currentTask);

  // Sync active agent registration over LAN relay
  useEffect(() => {
    if (connected) {
      const active = registry.getActive();
      client.registerAgent({
        id: active.id,
        name: active.name,
        provider: active.provider,
        ownerId: userId,
        status: active.status,
        currentTask: active.currentTask,
      });
    }
  }, [connected, activeProvider, registry, client, userId]);

  // Hook up agent registry events
  useEffect(() => {
    const handleLog = (log: AgentLogLine) => {
      setAgentLogs((prev) => [...prev, log]);
    };

    const handleStatus = (payload: {
      status: AgentStatus;
      task: string | null;
      provider: AgentProvider;
      agentId: string;
      name: string;
    }) => {
      setAgentList(registry.list());

      if (payload.provider === registry.activeProvider) {
        setCurrentStatus(payload.status);
        setCurrentTask(payload.task);
      }

      // Notify relay server
      if (client.isConnected()) {
        client.sendAgentStatus(payload.agentId, payload.status, payload.task);
      }
    };

    const handleActiveChange = (provider: AgentProvider) => {
      setActiveProvider(provider);
      setAgentList(registry.list());
      const active = registry.getActive();
      setCurrentStatus(active.status);
      setCurrentTask(active.currentTask);

      if (client.isConnected()) {
        client.registerAgent({
          id: active.id,
          name: active.name,
          provider: active.provider,
          ownerId: userId,
          status: active.status,
          currentTask: active.currentTask,
        });
      }
    };

    registry.on("log", handleLog);
    registry.on("status", handleStatus);
    registry.on("active_change", handleActiveChange);

    return () => {
      registry.off("log", handleLog);
      registry.off("status", handleStatus);
      registry.off("active_change", handleActiveChange);
      registry.stopAll();
    };
  }, [registry, client, userId]);

  // Relay WebSocket connection and events
  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleWelcome = (welcomeMsg: any) => {
      setConnected(true);
      if (welcomeMsg.workspace?.joinCode) {
        setJoinCode(welcomeMsg.workspace.joinCode);
      }
      if (welcomeMsg.activeUsers) {
        setUsers(welcomeMsg.activeUsers);
      }
      if (welcomeMsg.recentEvents) {
        setEvents(welcomeMsg.recentEvents);
      }
    };

    const handleEvent = (event: RelayEvent) => {
      setEvents((prev) => [...prev, event]);

      if (event.type === "user.joined") {
        const newUser = event.payload?.user;
        if (newUser) {
          setUsers((prev) => {
            const filtered = prev.filter((u) => u.id !== newUser.id);
            return [
              ...filtered,
              {
                id: newUser.id,
                name: newUser.name,
                isOnline: true,
                lastSeenAt: event.timestamp,
              },
            ];
          });
        }
      } else if (event.type === "user.left") {
        const leftUserId = event.payload?.userId;
        if (leftUserId) {
          setUsers((prev) =>
            prev.map((u) => (u.id === leftUserId ? { ...u, isOnline: false } : u))
          );
        }
      } else if (event.type === "agent.registered") {
        const payload = event.payload;
        if (payload?.ownerId) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === payload.ownerId
                ? {
                    ...u,
                    agent: {
                      id: payload.agentId,
                      name: payload.name,
                      provider: payload.provider,
                      ownerId: payload.ownerId,
                      status: payload.status,
                      currentTask: payload.currentTask,
                    },
                  }
                : u
            )
          );
        }
      } else if (event.type === "agent.status") {
        const payload = event.payload;
        if (payload?.ownerId) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === payload.ownerId && u.agent
                ? {
                    ...u,
                    agent: {
                      ...u.agent,
                      status: payload.status,
                      currentTask: payload.task,
                    },
                  }
                : u
            )
          );
        }
      }
    };

    const handleError = (err: { code: string; message: string }) => {
      const errorEvent: RelayEvent = {
        id: crypto.randomUUID(),
        type: "system.event",
        projectId: projectName,
        sender: { type: "system", id: "relay" },
        timestamp: new Date().toISOString(),
        payload: {
          level: "error",
          message: `[${err.code}] ${err.message}`,
        },
      };
      setEvents((prev) => [...prev, errorEvent]);
    };

    client.on("connect", handleConnect);
    client.on("disconnect", handleDisconnect);
    client.on("welcome", handleWelcome);
    client.on("event", handleEvent);
    client.on("error", handleError);

    client.connect();

    return () => {
      client.off("connect", handleConnect);
      client.off("disconnect", handleDisconnect);
      client.off("welcome", handleWelcome);
      client.off("event", handleEvent);
      client.off("error", handleError);
    };
  }, [client, projectName]);

  const handleSubmit = (input: string) => {
    if (input.startsWith("/")) {
      const parts = input.split(" ");
      const cmd = parts[0];

      if (cmd === "/help") {
        const helpEvent: RelayEvent = {
          id: crypto.randomUUID(),
          type: "system.event",
          projectId: projectName,
          sender: { type: "system", id: "client" },
          timestamp: new Date().toISOString(),
          payload: {
            level: "info",
            message:
              "AI Agent: > <task> (active) │ > @claude <task> │ > @codex <task> │ > @agy <task> │ /agent use <provider> │ /agent list │ /clear │ /help │ /quit",
          },
        };
        setEvents((prev) => [...prev, helpEvent]);
        return;
      }

      if (cmd === "/agent" || cmd === "/ai" || cmd === "/agents") {
        const sub = parts[1];
        if (sub === "list" || cmd === "/agents") {
          const agents = registry.list();
          const listStr = agents
            .map(
              (a) =>
                `${a.isActive ? "★ " : "  "}${a.provider}: ${a.name} [${a.status}] ${
                  a.isAvailable ? "(installed)" : "(not found in PATH)"
                }`
            )
            .join(" │ ");
          const listEvent: RelayEvent = {
            id: crypto.randomUUID(),
            type: "system.event",
            projectId: projectName,
            sender: { type: "system", id: "client" },
            timestamp: new Date().toISOString(),
            payload: {
              level: "info",
              message: `Agents: ${listStr}`,
            },
          };
          setEvents((prev) => [...prev, listEvent]);
          return;
        }

        if (sub === "use" || sub === "switch") {
          const provider = parts[2]?.toLowerCase();
          if (!provider) {
            const warnEvent: RelayEvent = {
              id: crypto.randomUUID(),
              type: "system.event",
              projectId: projectName,
              sender: { type: "system", id: "client" },
              timestamp: new Date().toISOString(),
              payload: {
                level: "warn",
                message: "Usage: /agent use <agy | codex | claude>",
              },
            };
            setEvents((prev) => [...prev, warnEvent]);
            return;
          }

          const success = registry.setActive(provider);
          if (success) {
            const infoEvent: RelayEvent = {
              id: crypto.randomUUID(),
              type: "system.event",
              projectId: projectName,
              sender: { type: "system", id: "client" },
              timestamp: new Date().toISOString(),
              payload: {
                level: "info",
                message: `Switched active agent provider to "${provider}".`,
              },
            };
            setEvents((prev) => [...prev, infoEvent]);
          } else {
            const warnEvent: RelayEvent = {
              id: crypto.randomUUID(),
              type: "system.event",
              projectId: projectName,
              sender: { type: "system", id: "client" },
              timestamp: new Date().toISOString(),
              payload: {
                level: "warn",
                message: `Unknown agent provider "${provider}". Available: agy, codex, claude`,
              },
            };
            setEvents((prev) => [...prev, warnEvent]);
          }
          return;
        }

        // Direct instruction via /agent <prompt>
        const prompt = parts.slice(1).join(" ").trim();
        if (prompt) {
          const { adapter, cleanPrompt } = registry.routePrompt(prompt);
          adapter.send(cleanPrompt);
        } else {
          const warnEvent: RelayEvent = {
            id: crypto.randomUUID(),
            type: "system.event",
            projectId: projectName,
            sender: { type: "system", id: "client" },
            timestamp: new Date().toISOString(),
            payload: {
              level: "warn",
              message: "Usage: /agent <task>, /agent use <provider>, or > <task>",
            },
          };
          setEvents((prev) => [...prev, warnEvent]);
        }
        return;
      }

      if (cmd === "/clear") {
        setEvents([]);
        return;
      }

      if (cmd === "/msg") {
        const target = parts[1];
        const text = parts.slice(2).join(" ");
        if (!target || !text) {
          const warnEvent: RelayEvent = {
            id: crypto.randomUUID(),
            type: "system.event",
            projectId: projectName,
            sender: { type: "system", id: "client" },
            timestamp: new Date().toISOString(),
            payload: {
              level: "warn",
              message: "Usage: /msg @<userId> <message>",
            },
          };
          setEvents((prev) => [...prev, warnEvent]);
          return;
        }

        const recipientId = target.startsWith("@") ? target.slice(1) : target;
        client.sendMessage(text, undefined, recipientId);
        return;
      }

      // Unknown command
      const unkEvent: RelayEvent = {
        id: crypto.randomUUID(),
        type: "system.event",
        projectId: projectName,
        sender: { type: "system", id: "client" },
        timestamp: new Date().toISOString(),
        payload: {
          level: "warn",
          message: `Unknown command "${cmd}". Type /help for available commands.`,
        },
      };
      setEvents((prev) => [...prev, unkEvent]);
      return;
    }

    // Direct agent instruction via '>'
    if (input.startsWith(">")) {
      const rawPrompt = input.slice(1).trim();
      if (rawPrompt) {
        const { adapter, cleanPrompt } = registry.routePrompt(rawPrompt);
        adapter.send(cleanPrompt);
      }
      return;
    }

    // Regular channel broadcast
    client.sendMessage(input, "general");
  };

  const handleCycleAgent = () => {
    const providers: AgentProvider[] = ["agy", "codex", "claude"];
    const idx = providers.indexOf(activeProvider);
    const nextProvider = providers[(idx + 1) % providers.length];
    registry.setActive(nextProvider);
  };

  const handleQuit = () => {
    client.disconnect();
    if (onExit) onExit();
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Banner />
      <Header
        projectName={projectName}
        joinCode={joinCode}
        userName={userName}
        connected={connected}
        relayUrl={relayUrl}
      />

      <AgentTerminal
        logs={agentLogs}
        status={currentStatus}
        currentTask={currentTask}
        activeProvider={activeProvider}
        agents={agentList}
        targetDir={resolvedTargetDir}
      />

      <Box flexDirection="row" marginY={1}>
        <UserList users={users} currentUserId={userId} />
        <EventStream events={events} height={10} />
      </Box>

      <InputBar
        onSubmit={handleSubmit}
        onQuit={handleQuit}
        onCycleAgent={handleCycleAgent}
        activeProvider={activeProvider}
      />
    </Box>
  );
};
