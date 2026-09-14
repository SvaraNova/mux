import React from "react";
import { Box, Text } from "ink";
import type { RelayEvent } from "@mux/protocol";

interface EventStreamProps {
  events: RelayEvent[];
  height?: number;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  } catch {
    return "--:--:--";
  }
}

export const EventStream: React.FC<EventStreamProps> = ({ events, height = 12 }) => {
  const visibleEvents = events.slice(-height);

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      minHeight={height}
    >
      <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
        <Box>
          <Text bold color="cyan">
            ⚡ ACTIVITY &amp; CHAT
          </Text>
        </Box>
        <Box>
          <Text color="gray">{events.length} events</Text>
        </Box>
      </Box>

      {visibleEvents.length === 0 ? (
        <Box flexDirection="column">
          <Text color="gray">Workspace is quiet. Say hello or dispatch instructions to agents!</Text>
          <Text color="gray">Shortcuts: &gt; &lt;task&gt; for AI │ Type message to chat with team</Text>
        </Box>
      ) : (
        visibleEvents.map((evt) => {
          const time = formatTime(evt.timestamp);
          const senderName = evt.sender.name || evt.sender.id;

          if (evt.type === "user.joined") {
            return (
              <Box key={evt.id} flexDirection="row">
                <Text color="gray">{time} </Text>
                <Text color="green">● </Text>
                <Text color="white" bold>{evt.payload?.user?.name || senderName}</Text>
                <Text color="gray"> joined the workspace</Text>
              </Box>
            );
          }

          if (evt.type === "user.left") {
            return (
              <Box key={evt.id} flexDirection="row">
                <Text color="gray">{time} </Text>
                <Text color="gray">○ {evt.payload?.name || senderName} left</Text>
              </Box>
            );
          }

          if (evt.type === "message.channel") {
            return (
              <Box key={evt.id} flexDirection="row">
                <Text color="gray">{time} </Text>
                <Text color="cyan" bold>{senderName} </Text>
                <Text color="gray">› </Text>
                <Text color="white">{evt.payload?.text}</Text>
              </Box>
            );
          }

          if (evt.type === "message.direct") {
            return (
              <Box key={evt.id} flexDirection="row">
                <Text color="gray">{time} </Text>
                <Text color="magenta" bold>{senderName} </Text>
                <Text color="gray">› </Text>
                <Text color="magenta">{evt.target?.id} (DM) › </Text>
                <Text color="white">{evt.payload?.text}</Text>
              </Box>
            );
          }

          if (evt.type === "agent.registered") {
            const providerName = evt.payload?.name || evt.payload?.provider || "Agent";
            const owner = evt.payload?.ownerName || senderName;
            return (
              <Box key={evt.id} flexDirection="row">
                <Text color="gray">{time} </Text>
                <Text color="magenta">🤖 </Text>
                <Text color="white" bold>{providerName}</Text>
                <Text color="gray"> linked to </Text>
                <Text color="cyan">{owner}</Text>
              </Box>
            );
          }

          if (evt.type === "agent.status") {
            const provider = evt.payload?.provider || "agent";
            const status = evt.payload?.status;
            const task = evt.payload?.task;
            const owner = evt.payload?.ownerName || senderName;

            if (status === "working") {
              return (
                <Box key={evt.id} flexDirection="row">
                  <Text color="gray">{time} </Text>
                  <Text color="yellow">⚡ </Text>
                  <Text color="yellow" bold>{provider}</Text>
                  <Text color="gray"> ({owner}): </Text>
                  <Text color="yellow">{task ? `"${task}"` : "working..."}</Text>
                </Box>
              );
            }

            if (status === "idle") {
              return (
                <Box key={evt.id} flexDirection="row">
                  <Text color="gray">{time} </Text>
                  <Text color="green">✓ </Text>
                  <Text color="green" bold>{provider}</Text>
                  <Text color="gray"> ({owner}): </Text>
                  <Text color="green">ready / completed task</Text>
                </Box>
              );
            }

            if (status === "error") {
              return (
                <Box key={evt.id} flexDirection="row">
                  <Text color="gray">{time} </Text>
                  <Text color="red">⚠ </Text>
                  <Text color="red" bold>{provider}</Text>
                  <Text color="gray"> ({owner}): </Text>
                  <Text color="red">task failed or exited with error</Text>
                </Box>
              );
            }
          }

          if (evt.type === "system.event") {
            const level = evt.payload?.level;
            const color = level === "error" ? "red" : level === "warn" ? "yellow" : "cyan";
            return (
              <Box key={evt.id} flexDirection="row">
                <Text color="gray">{time} </Text>
                <Text color={color}>ℹ </Text>
                <Text color={color}>{evt.payload?.message}</Text>
              </Box>
            );
          }

          // Fallback for any other custom event
          return (
            <Box key={evt.id} flexDirection="row">
              <Text color="gray">{time} </Text>
              <Text color="gray">[{evt.type}] </Text>
              <Text color="white">{typeof evt.payload === "string" ? evt.payload : evt.payload?.message || evt.type}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
