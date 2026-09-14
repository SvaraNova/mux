import { createRelayServer, type RelayServerInstance } from "./server.js";
import { getDefaultRelayConfig } from "./config.js";

export * from "./server.js";
export * from "./config.js";
export * from "./ws/connectionManager.js";
export * from "./ws/dispatcher.js";

async function main() {
  const config = getDefaultRelayConfig();
  console.log(`Starting mux Relay server on ${config.host}:${config.port}...`);
  console.log(`Using database at: ${config.dbPath}`);

  const relay = await createRelayServer();

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
}

// If directly executed
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error starting relay server:", err);
    process.exit(1);
  });
}
