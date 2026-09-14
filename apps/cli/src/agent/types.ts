import { EventEmitter } from "node:events";

export type AgentProvider = "agy" | "codex" | "claude" | (string & {});

export type AgentStatus = "idle" | "working" | "error" | "offline";

export interface AgentLogLine {
  id: string;
  type: "stdout" | "stderr" | "system" | "prompt";
  text: string;
  timestamp: string;
  provider?: AgentProvider;
}

export interface AgentAdapterOptions {
  agentId?: string;
  name?: string;
  targetDir: string;
}

export interface AgentInfo {
  provider: AgentProvider;
  name: string;
  isAvailable: boolean;
  status: AgentStatus;
  isActive: boolean;
  currentTask?: string | null;
}

export interface AgentAdapter extends EventEmitter {
  readonly id: string;
  readonly name: string;
  readonly provider: AgentProvider;
  readonly targetDir: string;
  readonly status: AgentStatus;
  readonly currentTask: string | null;

  isAvailable(): boolean;
  send(prompt: string): void;
  stop(): void;
}
