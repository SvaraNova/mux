import Database from "better-sqlite3";

export interface MessageRow {
  id: string;
  workspace_id: string;
  channel: string | null;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  text: string;
  created_at: string;
}

export class MessageRepository {
  constructor(private db: Database.Database) {}

  save(message: MessageRow): MessageRow {
    const stmt = this.db.prepare(
      `INSERT INTO messages (
        id, workspace_id, channel, sender_id, sender_name, recipient_id, text, created_at
      ) VALUES (
        @id, @workspace_id, @channel, @sender_id, @sender_name, @recipient_id, @text, @created_at
      )`
    );
    stmt.run(message);
    return message;
  }

  listRecent(workspaceId: string, limit = 50): MessageRow[] {
    const stmt = this.db.prepare<[string, number], MessageRow>(
      `SELECT id, workspace_id, channel, sender_id, sender_name, recipient_id, text, created_at
       FROM messages
       WHERE workspace_id = ?
       ORDER BY created_at ASC
       LIMIT ?`
    );
    return stmt.all(workspaceId, limit);
  }
}
