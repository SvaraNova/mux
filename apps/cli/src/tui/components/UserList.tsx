import React from "react";
import { Box, Text } from "ink";
import type { ActiveUser } from "@mux/protocol";

interface UserListProps {
  users: ActiveUser[];
  currentUserId: string;
}

export const UserList: React.FC<UserListProps> = ({ users, currentUserId }) => {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      flexDirection="column"
      width={28}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline color="yellow">
          TEAM & AGENTS ({users.length})
        </Text>
      </Box>
      {users.length === 0 ? (
        <Text color="gray">No users online</Text>
      ) : (
        users.map((u) => {
          const isMe = u.id === currentUserId;
          return (
            <Box key={u.id} flexDirection="column" marginBottom={u.agent ? 1 : 0}>
              <Box flexDirection="row" justifyContent="space-between">
                <Box>
                  <Text color={u.isOnline ? "green" : "gray"}>
                    {u.isOnline ? "● " : "○ "}
                  </Text>
                  <Text color={isMe ? "cyan" : "white"} bold={isMe}>
                    {u.name}
                  </Text>
                </Box>
                {isMe && <Text color="gray">(you)</Text>}
              </Box>

              {u.agent && (
                <Box paddingLeft={2} flexDirection="row">
                  <Text color="magenta">└ 🤖 {u.agent.provider} </Text>
                  <Text
                    color={
                      u.agent.status === "working"
                        ? "yellow"
                        : u.agent.status === "idle"
                        ? "green"
                        : u.agent.status === "error"
                        ? "red"
                        : "gray"
                    }
                  >
                    ({u.agent.status})
                  </Text>
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};
