import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  projectName: string;
  joinCode?: string;
  userName: string;
  connected: boolean;
  relayUrl: string;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  joinCode,
  userName,
  connected,
  relayUrl,
}) => {
  return (
    <Box
      borderStyle="round"
      borderColor={connected ? "green" : "red"}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box>
        <Text bold color="cyan">
          mux
        </Text>
        <Text> │ </Text>
        <Text color="yellow">PROJECT: </Text>
        <Text bold>{projectName.toUpperCase()}</Text>
        {joinCode && (
          <>
            <Text color="gray"> (CODE: </Text>
            <Text color="magenta" bold>
              {joinCode}
            </Text>
            <Text color="gray">)</Text>
          </>
        )}
      </Box>
      <Box>
        <Text color="gray">User: </Text>
        <Text bold color="blue">
          {userName}
        </Text>
        <Text> │ </Text>
        <Text color={connected ? "green" : "red"}>
          {connected ? "● CONNECTED" : "○ DISCONNECTED"}
        </Text>
        <Text color="gray"> ({relayUrl})</Text>
      </Box>
    </Box>
  );
};
