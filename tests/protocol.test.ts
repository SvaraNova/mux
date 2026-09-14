import { describe, it, expect } from "vitest";
import {
  RelayEventSchema,
  ClientJoinMessageSchema,
  ClientSendMessageSchema,
  ServerWelcomeMessageSchema,
} from "../packages/protocol/src/index.js";

describe("Protocol Schemas", () => {
  it("validates a RelayEvent envelope correctly", () => {
    const validEvent = {
      id: "evt-123",
      type: "user.joined",
      projectId: "test-workspace",
      sender: {
        type: "human",
        id: "user-alice",
        name: "Alice",
      },
      timestamp: new Date().toISOString(),
      payload: {
        user: {
          id: "user-alice",
          name: "Alice",
          joinedAt: new Date().toISOString(),
        },
      },
    };

    const res = RelayEventSchema.safeParse(validEvent);
    expect(res.success).toBe(true);
  });

  it("rejects invalid RelayEvent without sender", () => {
    const invalidEvent = {
      id: "evt-123",
      type: "user.joined",
      projectId: "test-workspace",
      timestamp: new Date().toISOString(),
      payload: {},
    };

    const res = RelayEventSchema.safeParse(invalidEvent);
    expect(res.success).toBe(false);
  });

  it("validates client join message", () => {
    const joinMsg = {
      type: "client.join",
      workspace: "nadi",
      user: {
        id: "u-1",
        name: "Yoga",
      },
    };

    const res = ClientJoinMessageSchema.safeParse(joinMsg);
    expect(res.success).toBe(true);
  });

  it("validates client send message", () => {
    const sendMsg = {
      type: "client.send_message",
      channel: "general",
      text: "Hello everyone!",
    };

    const res = ClientSendMessageSchema.safeParse(sendMsg);
    expect(res.success).toBe(true);
  });

  it("validates server welcome message", () => {
    const welcome = {
      type: "server.welcome",
      workspace: {
        id: "ws-1",
        name: "nadi",
        joinCode: "NADI-1234",
      },
      user: {
        id: "u-1",
        name: "Yoga",
      },
      activeUsers: [
        {
          id: "u-1",
          name: "Yoga",
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
        },
      ],
      recentEvents: [],
    };

    const res = ServerWelcomeMessageSchema.safeParse(welcome);
    expect(res.success).toBe(true);
  });
});
