import React from "react";
import { Box, Text } from "ink";

export const BANNER_TEXT = `
 ███╗   ███╗██╗   ██╗██╗  ██╗
 ████╗ ████║██║   ██║╚██╗██╔╝
 ██╔████╔██║██║   ██║ ╚███╔╝ 
 ██║╚██╔╝██║██║   ██║ ██╔██╗ 
 ██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗
 ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝
`.trim();

export const Banner: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        {BANNER_TEXT}
      </Text>
      <Box flexDirection="row" marginTop={0}>
        <Text color="gray">  The Multiplayer Terminal for </Text>
        <Text color="yellow" bold>
          Humans
        </Text>
        <Text color="gray"> &amp; </Text>
        <Text color="magenta" bold>
          Coding Agents
        </Text>
        <Text color="gray"> │ LAN Realtime Relay</Text>
      </Box>
    </Box>
  );
};
