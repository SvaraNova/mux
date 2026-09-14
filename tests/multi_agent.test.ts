import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabase, type MuxDatabase } from "../packages/database/src/index.js";
import {
  AgentRegistry,
  AgyAdapter,
  CodexAdapter,
  ClaudeAdapter,
} from "../apps/cli/src/agent/index.js";

describe("Multi-Agent Architecture & Registry", () => {
  let db: MuxDatabase;
  const tempDir = ".";

  beforeEach(() => {
    db = createDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("persists and updates agents in AgentRepository", () => {
    const ws = db.workspaces.create({
      id: "ws-test",
      name: "Test Workspace",
      join_code: "TEST-1234",
      created_at: new Date().toISOString(),
    });

    const user = db.users.upsert({
      id: "u-1",
      workspaceId: ws.id,
      name: "Alice",
      isOnline: true,
    });

    // Upsert agent
    const agent = db.agents.upsert({
      id: "ag-claude-1",
      workspaceId: ws.id,
      userId: user.id,
      name: "Claude Code",
      provider: "claude",
      status: "idle",
      currentTask: null,
      timestamp: new Date().toISOString(),
    });

    expect(agent.id).toBe("ag-claude-1");
    expect(agent.provider).toBe("claude");
    expect(agent.status).toBe("idle");

    // Update status to working
    db.agents.updateStatus("ag-claude-1", "working", "Refactoring database module");
    const updated = db.agents.findById("ag-claude-1");
    expect(updated?.status).toBe("working");
    expect(updated?.current_task).toBe("Refactoring database module");

    // Find by user
    const byUser = db.agents.findByUserId(user.id);
    expect(byUser?.id).toBe("ag-claude-1");

    // List by workspace
    const list = db.agents.listByWorkspace(ws.id);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("ag-claude-1");
  });

  it("initializes AgentRegistry with agy, codex, and claude", () => {
    const registry = new AgentRegistry({
      targetDir: tempDir,
      defaultProvider: "agy",
      ownerId: "user-test",
    });

    expect(registry.activeProvider).toBe("agy");
    const list = registry.list();
    expect(list.map((a) => a.provider)).toEqual(["agy", "codex", "claude"]);

    const active = registry.getActive();
    expect(active.provider).toBe("agy");
  });

  it("switches active provider dynamically", () => {
    const registry = new AgentRegistry({
      targetDir: tempDir,
      defaultProvider: "agy",
    });

    let activeEventReceived = "";
    registry.on("active_change", (p) => {
      activeEventReceived = p;
    });

    const ok = registry.setActive("claude");
    expect(ok).toBe(true);
    expect(registry.activeProvider).toBe("claude");
    expect(registry.getActive().provider).toBe("claude");
    expect(activeEventReceived).toBe("claude");

    const invalid = registry.setActive("unknown" as any);
    expect(invalid).toBe(false);
    expect(registry.activeProvider).toBe("claude");
  });

  it("routes prompt directed to specific agent (@claude, @codex, @agy)", () => {
    const registry = new AgentRegistry({
      targetDir: tempDir,
      defaultProvider: "agy",
    });

    // Default route
    const r1 = registry.routePrompt("make a landing page");
    expect(r1.adapter.provider).toBe("agy");
    expect(r1.cleanPrompt).toBe("make a landing page");

    // Direct route to @claude
    const r2 = registry.routePrompt("@claude review this pull request");
    expect(r2.adapter.provider).toBe("claude");
    expect(r2.cleanPrompt).toBe("review this pull request");

    // Direct route to @codex
    const r3 = registry.routePrompt("@codex generate unit tests");
    expect(r3.adapter.provider).toBe("codex");
    expect(r3.cleanPrompt).toBe("generate unit tests");

    // Direct route to @agy
    registry.setActive("claude");
    const r4 = registry.routePrompt("@agy run diagnostics");
    expect(r4.adapter.provider).toBe("agy");
    expect(r4.cleanPrompt).toBe("run diagnostics");
  });

  it("instantiates adapters with correct provider types", () => {
    const agy = new AgyAdapter({ targetDir: tempDir });
    const codex = new CodexAdapter({ targetDir: tempDir });
    const claude = new ClaudeAdapter({ targetDir: tempDir });

    expect(agy.provider).toBe("agy");
    expect(codex.provider).toBe("codex");
    expect(claude.provider).toBe("claude");
  });
});
