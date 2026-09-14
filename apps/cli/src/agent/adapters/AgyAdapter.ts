import { BaseProcessAdapter } from "../BaseProcessAdapter.js";
import type { AgentAdapterOptions, AgentProvider } from "../types.js";

export class AgyAdapter extends BaseProcessAdapter {
  public readonly provider: AgentProvider = "agy";

  constructor(options: AgentAdapterOptions) {
    super({
      ...options,
      name: options.name || "Antigravity (agy)",
    });
  }

  protected getBinaryName(): string {
    return "agy";
  }

  protected buildArguments(prompt: string): string[] {
    return ["-p", prompt, "--dangerously-skip-permissions"];
  }

  protected buildInteractiveArguments(prompt?: string): string[] {
    if (prompt && prompt.trim()) {
      return ["-i", prompt.trim()];
    }
    return [];
  }
}
