import { EventEmitter } from "node:events";
import type { AgentAdapter, AgentInfo, AgentLogLine, AgentProvider, AgentStatus } from "./types.js";
import { AgyAdapter } from "./adapters/AgyAdapter.js";
import { CodexAdapter } from "./adapters/CodexAdapter.js";
import { ClaudeAdapter } from "./adapters/ClaudeAdapter.js";

export interface AgentRegistryOptions {
  targetDir: string;
  defaultProvider?: AgentProvider;
  ownerId?: string;
}

export class AgentRegistry extends EventEmitter {
  private adapters = new Map<AgentProvider, AgentAdapter>();
  private _activeProvider: AgentProvider;
  public readonly targetDir: string;
  public readonly ownerId?: string;

  constructor(options: AgentRegistryOptions) {
    super();
    this.targetDir = options.targetDir;
    this.ownerId = options.ownerId;
    this._activeProvider = options.defaultProvider || "agy";

    // Register default supported agents
    this.register(new AgyAdapter({ targetDir: this.targetDir, agentId: `agy-${options.ownerId || "local"}` }));
    this.register(new CodexAdapter({ targetDir: this.targetDir, agentId: `codex-${options.ownerId || "local"}` }));
    this.register(new ClaudeAdapter({ targetDir: this.targetDir, agentId: `claude-${options.ownerId || "local"}` }));
  }

  public register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.provider, adapter);

    adapter.on("log", (log: AgentLogLine) => {
      this.emit("log", log);
    });

    adapter.on("status", (payload: { status: AgentStatus; task: string | null; provider: AgentProvider }) => {
      this.emit("status", {
        ...payload,
        agentId: adapter.id,
        name: adapter.name,
      });
    });
  }

  public get(provider: AgentProvider): AgentAdapter | undefined {
    return this.adapters.get(provider);
  }

  public getActive(): AgentAdapter {
    const active = this.adapters.get(this._activeProvider);
    if (active) return active;
    // Fallback to first available or agy
    return this.adapters.values().next().value!;
  }

  public get activeProvider(): AgentProvider {
    return this._activeProvider;
  }

  public setActive(provider: AgentProvider): boolean {
    if (this.adapters.has(provider)) {
      this._activeProvider = provider;
      this.emit("active_change", provider);
      return true;
    }
    return false;
  }

  public list(): AgentInfo[] {
    const list: AgentInfo[] = [];
    for (const [provider, adapter] of this.adapters.entries()) {
      list.push({
        provider,
        name: adapter.name,
        isAvailable: adapter.isAvailable(),
        status: adapter.status,
        isActive: provider === this._activeProvider,
        currentTask: adapter.currentTask,
      });
    }
    return list;
  }

  /**
   * Routes prompt: detects targeted prefix (e.g. '@claude ...', '@codex ...', '@agy ...')
   * or defaults to active provider.
   */
  public routePrompt(input: string): { adapter: AgentAdapter; cleanPrompt: string } {
    const trimmed = input.trim();
    const providers: AgentProvider[] = ["agy", "codex", "claude"];

    for (const p of providers) {
      const prefix = `@${p}`;
      if (trimmed.startsWith(prefix) && (trimmed.length === prefix.length || trimmed[prefix.length] === " ")) {
        const cleanPrompt = trimmed.slice(prefix.length).trim();
        const adapter = this.adapters.get(p) || this.getActive();
        return { adapter, cleanPrompt };
      }
    }

    return {
      adapter: this.getActive(),
      cleanPrompt: trimmed,
    };
  }

  public launchInteractive(prompt?: string, provider?: AgentProvider): number {
    const targetProvider = provider || this._activeProvider;
    const adapter = this.adapters.get(targetProvider) || this.getActive();
    return adapter.launchInteractive(prompt);
  }

  public stopAll(): void {
    for (const adapter of this.adapters.values()) {
      adapter.stop();
    }
  }
}
