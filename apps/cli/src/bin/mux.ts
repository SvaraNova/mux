#!/usr/bin/env node
import { Command } from "commander";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import React from "react";
import chalk from "chalk";
import { render } from "ink";
import { createRelayServer } from "@mux/relay";
import { RelayClient } from "../client/RelayClient.js";
import { App } from "../tui/App.js";
import { BANNER_TEXT } from "../tui/components/Banner.js";

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
  .description("mux - Collaborative AI Development TUI")
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
  .option("--dir <path>", "Target project directory")
  .option("--db <path>", "Path to SQLite database")
  .action(async (dirArg, options) => {
    const targetDir = path.resolve(dirArg || options.dir || process.cwd());
    const port = parseInt(options.port, 10);
    const projectName = options.project || path.basename(targetDir) || "mux";
    const userName = options.user;
    const userId = `user-${userName.toLowerCase()}-${crypto.randomBytes(2).toString("hex")}`;
    const dbPath = options.db || path.join(targetDir, ".mux", "relay.db");

    console.log(`Starting mux workspace "${projectName}" in ${targetDir} on port ${port}...`);

    let relayInstance: any = null;
    try {
      relayInstance = await createRelayServer({
        port,
        host: options.host,
        dbPath,
      });
    } catch (err: any) {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is already in use. Assuming existing relay server.`);
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
  .option("--dir <path>", "Target project directory")
  .option("-c, --code <code>", "Workspace join code")
  .action(async (url, dirArg, options) => {
    const targetDir = path.resolve(dirArg || options.dir || process.cwd());
    const projectName = options.project || path.basename(targetDir) || "mux";
    const userName = options.user;
    const userId = `user-${userName.toLowerCase()}-${crypto.randomBytes(2).toString("hex")}`;

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
        onExit: () => {
          process.exit(0);
        },
      })
    );

    await waitUntilExit();
    process.exit(0);
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
