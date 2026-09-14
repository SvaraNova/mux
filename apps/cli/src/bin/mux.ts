#!/usr/bin/env node
import { Command } from "commander";
import os from "node:os";
import crypto from "node:crypto";
import React from "react";
import { render } from "ink";
import { createRelayServer } from "@mux/relay";
import { RelayClient } from "../client/RelayClient.js";
import { App } from "../tui/App.js";

const program = new Command();

program
  .name("mux")
  .description("mux - Collaborative AI Development TUI")
  .version("0.1.0");

// Command: mux host
program
  .command("host")
  .description("Start a local relay server and open the collaborative TUI")
  .option("-p, --port <number>", "Port to host on", "7331")
  .option("--host <host>", "Host address to bind to", "0.0.0.0")
  .option("--project <name>", "Workspace project name", "mux")
  .option("-u, --user <name>", "Your display name", os.userInfo().username || "developer")
  .option("--db <path>", "Path to SQLite database", ":memory:")
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const projectName = options.project;
    const userName = options.user;
    const userId = `user-${userName.toLowerCase()}-${crypto.randomBytes(2).toString("hex")}`;

    console.log(`Starting mux workspace "${projectName}" on port ${port}...`);

    let relayInstance: any = null;
    try {
      relayInstance = await createRelayServer({
        port,
        host: options.host,
        dbPath: options.db,
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
  .command("join <url>")
  .description("Join an existing mux workspace relay")
  .option("--project <name>", "Workspace project name", "mux")
  .option("-u, --user <name>", "Your display name", os.userInfo().username || "developer")
  .option("-c, --code <code>", "Workspace join code")
  .action(async (url, options) => {
    const projectName = options.project;
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
