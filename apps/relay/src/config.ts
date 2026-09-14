import path from "node:path";
import os from "node:os";

export interface RelayConfig {
  port: number;
  host: string;
  dbPath: string;
}

export function getDefaultRelayConfig(): RelayConfig {
  const port = process.env.MUX_PORT ? parseInt(process.env.MUX_PORT, 10) : 7331;
  const host = process.env.MUX_HOST || "0.0.0.0";
  const dbPath =
    process.env.MUX_DB_PATH ||
    path.join(process.env.HOME || os.homedir(), ".mux", "relay.db");

  return {
    port,
    host,
    dbPath,
  };
}
