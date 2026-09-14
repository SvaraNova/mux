import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabase, type MuxDatabase } from "../packages/database/src/index.js";

describe("Database persistence", () => {
  let db: MuxDatabase;

  beforeEach(() => {
    // Use in-memory SQLite for clean test isolation
    db = createDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("creates and retrieves a workspace", () => {
    const ws = db.workspaces.create({
      id: "project-alpha",
      name: "Project Alpha",
      join_code: "ALPHA-99",
      created_at: new Date().toISOString(),
    });

    expect(ws.id).toBe("project-alpha");

    const fetched = db.workspaces.findById("project-alpha");
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Project Alpha");

    const byCode = db.workspaces.findByJoinCode("ALPHA-99");
    expect(byCode?.id).toBe("project-alpha");
  });

  it("manages user presence and status", () => {
    const now = new Date().toISOString();
    db.workspaces.create({
      id: "ws-1",
      name: "Workspace 1",
      join_code: "WS1-00",
      created_at: now,
    });

    db.users.upsert({
      id: "user-1",
      workspaceId: "ws-1",
      name: "Alice",
      isOnline: true,
      timestamp: now,
    });

    const online = db.users.listOnlineByWorkspace("ws-1");
    expect(online).toHaveLength(1);
    expect(online[0].name).toBe("Alice");

    db.users.setOnlineStatus("user-1", false, new Date().toISOString());
    const onlineAfter = db.users.listOnlineByWorkspace("ws-1");
    expect(onlineAfter).toHaveLength(0);
  });

  it("persists events and retrieves recent history", () => {
    const now = new Date().toISOString();
    db.workspaces.create({
      id: "ws-1",
      name: "Workspace 1",
      join_code: "WS1-00",
      created_at: now,
    });

    const event = {
      id: "evt-1",
      type: "user.joined",
      projectId: "ws-1",
      sender: {
        type: "human" as const,
        id: "user-1",
        name: "Alice",
      },
      timestamp: now,
      payload: { greeting: "hello" },
    };

    db.events.save(event);

    const recent = db.events.listRecent("ws-1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe("evt-1");
    expect(recent[0].payload.greeting).toBe("hello");
  });

  it("persists messages", () => {
    const now = new Date().toISOString();
    db.workspaces.create({
      id: "ws-1",
      name: "Workspace 1",
      join_code: "WS1-00",
      created_at: now,
    });

    db.messages.save({
      id: "msg-1",
      workspace_id: "ws-1",
      channel: "general",
      sender_id: "user-1",
      sender_name: "Alice",
      recipient_id: null,
      text: "Testing database message storage",
      created_at: now,
    });

    const messages = db.messages.listRecent("ws-1", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("Testing database message storage");
  });
});
