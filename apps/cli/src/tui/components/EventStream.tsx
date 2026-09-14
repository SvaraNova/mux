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

export const EventStream: React.FC<EventStreamProps> = ({ events, height = 14 }) => {
  // Show the last N events to fit the screen
  const visibleEvents = events.slice(-height);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      minHeight={height}
    >
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          ACTIVITY & MESSAGES
        </Text>
      </Box>

      {visibleEvents.length === 0 ? (
        <Text color="gray">No activity yet. Say hello or type /help for commands.</Text>
      ) : (
        visibleEvents.map((evt) => {
          const time = formatTime(evt.timestamp);
          const senderName = evt.sender.name || evt.sender.id;

          if (evt.type === "user.joined") {
            return (
              <Box key={evt.id}>
                <Text color="gray">[{time}] </Text>
                <Text color="green" bold>
                  ● {evt.payload?.user?.name || senderName} joined the workspace
                </Text>
              </Box>
            );
          }

          if (evt.type === "user.left") {
            return (
              <Box key={evt.id}>
                <Text color="gray">[{time}] </Text>
                <Text color="red">
                  ○ {evt.payload?.name || senderName} left
                </Text>
              </Box>
            );
          }

          if (evt.type === "message.channel") {
            return (
              <Box key={evt.id}>
                <Text color="gray">[{time}] </Text>
                <Text color="blue" bold>
                  &lt;{senderName}&gt;:{" "}
                </Text>
                <Text color="white">{evt.payload?.text}</Text>
              </Box>
            );
          }

          if (evt.type === "message.direct") {
            return (
              <Box key={evt.id}>
                <Text color="gray">[{time}] </Text>
                <Text color="magenta" bold>
                  [DM] &lt;{senderName}&gt; → &lt;{evt.target?.id}&gt;:{" "}
                </Text>
                <Text color="magenta">{evt.payload?.text}</Text>
              </Box>
            );
          }

          if (evt.type === "system.event") {
            return (
              <Box key={evt.id}>
                <Text color="gray">[{time}] </Text>
                <Text color="yellow">[SYS] {evt.payload?.message}</Text>
              </Box>
            );
          }

          // Generic fallback
          return (
            <Box key={evt.id}>
              <Text color="gray">[{time}] </Text>
              <Text color="gray">[{evt.type}] </Text>
              <Text>{JSON.stringify(evt.payload)}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
