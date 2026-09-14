import React from "react";
import { Box, Text } from "ink";
import type { ActiveUser } from "@mux/protocol";

interface UserListProps {
  users: ActiveUser[];
  currentUserId: string;
}

export const UserList: React.FC<UserListProps> = ({ users, currentUserId }) => {
  // Deduplicate users by ID
  const uniqueUsersMap = new Map<string, ActiveUser>();
  for (const u of users) {
    // If already exists and current one is online, prefer online state
    const existing = uniqueUsersMap.get(u.id);
    if (!existing || (!existing.isOnline && u.isOnline)) {
      uniqueUsersMap.set(u.id, u);
    }
  }

  const allUnique = Array.from(uniqueUsersMap.values());
  const onlineUsers = allUnique.filter((u) => u.isOnline);
  const onlineNames = new Set(onlineUsers.map((u) => u.name.toLowerCase()));

  // Only show offline users whose name is NOT currently online, and deduplicate by name
  const seenOfflineNames = new Set<string>();
  const offlineUsers: ActiveUser[] = [];
  for (const u of allUnique) {
    const lowerName = u.name.toLowerCase();
    if (!u.isOnline && !onlineNames.has(lowerName) && !seenOfflineNames.has(lowerName)) {
      seenOfflineNames.add(lowerName);
      offlineUsers.push(u);
    }
  }

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      width={28}
      paddingX={1}
    >
      <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
        <Text bold color="yellow">
          👥 TEAM
        </Text>
        <Text color="gray">
          {onlineUsers.length} online
        </Text>
      </Box>

      {allUnique.length === 0 ? (
        <Text color="gray">Connecting...</Text>
      ) : (
        <Box flexDirection="column">
          {/* Online users */}
          {onlineUsers.map((u) => {
            const isMe = u.id === currentUserId;
            return (
              <Box key={u.id} flexDirection="column" marginBottom={u.agent ? 1 : 0}>
                <Box flexDirection="row" justifyContent="space-between">
                  <Box>
                    <Text color="green">● </Text>
                    <Text color={isMe ? "cyan" : "white"} bold={isMe}>
                      {u.name}
                    </Text>
                  </Box>
                  {isMe && <Text color="gray">(you)</Text>}
                </Box>

                {u.agent && (
                  <Box paddingLeft={2} flexDirection="row">
                    <Text color="magenta">└─ 🤖 {u.agent.provider} </Text>
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
          })}

          {/* Offline users (dimmed) */}
          {offlineUsers.length > 0 && (
            <Box flexDirection="column" marginTop={onlineUsers.length > 0 ? 1 : 0}>
              <Text color="gray">Offline ({offlineUsers.length}):</Text>
              {offlineUsers.slice(0, 3).map((u) => (
                <Box key={u.id}>
                  <Text color="gray">  ○ {u.name}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
