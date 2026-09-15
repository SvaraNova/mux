import React from "react";
import { Box, Text } from "ink";

export interface ChannelItem {
  name: string;
  unread: number;
}

interface ChannelListProps {
  channels: ChannelItem[];
  activeChannel: string;
  onSwitch?: (channel: string) => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  activeChannel,
}) => {
  // Always ensure #general is first
  const sorted = [...channels].sort((a, b) => {
    if (a.name === "general") return -1;
    if (b.name === "general") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingX={1}
      minWidth={18}
      flexShrink={0}
    >
      <Text bold color="cyan">
        # CHANNELS
      </Text>
      <Box marginTop={1} flexDirection="column">
        {sorted.map((ch) => {
          const isActive = ch.name === activeChannel;
          return (
            <Box key={ch.name} flexDirection="row">
              <Text color={isActive ? "cyan" : "gray"}>
                {isActive ? "▶ " : "  "}
              </Text>
              <Text color={isActive ? "white" : "gray"} bold={isActive}>
                #{ch.name}
              </Text>
              {ch.unread > 0 && (
                <Text color="yellow" bold>
                  {" "}
                  {ch.unread}
                </Text>
              )}
            </Box>
          );
        })}
        {sorted.length === 0 && (
          <Text color="gray">#general</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          /ch &lt;name&gt;
        </Text>
      </Box>
    </Box>
  );
};
