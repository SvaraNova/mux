import React from "react";
import { Box, Text } from "ink";
import type { AgentLogLine, AgentStatus } from "../../agent/AgyProcessAdapter.js";

interface AgentTerminalProps {
  logs: AgentLogLine[];
  status: AgentStatus;
  currentTask: string | null;
  agentName: string;
  targetDir: string;
  height?: number;
}

export const AgentTerminal: React.FC<AgentTerminalProps> = ({
  logs,
  status,
  currentTask,
  agentName,
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
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color="magenta">
            🤖 AGENT TERMINAL ({agentName})
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

      {visibleLogs.length === 0 ? (
        <Box>
          <Text color="gray">
            Agent is ready in this workspace. Type an instruction (or &gt; prompt) below to start.
          </Text>
        </Box>
      ) : (
        visibleLogs.map((log) => {
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
                <Text color="red">{log.text}</Text>
              </Box>
            );
          }
          if (log.type === "system") {
            return (
              <Box key={log.id}>
                <Text color="cyan">{log.text}</Text>
              </Box>
            );
          }
          return (
            <Box key={log.id}>
              <Text color="white">{log.text}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
