import Database from "better-sqlite3";

export interface WorkspaceRow {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
}

export class WorkspaceRepository {
  constructor(private db: Database.Database) {}

  create(workspace: WorkspaceRow): WorkspaceRow {
    const stmt = this.db.prepare(
      `INSERT INTO workspaces (id, name, join_code, created_at)
       VALUES (@id, @name, @join_code, @created_at)`
    );
    stmt.run(workspace);
    return workspace;
  }

  findById(id: string): WorkspaceRow | null {
    const stmt = this.db.prepare<[string], WorkspaceRow>(
      `SELECT id, name, join_code, created_at FROM workspaces WHERE id = ?`
    );
    return stmt.get(id) ?? null;
  }

  findByJoinCode(joinCode: string): WorkspaceRow | null {
    const stmt = this.db.prepare<[string], WorkspaceRow>(
      `SELECT id, name, join_code, created_at FROM workspaces WHERE join_code = ?`
    );
    return stmt.get(joinCode) ?? null;
  }

  list(): WorkspaceRow[] {
    const stmt = this.db.prepare<[], WorkspaceRow>(
      `SELECT id, name, join_code, created_at FROM workspaces ORDER BY created_at DESC`
    );
    return stmt.all();
  }
}
