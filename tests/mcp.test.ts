import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TeamMcpServer } from "../apps/cli/src/mcp/TeamMcpServer.js";
import {
  getMcpServerConfig,
  installMcpForProject,
} from "../apps/cli/src/mcp/installer.js";
import { SplitMultiplexer } from "../apps/cli/src/split/SplitMultiplexer.js";

describe("Team MCP Server & Multiplexer Integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mux-mcp-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles MCP initialize request correctly", async () => {
    const server = new TeamMcpServer({
      agentName: "TestAgent",
      agentProvider: "agy",
      userName: "tester",
    });

    const initReq = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    };

    const res = await (server as any).handleJsonRpc(initReq);
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    expect(res.result.serverInfo.name).toBe("mux-team-mcp");
    expect(res.result.capabilities.tools).toBeDefined();

    server.close();
  });

  it("exposes all collaborative team tools in tools/list", async () => {
    const server = new TeamMcpServer({
      agentName: "TestAgent",
      agentProvider: "claude",
      userName: "tester",
    });

    const listReq = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    };

    const res = await (server as any).handleJsonRpc(listReq);
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(2);

    const tools = res.result.tools;
    expect(Array.isArray(tools)).toBe(true);

    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("team_send_message");
    expect(toolNames).toContain("team_ask_agent");
    expect(toolNames).toContain("team_reply_agent");
    expect(toolNames).toContain("team_broadcast_status");
    expect(toolNames).toContain("team_get_context");
    expect(toolNames).toContain("team_claim_task");

    server.close();
  });

  it("generates valid MCP config and installs to project .mcp.json", () => {
    const config = getMcpServerConfig({
      relayUrl: "ws://192.168.1.100:7331",
      workspace: "cool-project",
    });

    expect(config.command).toBe("mux");
    expect(config.args).toEqual(["mcp", "serve"]);
    expect(config.env?.MUX_RELAY_URL).toBe("ws://192.168.1.100:7331");
    expect(config.env?.MUX_WORKSPACE).toBe("cool-project");

    const result = installMcpForProject(tempDir, {
      relayUrl: "ws://192.168.1.100:7331",
      workspace: "cool-project",
    });

    expect(result.status).toBe("updated");
    const writtenFile = path.join(tempDir, ".mcp.json");
    expect(fs.existsSync(writtenFile)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(writtenFile, "utf-8"));
    expect(parsed.mcpServers.mux.command).toBe("mux");
    expect(parsed.mcpServers.mux.args).toEqual(["mcp", "serve"]);
  });

  it("resolves agent commands for split terminal multiplexing", () => {
    expect(SplitMultiplexer.resolveAgentCommand("agy")).toBe("agy");
    expect(SplitMultiplexer.resolveAgentCommand("codex")).toBe("codex");

    const custom = SplitMultiplexer.resolveAgentCommand("agy", "agy -i --custom-flag");
    expect(custom).toBe("agy -i --custom-flag");
  });
});
