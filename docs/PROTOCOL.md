# mux Collaboration Protocol Specification

## 1. Event Envelope (`RelayEvent`)

Every event flowing through `mux` conforms to the canonical envelope:

```typescript
type RelayEvent = {
  id: string;              // Unique UUIDv4
  type: string;            // e.g. "user.joined", "message.channel"
  projectId: string;       // Workspace / project identifier
  sender: {
    type: "human" | "agent" | "system";
    id: string;
    name?: string;
  };
  target?: {
    type: "human" | "agent" | "channel";
    id: string;
  };
  timestamp: string;       // ISO 8601 UTC
  payload: Record<string, any>;
};
```

## 2. Event Types (Phase 1)

### `user.joined`
Published when a user connects and joins a workspace.
```json
{
  "user": {
    "id": "user-alice-ab12",
    "name": "Alice",
    "joinedAt": "2026-09-14T15:40:00.000Z"
  }
}
```

### `user.left`
Published when a user disconnects.
```json
{
  "userId": "user-alice-ab12",
  "name": "Alice",
  "reason": "client disconnected"
}
```

### `message.channel`
Published when a teammate sends a broadcast message to a channel.
```json
{
  "channel": "general",
  "text": "Hello team!"
}
```

### `message.direct`
Published when a teammate sends a direct message to a specific user or agent.
```json
{
  "recipientId": "user-bob-cd34",
  "text": "Review PR please"
}
```

### `system.event`
Published for system notifications, warnings, or errors.
```json
{
  "level": "info",
  "message": "Relay server started on port 7331"
}
```

## 3. Client-to-Server Messages

- `client.join`: Initiates membership in a workspace.
- `client.send_message`: Dispatches a chat or direct message.
- `client.heartbeat`: Keeps the connection alive.
- `client.leave`: Notifies intentional disconnect.

## 4. Server-to-Client Messages

- `server.welcome`: Sent immediately upon joining; contains workspace metadata, online teammate list, and recent event history.
- `server.event`: Emits a new real-time `RelayEvent`.
- `server.pong`: Responds to client heartbeat.
- `server.error`: Returns machine-readable error codes and human-readable messages.
