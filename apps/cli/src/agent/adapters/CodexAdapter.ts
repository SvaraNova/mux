import { BaseProcessAdapter } from "../BaseProcessAdapter.js";
import type { AgentAdapterOptions, AgentProvider } from "../types.js";

export class CodexAdapter extends BaseProcessAdapter {
  public readonly provider: AgentProvider = "codex";

  constructor(options: AgentAdapterOptions) {
    super({
      ...options,
      name: options.name || "OpenAI Codex (codex)",
    });
  }

  protected getBinaryName(): string {
    return "codex";
  }

  protected buildArguments(prompt: string): string[] {
    return [prompt];
  }
}
