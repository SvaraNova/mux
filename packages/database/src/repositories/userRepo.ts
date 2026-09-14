import Database from "better-sqlite3";

export interface UserRow {
  id: string;
  workspace_id: string;
  name: string;
  is_online: number;
  last_seen_at: string;
  created_at: string;
}

export class UserRepository {
  constructor(private db: Database.Database) {}

  upsert(user: { id: string; workspaceId: string; name: string; isOnline: boolean; timestamp: string }): UserRow {
    const stmt = this.db.prepare(
      `INSERT INTO users (id, workspace_id, name, is_online, last_seen_at, created_at)
       VALUES (@id, @workspace_id, @name, @is_online, @last_seen_at, @created_at)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         is_online = excluded.is_online,
         last_seen_at = excluded.last_seen_at`
    );

    stmt.run({
      id: user.id,
      workspace_id: user.workspaceId,
      name: user.name,
      is_online: user.isOnline ? 1 : 0,
      last_seen_at: user.timestamp,
      created_at: user.timestamp,
    });

    return this.findById(user.id)!;
  }

  setOnlineStatus(id: string, isOnline: boolean, timestamp: string): void {
    const stmt = this.db.prepare(
      `UPDATE users SET is_online = ?, last_seen_at = ? WHERE id = ?`
    );
    stmt.run(isOnline ? 1 : 0, timestamp, id);
  }

  findById(id: string): UserRow | null {
    const stmt = this.db.prepare<[string], UserRow>(
      `SELECT id, workspace_id, name, is_online, last_seen_at, created_at FROM users WHERE id = ?`
    );
    return stmt.get(id) ?? null;
  }

  listByWorkspace(workspaceId: string): UserRow[] {
    const stmt = this.db.prepare<[string], UserRow>(
      `SELECT id, workspace_id, name, is_online, last_seen_at, created_at
       FROM users WHERE workspace_id = ? ORDER BY name ASC`
    );
    return stmt.all(workspaceId);
  }

  listOnlineByWorkspace(workspaceId: string): UserRow[] {
    const stmt = this.db.prepare<[string], UserRow>(
      `SELECT id, workspace_id, name, is_online, last_seen_at, created_at
       FROM users WHERE workspace_id = ? AND is_online = 1 ORDER BY name ASC`
    );
    return stmt.all(workspaceId);
  }
}
