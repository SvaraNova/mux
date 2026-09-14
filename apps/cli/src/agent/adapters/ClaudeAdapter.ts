import { BaseProcessAdapter } from "../BaseProcessAdapter.js";
import type { AgentAdapterOptions, AgentProvider } from "../types.js";

export class ClaudeAdapter extends BaseProcessAdapter {
  public readonly provider: AgentProvider = "claude";

  constructor(options: AgentAdapterOptions) {
    super({
      ...options,
      name: options.name || "Claude Code (claude)",
    });
  }

  protected getBinaryName(): string {
    return "claude";
  }

  protected buildArguments(prompt: string): string[] {
    return ["-p", prompt];
  }

  protected buildInteractiveArguments(prompt?: string): string[] {
    if (prompt && prompt.trim()) {
      return [prompt.trim()];
    }
    return [];
  }
}
