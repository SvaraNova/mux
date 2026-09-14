import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
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
  AgyProcessAdapter,
  type AgentLogLine,
  type AgentStatus,
} from "../agent/AgyProcessAdapter.js";

interface AppProps {
  client: RelayClient;
  projectName: string;
  userName: string;
  userId: string;
  relayUrl: string;
  targetDir?: string;
  onExit?: () => void;
}

export const App: React.FC<AppProps> = ({
  client,
  projectName,
  userName,
  userId,
  relayUrl,
  targetDir,
  onExit,
}) => {
  const resolvedTargetDir = targetDir || process.cwd();
  const [connected, setConnected] = useState(false);
  const [joinCode, setJoinCode] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogLine[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [agentAdapter] = useState(
    () => new AgyProcessAdapter({ targetDir: resolvedTargetDir })
  );

  useEffect(() => {
    const handleLog = (log: AgentLogLine) => {
      setAgentLogs((prev) => [...prev, log]);
    };

    const handleAgentStatus = ({
      status,
      task,
    }: {
      status: AgentStatus;
      task: string | null;
    }) => {
      setAgentStatus(status);
      setCurrentTask(task);
      if (status === "working" && task) {
        client.sendMessage(`🤖 [agy is working on]: ${task}`, "general");
      } else if (status === "idle") {
        client.sendMessage(`🤖 [agy finished task]`, "general");
      }
    };

    agentAdapter.on("log", handleLog);
    agentAdapter.on("status", handleAgentStatus);

    return () => {
      agentAdapter.off("log", handleLog);
      agentAdapter.off("status", handleAgentStatus);
      agentAdapter.stop();
    };
  }, [agentAdapter, client]);

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
              "AI Agent: > <prompt> (e.g. > check repo) │ Team Chat: <message> or /msg @<user> <text> │ System: /clear, /help, /quit",
          },
        };
        setEvents((prev) => [...prev, helpEvent]);
        return;
      }

      if (cmd === "/agent" || cmd === "/ai") {
        const prompt = parts.slice(1).join(" ").trim();
        if (prompt) {
          agentAdapter.send(prompt);
        } else {
          const warnEvent: RelayEvent = {
            id: crypto.randomUUID(),
            type: "system.event",
            projectId: projectName,
            sender: { type: "system", id: "client" },
            timestamp: new Date().toISOString(),
            payload: {
              level: "warn",
              message: "Usage: /agent <instruction> or > <instruction>",
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
      const prompt = input.slice(1).trim();
      if (prompt) {
        agentAdapter.send(prompt);
      }
      return;
    }

    // Regular channel broadcast
    client.sendMessage(input, "general");
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
        status={agentStatus}
        currentTask={currentTask}
        agentName="agy"
        targetDir={resolvedTargetDir}
      />

      <Box flexDirection="row" marginY={1}>
        <UserList users={users} currentUserId={userId} />
        <EventStream events={events} height={10} />
      </Box>

      <InputBar onSubmit={handleSubmit} onQuit={handleQuit} />
    </Box>
  );
};
