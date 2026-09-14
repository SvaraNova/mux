import { z } from "zod";
import { RelayEventSchema } from "./events.js";

// Client -> Server messages
export const ClientJoinMessageSchema = z.object({
  type: z.literal("client.join"),
  workspace: z.string().min(1),
  joinCode: z.string().optional(),
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
});

export type ClientJoinMessage = z.infer<typeof ClientJoinMessageSchema>;

export const ClientSendMessageSchema = z.object({
  type: z.literal("client.send_message"),
  channel: z.string().optional(),
  recipientId: z.string().optional(),
  text: z.string().min(1),
});

export type ClientSendMessage = z.infer<typeof ClientSendMessageSchema>;

export const ClientHeartbeatMessageSchema = z.object({
  type: z.literal("client.heartbeat"),
  timestamp: z.string(),
});

export type ClientHeartbeatMessage = z.infer<typeof ClientHeartbeatMessageSchema>;

export const ClientLeaveMessageSchema = z.object({
  type: z.literal("client.leave"),
  reason: z.string().optional(),
});

export type ClientLeaveMessage = z.infer<typeof ClientLeaveMessageSchema>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  ClientJoinMessageSchema,
  ClientSendMessageSchema,
  ClientHeartbeatMessageSchema,
  ClientLeaveMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client messages
export const ActiveUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isOnline: z.boolean(),
  lastSeenAt: z.string(),
});

export type ActiveUser = z.infer<typeof ActiveUserSchema>;

export const ServerWelcomeMessageSchema = z.object({
  type: z.literal("server.welcome"),
  workspace: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    joinCode: z.string(),
  }),
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  activeUsers: z.array(ActiveUserSchema),
  recentEvents: z.array(RelayEventSchema),
});

export type ServerWelcomeMessage = z.infer<typeof ServerWelcomeMessageSchema>;

export const ServerEventMessageSchema = z.object({
  type: z.literal("server.event"),
  event: RelayEventSchema,
});

export type ServerEventMessage = z.infer<typeof ServerEventMessageSchema>;

export const ServerErrorMessageSchema = z.object({
  type: z.literal("server.error"),
  code: z.string(),
  message: z.string(),
});

export type ServerErrorMessage = z.infer<typeof ServerErrorMessageSchema>;

export const ServerPongMessageSchema = z.object({
  type: z.literal("server.pong"),
  timestamp: z.string(),
});

export type ServerPongMessage = z.infer<typeof ServerPongMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  ServerWelcomeMessageSchema,
  ServerEventMessageSchema,
  ServerErrorMessageSchema,
  ServerPongMessageSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
