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
  height = 9,
}) => {
  const visibleLogs = logs.slice(-height);

  let statusColor = "gray";
  let statusText = status.toUpperCase();
  if (status === "idle") {
    statusColor = "green";
  } else if (status === "working") {
    statusColor = "yellow";
    statusText = currentTask ? `WORKING: ${currentTask}` : "WORKING...";
  } else if (status === "error") {
    statusColor = "red";
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
      {/* Header bar: Title, Target Dir, and Status */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <Box>
          <Text bold color="magenta">
            🤖 MULTI-AGENT TERMINAL
          </Text>
          <Text color="gray"> │ </Text>
          <Text color="gray">dir: </Text>
          <Text color="white">{targetDir}</Text>
        </Box>
        <Box>
          <Text color={statusColor} bold>
            ● {statusText}
          </Text>
        </Box>
      </Box>

      {/* Agent Provider Selector Tabs */}
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
                color={badgeColor}
                inverse={isActive}
              >
                {` ${ag.provider}${isActive ? " (active)" : ""} `}
              </Text>
              {!ag.isAvailable && (
                <Text color="gray"> (uninstalled)</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Output Area */}
      {visibleLogs.length === 0 ? (
        <Box flexDirection="column">
          <Text color="gray">
            Multi-agent relay active. Send prompts to active agent ({activeProvider}) with &gt; &lt;task&gt;,
          </Text>
          <Text color="gray">
            or route directly to any provider: &gt; @claude &lt;task&gt; │ &gt; @codex &lt;task&gt; │ &gt; @agy &lt;task&gt;
          </Text>
        </Box>
      ) : (
        visibleLogs.map((log) => {
          const providerTag = log.provider ? `[${log.provider}] ` : "";
          if (log.type === "prompt") {
            return (
              <Box key={log.id}>
                <Text color="yellow" bold>
                  {log.text}
                </Text>
              </Box>
            );
          }
          if (log.type === "stderr") {
            return (
              <Box key={log.id}>
                <Text color="red">{providerTag}{log.text}</Text>
              </Box>
            );
          }
          if (log.type === "system") {
            return (
              <Box key={log.id}>
                <Text color="cyan">{providerTag}{log.text}</Text>
              </Box>
            );
          }
          return (
            <Box key={log.id}>
              <Text color="white">{providerTag}{log.text}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
