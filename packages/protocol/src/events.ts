import { z } from "zod";

export const SenderSchema = z.object({
  type: z.enum(["human", "agent", "system"]),
  id: z.string().min(1),
  name: z.string().optional(),
});

export type Sender = z.infer<typeof SenderSchema>;

export const TargetSchema = z.object({
  type: z.enum(["human", "agent", "channel"]),
  id: z.string().min(1),
});

export type Target = z.infer<typeof TargetSchema>;

export const UserJoinedPayloadSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    joinedAt: z.string(),
  }),
});

export type UserJoinedPayload = z.infer<typeof UserJoinedPayloadSchema>;

export const UserLeftPayloadSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  reason: z.string().optional(),
});

export type UserLeftPayload = z.infer<typeof UserLeftPayloadSchema>;

export const MessageChannelPayloadSchema = z.object({
  channel: z.string().default("general"),
  text: z.string().min(1),
});

export type MessageChannelPayload = z.infer<typeof MessageChannelPayloadSchema>;

export const MessageDirectPayloadSchema = z.object({
  recipientId: z.string().min(1),
  recipientName: z.string().optional(),
  text: z.string().min(1),
});

export type MessageDirectPayload = z.infer<typeof MessageDirectPayloadSchema>;

export const SystemEventPayloadSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
});

export type SystemEventPayload = z.infer<typeof SystemEventPayloadSchema>;

export const AgentRegisteredPayloadSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  ownerId: z.string().min(1),
  status: z.enum(["idle", "working", "error", "offline"]),
  currentTask: z.string().nullable().optional(),
});

export type AgentRegisteredPayload = z.infer<typeof AgentRegisteredPayloadSchema>;

export const AgentStatusPayloadSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  ownerId: z.string().min(1),
  status: z.enum(["idle", "working", "error", "offline"]),
  task: z.string().nullable().optional(),
});

export type AgentStatusPayload = z.infer<typeof AgentStatusPayloadSchema>;

export const AgentAskPayloadSchema = z.object({
  requestId: z.string().min(1),
  fromAgentId: z.string().min(1),
  fromAgentName: z.string().min(1),
  targetAgentName: z.string().min(1),
  question: z.string().min(1),
  timestamp: z.string(),
});

export type AgentAskPayload = z.infer<typeof AgentAskPayloadSchema>;

export const AgentReplyPayloadSchema = z.object({
  requestId: z.string().min(1),
  fromAgentId: z.string().min(1),
  fromAgentName: z.string().min(1),
  toAgentId: z.string().min(1),
  reply: z.string().min(1),
  timestamp: z.string(),
});

export type AgentReplyPayload = z.infer<typeof AgentReplyPayloadSchema>;

export const RelayEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  projectId: z.string().min(1),
  sender: SenderSchema,
  target: TargetSchema.optional(),
  timestamp: z.string(),
  payload: z.record(z.any()),
});

export type RelayEvent<T = Record<string, any>> = {
  id: string;
  type: string;
  projectId: string;
  sender: Sender;
  target?: Target;
  timestamp: string;
  payload: T;
};
