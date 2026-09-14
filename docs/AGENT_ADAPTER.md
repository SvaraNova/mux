# Agent Adapter Architecture (Future Phases)

## Design Philosophy

The relay server and protocol are intentionally provider-independent. AI coding agents (Codex, Claude, Gemini, Local LLMs) interact with the workspace as first-class team members through a structured adapter interface rather than unstructured raw terminal scraping.

## Target Adapter Interface

```typescript
export interface AgentCapability {
  name: string;
  version: string;
}

export interface AgentAdapter {
  id: string;
  provider: string;
  capabilities(): Promise<AgentCapability[]>;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(input: { text: string; context?: Record<string, any> }): Promise<void>;
  status(): Promise<"idle" | "working" | "waiting" | "error" | "offline">;
}
```

Implementation will take place in **Phase 5 & 6** following the build brief.
