export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_online INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  socket_id TEXT,
  connected_at TEXT NOT NULL,
  disconnected_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  target_type TEXT,
  target_id TEXT,
  timestamp TEXT NOT NULL,
  payload TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  channel TEXT,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_id TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_events_workspace ON events(workspace_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id, created_at);
`;
