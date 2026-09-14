import Database from "better-sqlite3";
import type { RelayEvent } from "@mux/protocol";

export interface EventRow {
  id: string;
  workspace_id: string;
  type: string;
  sender_type: string;
  sender_id: string;
  sender_name: string | null;
  target_type: string | null;
  target_id: string | null;
  timestamp: string;
  payload: string;
}

export class EventRepository {
  constructor(private db: Database.Database) {}

  save(event: RelayEvent): void {
    const stmt = this.db.prepare(
      `INSERT INTO events (
        id, workspace_id, type, sender_type, sender_id, sender_name,
        target_type, target_id, timestamp, payload
      ) VALUES (
        @id, @workspace_id, @type, @sender_type, @sender_id, @sender_name,
        @target_type, @target_id, @timestamp, @payload
      )`
    );

    stmt.run({
      id: event.id,
      workspace_id: event.projectId,
      type: event.type,
      sender_type: event.sender.type,
      sender_id: event.sender.id,
      sender_name: event.sender.name ?? null,
      target_type: event.target?.type ?? null,
      target_id: event.target?.id ?? null,
      timestamp: event.timestamp,
      payload: JSON.stringify(event.payload ?? {}),
    });
  }

  listRecent(workspaceId: string, limit = 50): RelayEvent[] {
    const stmt = this.db.prepare<[string, number], EventRow>(
      `SELECT id, workspace_id, type, sender_type, sender_id, sender_name,
              target_type, target_id, timestamp, payload
       FROM events
       WHERE workspace_id = ?
       ORDER BY timestamp ASC
       LIMIT ?`
    );

    const rows = stmt.all(workspaceId, limit);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      projectId: row.workspace_id,
      sender: {
        type: row.sender_type as "human" | "agent" | "system",
        id: row.sender_id,
        name: row.sender_name ?? undefined,
      },
      target:
        row.target_type && row.target_id
          ? {
              type: row.target_type as "human" | "agent" | "channel",
              id: row.target_id,
            }
          : undefined,
      timestamp: row.timestamp,
      payload: JSON.parse(row.payload),
    }));
  }
}
