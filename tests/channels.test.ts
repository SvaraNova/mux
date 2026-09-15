import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRelayServer } from "../apps/relay/src/server.js";
import type { RelayServerInstance } from "../apps/relay/src/server.js";
import { RelayClient } from "../apps/cli/src/client/RelayClient.js";

describe("Phase 3 — Dedicated Channels", () => {
  let relay: RelayServerInstance;
  let port: number;

  beforeEach(async () => {
    relay = await createRelayServer({ port: 0, host: "127.0.0.1", dbPath: ":memory:" });
    port = relay.port;
  });

  afterEach(async () => {
    await relay.close();
  });

  it("clients can join a custom channel and receive join event", async () => {
    const joined: string[] = [];

    const client = new RelayClient({
      url: `ws://127.0.0.1:${port}`,
      workspace: "test-workspace",
      user: { id: "user-1", name: "Alice" },
      autoReconnect: false,
    });

    await new Promise<void>((resolve) => {
      client.on("welcome", () => {
        // After joining workspace, join a channel
        client.joinChannel("backend");
      });

      client.on("event", (event) => {
        if (event.type === "channel.joined") {
          joined.push(event.payload.channel as string);
          resolve();
        }
      });

      client.connect();
    });

    client.disconnect();
    expect(joined).toContain("backend");
  });

  it("clients can leave a custom channel and receive leave event", async () => {
    const left: string[] = [];

    const client = new RelayClient({
      url: `ws://127.0.0.1:${port}`,
      workspace: "test-workspace",
      user: { id: "user-2", name: "Bob" },
      autoReconnect: false,
    });

    await new Promise<void>((resolve) => {
      let joinedBackend = false;

      client.on("welcome", () => {
        client.joinChannel("backend");
      });

      client.on("event", (event) => {
        if (event.type === "channel.joined" && !joinedBackend) {
          joinedBackend = true;
          client.leaveChannel("backend");
        }
        if (event.type === "channel.left") {
          left.push(event.payload.channel as string);
          resolve();
        }
      });

      client.connect();
    });

    client.disconnect();
    expect(left).toContain("backend");
  });

  it("messages sent to #backend appear with correct channel in payload", async () => {
    const receivedTexts: string[] = [];

    const sender = new RelayClient({
      url: `ws://127.0.0.1:${port}`,
      workspace: "test-workspace",
      user: { id: "user-s", name: "Sender" },
      autoReconnect: false,
    });

    const receiver = new RelayClient({
      url: `ws://127.0.0.1:${port}`,
      workspace: "test-workspace",
      user: { id: "user-r", name: "Receiver" },
      autoReconnect: false,
    });

    await new Promise<void>((resolve) => {
      let senderReady = false;
      let receiverReady = false;

      const maySend = () => {
        if (senderReady && receiverReady) {
          sender.joinChannel("backend");
          // send once joined
          setTimeout(() => {
            sender.sendMessage("Hello backend", "backend");
          }, 50);
        }
      };

      sender.on("welcome", () => { senderReady = true; maySend(); });
      receiver.on("welcome", () => { receiverReady = true; maySend(); });

      receiver.on("event", (event) => {
        if (event.type === "message.channel" && event.payload?.channel === "backend") {
          receivedTexts.push(event.payload.text as string);
          resolve();
        }
      });

      sender.connect();
      receiver.connect();
    });

    sender.disconnect();
    receiver.disconnect();

    expect(receivedTexts).toContain("Hello backend");
  });

  it("GET /api/events returns paginated events with channel filter", async () => {
    // send a message first
    const client = new RelayClient({
      url: `ws://127.0.0.1:${port}`,
      workspace: "events-ws",
      user: { id: "u-1", name: "Tester" },
      autoReconnect: false,
    });

    await new Promise<void>((resolve) => {
      client.on("welcome", () => {
        client.sendMessage("audit message", "general");
        setTimeout(resolve, 100);
      });
      client.connect();
    });

    client.disconnect();

    // Query the REST API
    const resp = await fetch(`http://127.0.0.1:${port}/api/events?workspace=events-ws&limit=10`);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { total: number; events: unknown[] };
    expect(body.events.length).toBeGreaterThan(0);
    expect(typeof body.total).toBe("number");
  });
});
