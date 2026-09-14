#!/usr/bin/env node
import { Command } from "commander";
import os from "node:os";
import path from "node:path";
import React from "react";
import chalk from "chalk";
import { render } from "ink";
import { createRelayServer } from "@mux/relay";
import { RelayClient } from "../client/RelayClient.js";
import { App } from "../tui/App.js";
import { BANNER_TEXT } from "../tui/components/Banner.js";
import {
  TeamMcpServer,
  installAllMcp,
  installMcpForAgy,
  installMcpForClaude,
  installMcpForProject,
} from "../mcp/index.js";
import { SplitMultiplexer } from "../split/index.js";

function getEditorialHeader(): string {
  return [
    chalk.cyan.bold(BANNER_TEXT),
    chalk.gray("  The Multiplayer Terminal for ") +
      chalk.yellow.bold("Humans ") +
      chalk.gray("& ") +
      chalk.magenta.bold("Coding Agents") +
      chalk.gray(" │ LAN Realtime Relay"),
    "",
  ].join("\n");
}

const program = new Command();

program
  .name("mux")
  .description("mux - Collaborative AI Development TUI & Team MCP Relay")
  .version("0.1.0")
  .addHelpText("beforeAll", () => getEditorialHeader());

// Command: mux host
program
  .command("host [dir]")
  .description("Start a local relay server and open the collaborative TUI")
  .option("-p, --port <number>", "Port to host on", "7331")
  .option("--host <host>", "Host address to bind to", "0.0.0.0")
  .option("--project <name>", "Workspace project name (default: folder name)")
  .option("-u, --user <name>", "Your display name", os.userInfo().username || "developer")
  .option("-a, --agent <provider>", "Default AI agent provider (agy, codex, claude)", "agy")
  .option("--agent-cmd <command>", "Custom command for agent execution in split mode")
  .option("--split", "Launch side-by-side terminal with interactive agent and collaborative TUI")
  .option("--collab-only", "Collab-only mode: show team TUI without agent launch (set automatically in split pane)")
  .option("--dir <path>", "Target project directory")
  .option("--db <path>", "Path to SQLite database")
  .action(async (dirArg, options) => {
    const targetDir = path.resolve(dirArg || options.dir || process.cwd());
    const port = parseInt(options.port, 10);
    const projectName = options.project || path.basename(targetDir) || "mux";
    const userName = options.user;
    const initialProvider = options.agent || "agy";

    // If --split requested: start relay first, then delegate to SplitMultiplexer
    if (options.split) {
      const dbPath = options.db || path.join(targetDir, ".mux", "relay.db");
      const relayUrl = `ws://localhost:${port}`;
      const escapedDir = targetDir.replace(/"/g, '\\"');
      const escapedProject = projectName.replace(/"/g, '\\"');
      const escapedUser = userName.replace(/"/g, '\\"');

      // Start the relay server first so it's ready before panes connect
      console.log(`Starting mux relay for workspace "${projectName}" on port ${port}...`);
      try {
        await createRelayServer({ port, host: options.host, dbPath });
        console.log(`Relay ready at ${relayUrl}`);
      } catch (err: any) {
        if (err.code !== "EADDRINUSE") {
          console.error("Failed to start relay:", err.message);
          process.exit(1);
        }
        console.log(`Port ${port} already in use — reusing existing relay.`);
      }

      // Use absolute paths for node + mux script so the tmux pane doesn't
      // need ~/.local/bin in PATH (tmux shells often have a minimal PATH).
      const nodeBin = process.execPath;          // e.g. /usr/local/bin/node
      const muxScript = process.argv[1];         // e.g. /Users/.../dist/bin/mux.js

      // muxCommand for the right (collab) pane
      const muxCommand = `"${nodeBin}" "${muxScript}" host --port ${port} --host ${options.host} --project "${escapedProject}" --user "${escapedUser}" --agent "${initialProvider}" --dir "${escapedDir}" --collab-only`;

      SplitMultiplexer.launch({
        agent: initialProvider,
        agentCmd: options.agentCmd,
        muxCommand,
        targetDir,
        relayUrl,
        workspace: projectName,
        userName,
      });
      return;
    }

    const collabOnly = !!options.collabOnly;
    const userId = `user-${userName.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
    const dbPath = options.db || path.join(targetDir, ".mux", "relay.db");

    if (!collabOnly) {
      console.log(`Starting mux workspace "${projectName}" in ${targetDir} on port ${port}...`);
    }

    let relayInstance: any = null;
    try {
      relayInstance = await createRelayServer({
        port,
        host: options.host,
        dbPath,
      });
    } catch (err: any) {
      if (err.code === "EADDRINUSE") {
        if (!collabOnly) console.log(`Port ${port} is already in use. Assuming existing relay server.`);
      } else {
        console.error("Failed to start relay:", err.message);
        process.exit(1);
      }
    }

    const relayUrl = `ws://localhost:${port}`;
    const client = new RelayClient({
      url: relayUrl,
      workspace: projectName,
      user: {
        id: userId,
        name: userName,
      },
    });

    const { waitUntilExit } = render(
      React.createElement(App, {
        client,
        projectName,
        userName,
        userId,
        relayUrl,
        targetDir,
        initialProvider,
        collabOnly,
        onExit: async () => {
          if (relayInstance) {
            await relayInstance.close();
          }
        },
      })
    );

    await waitUntilExit();
    if (relayInstance) {
      await relayInstance.close();
    }
    process.exit(0);
  });

// Command: mux join <url>
program
  .command("join <url> [dir]")
  .description("Join an existing mux workspace relay")
  .option("--project <name>", "Workspace project name (default: folder name)")
  .option("-u, --user <name>", "Your display name", os.userInfo().username || "developer")
  .option("-a, --agent <provider>", "Default AI agent provider (agy, codex, claude)", "agy")
  .option("--agent-cmd <command>", "Custom command for agent execution in split mode")
  .option("--split", "Launch side-by-side terminal with interactive agent and collaborative TUI")
  .option("--dir <path>", "Target project directory")
  .option("-c, --code <code>", "Workspace join code")
  .action(async (url, dirArg, options) => {
    const targetDir = path.resolve(dirArg || options.dir || process.cwd());
    const projectName = options.project || path.basename(targetDir) || "mux";
    const userName = options.user;
    const initialProvider = options.agent || "agy";

    // If --split requested, delegate to SplitMultiplexer
    if (options.split) {
      const escapedDir = targetDir.replace(/"/g, '\\"');
      const escapedProject = projectName.replace(/"/g, '\\"');
      const escapedUser = userName.replace(/"/g, '\\"');
      const codeArg = options.code ? ` --code "${options.code}"` : "";
      const nodeBin = process.execPath;
      const muxScript = process.argv[1];
      const muxCommand = `"${nodeBin}" "${muxScript}" join "${url}" --project "${escapedProject}" --user "${escapedUser}" --agent "${initialProvider}" --dir "${escapedDir}"${codeArg}`;

      SplitMultiplexer.launch({
        agent: initialProvider,
        agentCmd: options.agentCmd,
        muxCommand,
        targetDir,
        relayUrl: url,
        workspace: projectName,
        userName,
      });
      return;
    }

    const userId = `user-${userName.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
    const client = new RelayClient({
      url,
      workspace: projectName,
      joinCode: options.code,
      user: {
        id: userId,
        name: userName,
      },
    });

    const { waitUntilExit } = render(
      React.createElement(App, {
        client,
        projectName,
        userName,
        userId,
        relayUrl: url,
        targetDir,
        initialProvider,
        onExit: () => {
          process.exit(0);
        },
      })
    );

    await waitUntilExit();
    process.exit(0);
  });

// Command: mux split
program
  .command("split [dir]")
  .description("Launch interactive AI agent and collaborative mux TUI side-by-side in dual panes")
  .option("-a, --agent <provider>", "AI agent provider (agy, claude, codex)", "agy")
  .option("--agent-cmd <command>", "Custom agent CLI command")
  .option("-p, --port <number>", "Port to host relay on (if hosting)", "7331")
  .option("--host <host>", "Host address to bind to", "0.0.0.0")
  .option("--project <name>", "Workspace project name")
  .option("-u, --user <name>", "Your display name", os.userInfo().username || "developer")
  .option("--join <url>", "Join an existing remote relay instead of hosting locally")
  .option("-c, --code <code>", "Join code if joining remote relay")
  .action((dirArg, options) => {
    const targetDir = path.resolve(dirArg || process.cwd());
    const projectName = options.project || path.basename(targetDir) || "mux";
    const userName = options.user;
    const initialProvider = options.agent || "agy";
    const escapedDir = targetDir.replace(/"/g, '\\"');
    const escapedProject = projectName.replace(/"/g, '\\"');
    const escapedUser = userName.replace(/"/g, '\\"');

    let muxCommand: string;
    if (options.join) {
      const codeArg = options.code ? ` --code "${options.code}"` : "";
      muxCommand = `mux join "${options.join}" --project "${escapedProject}" --user "${escapedUser}" --agent "${initialProvider}" --dir "${escapedDir}"${codeArg}`;
    } else {
      const port = parseInt(options.port || "7331", 10);
      muxCommand = `mux host --port ${port} --host ${options.host} --project "${escapedProject}" --user "${escapedUser}" --agent "${initialProvider}" --dir "${escapedDir}"`;
    }

    SplitMultiplexer.launch({
      agent: initialProvider,
      agentCmd: options.agentCmd,
      muxCommand,
      targetDir,
    });
  });

// Subcommand: mux mcp
const mcpGroup = program.command("mcp").description("Model Context Protocol (MCP) integrations for AI agents");

mcpGroup
  .command("serve")
  .description("Start the Team MCP server over stdio for agy, Claude Code, or Codex")
  .option("--relay <url>", "Relay server WebSocket URL", process.env.MUX_RELAY_URL || "ws://127.0.0.1:7331")
  .option("--workspace <name>", "Workspace name", process.env.MUX_WORKSPACE || "default")
  .option("--agent <name>", "Display name of your agent", process.env.MUX_AGENT_NAME || "Local Agent")
  .option("--provider <provider>", "Agent provider (agy, claude, codex)", process.env.MUX_AGENT_PROVIDER || "agy")
  .option("-u, --user <name>", "Your developer name", process.env.USER || "developer")
  .action(async (options) => {
    const server = new TeamMcpServer({
      relayUrl: options.relay,
      workspace: options.workspace,
      agentName: options.agent,
      agentProvider: options.provider,
      userName: options.user,
    });

    const shutdown = () => {
      server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await server.start();
  });

mcpGroup
  .command("install")
  .description("Automatically register 'mux' MCP server into Antigravity, Claude Code, and project configurations")
  .option("--target <target>", "Install target: all, agy, claude, project", "all")
  .option("--relay <url>", "Preset default relay URL for the MCP config")
  .option("--workspace <name>", "Preset default workspace name for the MCP config")
  .option("--dir <path>", "Target project directory (default: current directory)")
  .action((options) => {
    const target = options.target.toLowerCase();
    const projectDir = path.resolve(options.dir || process.cwd());
    const mcpOptions = {
      relayUrl: options.relay,
      workspace: options.workspace,
    };

    console.log(chalk.cyan.bold("\n🔧 Registering mux Team MCP Server...\n"));

    let results = [];
    if (target === "all") {
      results = installAllMcp(projectDir, mcpOptions);
    } else if (target === "agy" || target === "antigravity") {
      results = [installMcpForAgy(mcpOptions)];
    } else if (target === "claude") {
      results = [installMcpForClaude(mcpOptions)];
    } else if (target === "project") {
      results = [installMcpForProject(projectDir, mcpOptions)];
    } else {
      console.error(chalk.red(`Unknown target: ${target}. Use all, agy, claude, or project.`));
      process.exit(1);
    }

    for (const res of results) {
      if (res.status === "updated" || res.status === "created") {
        console.log(chalk.green(`  ✔ ${res.target}`));
        console.log(chalk.gray(`    Path: ${res.path}`));
        console.log(chalk.gray(`    ${res.message}\n`));
      } else {
        console.log(chalk.red(`  ✖ ${res.target}`));
        console.log(chalk.gray(`    Path: ${res.path}`));
        console.log(chalk.red(`    ${res.message}\n`));
      }
    }

    console.log(chalk.green.bold("🎉 MCP configuration complete!"));
    console.log(chalk.gray("Your AI agents (agy, claude, etc.) can now call:"));
    console.log(chalk.yellow("  • team_ask_agent") + chalk.gray("       - Ask a teammate's agent across LAN"));
    console.log(chalk.yellow("  • team_reply_agent") + chalk.gray("     - Reply to queries from teammates"));
    console.log(chalk.yellow("  • team_send_message") + chalk.gray("    - Post messages/code to team channel"));
    console.log(chalk.yellow("  • team_broadcast_status") + chalk.gray("- Announce working/idle status"));
    console.log(chalk.yellow("  • team_claim_task") + chalk.gray("      - Lock features to prevent merge conflicts"));
    console.log(chalk.yellow("  • team_get_context") + chalk.gray("    - Read live team presence & chat stream\n"));
  });

// Command: mux relay
program
  .command("relay")
  .description("Start the mux relay server in standalone mode")
  .option("-p, --port <number>", "Port to listen on", "7331")
  .option("--host <host>", "Host to bind to", "0.0.0.0")
  .option("--db <path>", "Path to SQLite database")
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    console.log(getEditorialHeader());
    const relay = await createRelayServer({
      port,
      host: options.host,
      dbPath: options.db,
    });

    console.log(`\n========================================`);
    console.log(`  mux Relay Server is running!`);
    console.log(`  HTTP: http://${relay.host}:${relay.port}`);
    console.log(`  WS:   ws://${relay.host}:${relay.port}`);
    console.log(`========================================\n`);

    const shutdown = async () => {
      console.log("\nShutting down mux Relay server...");
      await relay.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program.parse(process.argv);
