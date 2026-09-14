import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";

export interface McpInstallResult {
  target: string;
  path: string;
  status: "created" | "updated" | "skipped" | "error";
  message: string;
}

export function getMcpServerConfig(options?: { relayUrl?: string; workspace?: string }) {
  const env: Record<string, string> = {};
  if (options?.relayUrl) env.MUX_RELAY_URL = options.relayUrl;
  if (options?.workspace) env.MUX_WORKSPACE = options.workspace;

  return {
    command: "mux",
    args: ["mcp", "serve"],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

export function installMcpForAgy(options?: { relayUrl?: string; workspace?: string }): McpInstallResult {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".gemini", "config");
  const configFile = path.join(configDir, "mcp_config.json");

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let config: any = { mcpServers: {} };
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, "utf-8");
        config = JSON.parse(raw);
        if (!config.mcpServers) config.mcpServers = {};
      } catch {
        config = { mcpServers: {} };
      }
    }

    config.mcpServers.mux = getMcpServerConfig(options);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");

    return {
      target: "Antigravity (agy)",
      path: configFile,
      status: "updated",
      message: "Registered 'mux' MCP server in Antigravity global config.",
    };
  } catch (err: any) {
    return {
      target: "Antigravity (agy)",
      path: configFile,
      status: "error",
      message: err.message,
    };
  }
}

export function installMcpForClaude(options?: { relayUrl?: string; workspace?: string }): McpInstallResult {
  const homeDir = os.homedir();
  const configFile = path.join(homeDir, ".claude.json");

  try {
    let config: any = { mcpServers: {} };
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, "utf-8");
        config = JSON.parse(raw);
        if (!config.mcpServers) config.mcpServers = {};
      } catch {
        config = { mcpServers: {} };
      }
    }

    config.mcpServers.mux = getMcpServerConfig(options);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");

    return {
      target: "Claude Code",
      path: configFile,
      status: "updated",
      message: "Registered 'mux' MCP server in Claude Code global config (~/.claude.json).",
    };
  } catch (err: any) {
    return {
      target: "Claude Code",
      path: configFile,
      status: "error",
      message: err.message,
    };
  }
}

export function installMcpForProject(
  projectDir: string = process.cwd(),
  options?: { relayUrl?: string; workspace?: string }
): McpInstallResult {
  const configFile = path.join(projectDir, ".mcp.json");

  try {
    let config: any = { mcpServers: {} };
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, "utf-8");
        config = JSON.parse(raw);
        if (!config.mcpServers) config.mcpServers = {};
      } catch {
        config = { mcpServers: {} };
      }
    }

    config.mcpServers.mux = getMcpServerConfig(options);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");

    return {
      target: "Project (.mcp.json for Claude/Cursor/Windsurf)",
      path: configFile,
      status: "updated",
      message: "Created/updated local project .mcp.json file.",
    };
  } catch (err: any) {
    return {
      target: "Project (.mcp.json)",
      path: configFile,
      status: "error",
      message: err.message,
    };
  }
}

export function installAllMcp(
  projectDir: string = process.cwd(),
  options?: { relayUrl?: string; workspace?: string }
): McpInstallResult[] {
  return [
    installMcpForAgy(options),
    installMcpForClaude(options),
    installMcpForProject(projectDir, options),
  ];
}
