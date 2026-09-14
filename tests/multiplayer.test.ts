import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRelayServer, type RelayServerInstance } from "../apps/relay/src/index.js";
import { RelayClient } from "../apps/cli/src/client/RelayClient.js";
import type { RelayEvent, ServerWelcomeMessage } from "@mux/protocol";

describe("Multiplayer Local Relay", () => {
  let relay: RelayServerInstance;
  let relayUrl: string;

  beforeAll(async () => {
    // Port 0 lets OS assign an available free port
    relay = await createRelayServer({
      port: 0,
      host: "127.0.0.1",
      dbPath: ":memory:",
    });
    relayUrl = `ws://127.0.0.1:${relay.port}`;
  });

  afterAll(async () => {
    await relay.close();
  });

  it("allows two distinct clients to join the same workspace, exchange presence, and send messages", async () => {
    const workspaceName = "multiplayer-room";

    // 1. Client A (Alice)
    const clientA = new RelayClient({
      url: relayUrl,
      workspace: workspaceName,
      user: { id: "user-alice", name: "Alice" },
      autoReconnect: false,
    });

    // 2. Client B (Bob)
    const clientB = new RelayClient({
      url: relayUrl,
      workspace: workspaceName,
      user: { id: "user-bob", name: "Bob" },
      autoReconnect: false,
    });

    const clientAEvents: RelayEvent[] = [];
    const clientBEvents: RelayEvent[] = [];

    // Connect Alice first
    const aliceWelcomePromise = new Promise<ServerWelcomeMessage>((resolve) => {
      clientA.once("welcome", (welcome) => resolve(welcome));
    });

    clientA.on("event", (evt) => {
      clientAEvents.push(evt);
    });

    clientA.connect();
    const aliceWelcome = await aliceWelcomePromise;
    expect(aliceWelcome.workspace.name).toBe(workspaceName);
    expect(aliceWelcome.user.name).toBe("Alice");

    // Connect Bob second
    const bobWelcomePromise = new Promise<ServerWelcomeMessage>((resolve) => {
      clientB.once("welcome", (welcome) => resolve(welcome));
    });

    // Alice should receive Bob's join event
    const aliceReceivesBobJoinPromise = new Promise<RelayEvent>((resolve) => {
      clientA.on("event", (evt) => {
        if (evt.type === "user.joined" && evt.payload?.user?.name === "Bob") {
          resolve(evt);
        }
      });
    });

    clientB.on("event", (evt) => {
      clientBEvents.push(evt);
    });

    clientB.connect();
    const bobWelcome = await bobWelcomePromise;

    // Bob should see Alice in active users!
    expect(bobWelcome.activeUsers.some((u) => u.name === "Alice")).toBe(true);

    // Alice should receive user.joined event for Bob
    const bobJoinEvent = await aliceReceivesBobJoinPromise;
    expect(bobJoinEvent.payload.user.name).toBe("Bob");

    // 3. Test Realtime messaging: Alice sends a message to #general
    const bobReceivesMessagePromise = new Promise<RelayEvent>((resolve) => {
      clientB.on("event", (evt) => {
        if (evt.type === "message.channel" && evt.payload.text === "Hi Bob!") {
          resolve(evt);
        }
      });
    });

    clientA.sendMessage("Hi Bob!", "general");

    const messageEvent = await bobReceivesMessagePromise;
    expect(messageEvent.sender.name).toBe("Alice");
    expect(messageEvent.payload.text).toBe("Hi Bob!");

    // 4. Test Disconnect: Bob leaves, Alice receives user.left
    const aliceReceivesBobLeftPromise = new Promise<RelayEvent>((resolve) => {
      clientA.on("event", (evt) => {
        if (evt.type === "user.left" && evt.payload.name === "Bob") {
          resolve(evt);
        }
      });
    });

    clientB.disconnect();
    const bobLeftEvent = await aliceReceivesBobLeftPromise;
    expect(bobLeftEvent.payload.name).toBe("Bob");

    // Cleanup Alice
    clientA.disconnect();
  });
});
