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

  it("broadcasts agent registration and agent status updates across clients", async () => {
    const workspaceName = "agent-relay-room";

    const client1 = new RelayClient({
      url: relayUrl,
      workspace: workspaceName,
      user: { id: "u-dev1", name: "Dev1" },
      autoReconnect: false,
    });

    const client2 = new RelayClient({
      url: relayUrl,
      workspace: workspaceName,
      user: { id: "u-dev2", name: "Dev2" },
      autoReconnect: false,
    });

    await new Promise<void>((resolve) => {
      client1.once("welcome", () => resolve());
      client1.connect();
    });

    await new Promise<void>((resolve) => {
      client2.once("welcome", () => resolve());
      client2.connect();
    });

    // Client 2 listens for Dev1's agent registration
    const agentRegisteredPromise = new Promise<RelayEvent>((resolve) => {
      client2.on("event", (evt) => {
        if (evt.type === "agent.registered") {
          resolve(evt);
        }
      });
    });

    // Client 1 registers an agent
    client1.registerAgent({
      id: "ag-claude-test",
      name: "Claude Code",
      provider: "claude",
      ownerId: "u-dev1",
      status: "idle",
      currentTask: null,
    });

    const regEvent = await agentRegisteredPromise;
    expect(regEvent.payload.provider).toBe("claude");
    expect(regEvent.payload.ownerId).toBe("u-dev1");

    // Client 2 listens for Dev1's agent status change
    const agentStatusPromise = new Promise<RelayEvent>((resolve) => {
      client2.on("event", (evt) => {
        if (evt.type === "agent.status") {
          resolve(evt);
        }
      });
    });

    // Client 1 updates agent status to working
    client1.sendAgentStatus("ag-claude-test", "working", "Refactoring compiler");

    const statusEvent = await agentStatusPromise;
    expect(statusEvent.payload.status).toBe("working");
    expect(statusEvent.payload.task).toBe("Refactoring compiler");

    client1.disconnect();
    client2.disconnect();
  });
});
