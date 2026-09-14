import Database from "better-sqlite3";

export interface AgentRow {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  provider: string;
  status: string;
  current_task: string | null;
  last_active_at: string;
}

export class AgentRepository {
  constructor(private db: Database.Database) {}

  upsert(agent: {
    id: string;
    workspaceId: string;
    userId: string;
    name: string;
    provider: string;
    status: string;
    currentTask?: string | null;
    timestamp: string;
  }): AgentRow {
    const stmt = this.db.prepare(
      `INSERT INTO agents (id, workspace_id, user_id, name, provider, status, current_task, last_active_at)
       VALUES (@id, @workspace_id, @user_id, @name, @provider, @status, @current_task, @last_active_at)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         provider = excluded.provider,
         status = excluded.status,
         current_task = excluded.current_task,
         last_active_at = excluded.last_active_at`
    );

    stmt.run({
      id: agent.id,
      workspace_id: agent.workspaceId,
      user_id: agent.userId,
      name: agent.name,
      provider: agent.provider,
      status: agent.status,
      current_task: agent.currentTask || null,
      last_active_at: agent.timestamp,
    });

    return this.findById(agent.id)!;
  }

  updateStatus(id: string, status: string, task?: string | null, timestamp = new Date().toISOString()): void {
    const stmt = this.db.prepare(
      `UPDATE agents SET status = ?, current_task = ?, last_active_at = ? WHERE id = ?`
    );
    stmt.run(status, task || null, timestamp, id);
  }

  findById(id: string): AgentRow | null {
    const stmt = this.db.prepare<[string], AgentRow>(
      `SELECT id, workspace_id, user_id, name, provider, status, current_task, last_active_at FROM agents WHERE id = ?`
    );
    return stmt.get(id) ?? null;
  }

  findByUserId(userId: string): AgentRow | null {
    const stmt = this.db.prepare<[string], AgentRow>(
      `SELECT id, workspace_id, user_id, name, provider, status, current_task, last_active_at FROM agents WHERE user_id = ?`
    );
    return stmt.get(userId) ?? null;
  }

  listByWorkspace(workspaceId: string): AgentRow[] {
    const stmt = this.db.prepare<[string], AgentRow>(
      `SELECT id, workspace_id, user_id, name, provider, status, current_task, last_active_at
       FROM agents WHERE workspace_id = ? ORDER BY name ASC`
    );
    return stmt.all(workspaceId);
  }
}
