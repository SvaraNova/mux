import React from "react";
import { Box, Text } from "ink";
import type { AgentInfo, AgentLogLine, AgentProvider, AgentStatus } from "../../agent/types.js";

interface AgentTerminalProps {
  logs: AgentLogLine[];
  status: AgentStatus;
  currentTask: string | null;
  activeProvider: AgentProvider;
  agents: AgentInfo[];
  targetDir: string;
  height?: number;
}

export const AgentTerminal: React.FC<AgentTerminalProps> = ({
  logs,
  status,
  currentTask,
  activeProvider,
  agents,
  targetDir,
  height = 10,
}) => {
  const visibleLogs = logs.slice(-height);

  let statusColor = "gray";
  let statusBadge = "IDLE";
  if (status === "idle") {
    statusColor = "green";
    statusBadge = "● IDLE";
  } else if (status === "working") {
    statusColor = "yellow";
    statusBadge = currentTask ? `⚡ WORKING: ${currentTask}` : "⚡ WORKING...";
  } else if (status === "error") {
    statusColor = "red";
    statusBadge = "⚠ ERROR";
  }

  return (
    <Box
      borderStyle="round"
      borderColor={status === "working" ? "yellow" : "cyan"}
      flexDirection="column"
      paddingX={1}
      minHeight={height}
      marginY={1}
    >
      {/* Header bar: Title, Target Dir, and Status Badge */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <Box>
          <Text bold color="cyan">
            🤖 AI AGENT TERMINAL
          </Text>
          <Text color="gray"> │ </Text>
          <Text color="gray">📂 dir: </Text>
          <Text color="white">{targetDir}</Text>
        </Box>
        <Box>
          <Text color={statusColor} bold>
            {statusBadge}
          </Text>
        </Box>
      </Box>

      {/* Provider Selector Tabs */}
      <Box flexDirection="row" marginY={1}>
        <Text color="gray">Providers: </Text>
        {agents.map((ag) => {
          const isActive = ag.provider === activeProvider;
          let badgeColor = "gray";
          if (isActive) {
            badgeColor = ag.status === "working" ? "yellow" : "cyan";
          } else if (ag.status === "working") {
            badgeColor = "yellow";
          } else if (ag.isAvailable) {
            badgeColor = "white";
          }

          return (
            <Box key={ag.provider} marginRight={1}>
              <Text
                bold={isActive}
                color={isActive ? "black" : badgeColor}
                backgroundColor={isActive ? (ag.status === "working" ? "yellow" : "cyan") : undefined}
              >
                {` ${isActive ? "★ " : ""}${ag.provider}${isActive ? " (active)" : ""} `}
              </Text>
              {!ag.isAvailable && (
                <Text color="gray"> (uninstalled)</Text>
              )}
            </Box>
          );
        })}
        <Box marginLeft={1}>
          <Text color="gray">[Tab: cycle agent]</Text>
        </Box>
      </Box>

      {/* Output / Log Area */}
      {visibleLogs.length === 0 ? (
        <Box flexDirection="column" paddingY={1}>
          <Text color="white" bold>
            ⚡ Real Interactive Agent Terminal:
          </Text>
          <Text color="gray">
            {"  "}• Run initial prompt:   <Text color="yellow">&gt; coba bikin web app to do list sederhana</Text>
          </Text>
          <Text color="gray">
            {"  "}• Target provider:       <Text color="yellow">&gt; @claude review PR</Text>  │  <Text color="yellow">&gt; @codex write tests</Text>
          </Text>
          <Text color="gray">
            {"  "}• Open shell directly:   <Text color="cyan">&lt;Ctrl+O&gt;</Text> or type <Text color="cyan">/term</Text> (press <Text color="cyan">&lt;Tab&gt;</Text> to cycle agent)
          </Text>
        </Box>
      ) : (
        visibleLogs.map((log) => {
          const providerTag = log.provider ? `[${log.provider}] ` : "";
          if (log.type === "prompt") {
            return (
              <Box key={log.id} flexDirection="row">
                <Text color="yellow" bold>
                  ❯ {providerTag}{log.text.replace(/^\[.*?\]\s*>\s*/, "")}
                </Text>
              </Box>
            );
          }
          if (log.type === "stderr") {
            return (
              <Box key={log.id} flexDirection="row">
                <Text color="red">│ ⚠ {providerTag}{log.text}</Text>
              </Box>
            );
          }
          if (log.type === "system") {
            const isSuccess = log.text.startsWith("✓");
            const isError = log.text.startsWith("⚠") || log.text.includes("Failed") || log.text.includes("Error");
            const sysColor = isSuccess ? "green" : isError ? "red" : "cyan";
            return (
              <Box key={log.id} flexDirection="row">
                <Text color={sysColor}>{log.text}</Text>
              </Box>
            );
          }
          return (
            <Box key={log.id} flexDirection="row">
              <Text color="gray">│ </Text>
              <Text color="white">{log.text}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
