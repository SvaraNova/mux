import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import chalk from "chalk";

export interface SplitOptions {
  agent?: string;        // "agy" | "claude" | "codex"
  agentCmd?: string;     // custom command override
  direction?: "horizontal" | "vertical"; // default vertical (side-by-side)
  muxCommand: string;    // the mux host/join command for the collab pane
  targetDir?: string;
  // relay connection info injected as env vars into the agent pane
  relayUrl?: string;
  workspace?: string;
  userName?: string;
}

export class SplitMultiplexer {
  public static isTmuxInstalled(): boolean {
    try {
      const res = spawnSync("which", ["tmux"], { stdio: "pipe" });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  public static isInsideTmux(): boolean {
    return Boolean(process.env.TMUX);
  }

  public static resolveAgentCommand(provider: string = "agy", customCmd?: string): string {
    if (customCmd) return customCmd;

    const p = provider.toLowerCase();
    if (p.includes("agy") || p.includes("antigravity")) {
      try {
        if (spawnSync("which", ["agy"], { stdio: "pipe" }).status === 0) return "agy";
      } catch {}
      return "agy";
    }

    if (p.includes("claude")) {
      try {
        if (spawnSync("which", ["claude"], { stdio: "pipe" }).status === 0) return "claude";
      } catch {}
      return "npx @anthropic-ai/claude-code";
    }

    if (p.includes("codex")) {
      return "codex";
    }

    return process.env.SHELL || "/bin/bash";
  }

  /**
   * Build a shell prefix that exports MUX_* environment variables so that
   * when the AI agent spawns `mux mcp serve`, the TeamMcpServer automatically
   * connects to the correct relay + workspace.
   */
  private static buildEnvPrefix(options: SplitOptions): string {
    const parts: string[] = [];
    if (options.relayUrl) parts.push(`MUX_RELAY_URL="${options.relayUrl}"`);
    if (options.workspace) parts.push(`MUX_WORKSPACE="${options.workspace}"`);
    if (options.userName)  parts.push(`MUX_AGENT_NAME="${options.userName}'s Agent"`);
    if (options.workspace) parts.push(`MUX_AGENT_PROVIDER="${options.agent || "agy"}"`);
    return parts.length > 0 ? parts.join(" ") + " " : "";
  }

  public static launch(options: SplitOptions): void {
    const cwd = options.targetDir || process.cwd();
    const agentBase = this.resolveAgentCommand(options.agent, options.agentCmd);
    const envPrefix = this.buildEnvPrefix(options);
    // Wrap the agent command with env vars so MCP inherits them
    const agentCmd = envPrefix ? `env ${envPrefix} ${agentBase}` : agentBase;
    const muxCmd = options.muxCommand;
    const isVertical = options.direction !== "horizontal";

    console.log(chalk.cyan.bold("\n🚀 mux Split-Pane Multiplexer"));
    console.log(chalk.gray(`   Working Dir:    ${cwd}`));
    console.log(chalk.gray(`   Agent Pane:     ${agentBase}`));
    console.log(chalk.gray(`   Relay:          ${options.relayUrl || "ws://localhost:7331"}`));
    console.log(chalk.gray(`   Workspace:      ${options.workspace || "default"}`));
    console.log(chalk.gray(`   Collab TUI:     ${muxCmd}`));
    console.log("");

    // Case 1: Already inside an active tmux session — just split current window
    if (this.isInsideTmux()) {
      console.log(chalk.green("Detected active tmux session. Splitting current window..."));
      const splitFlag = isVertical ? "-h" : "-v";
      // Right pane: mux collab TUI
      spawnSync("tmux", ["split-window", splitFlag, "-c", cwd, muxCmd], {
        stdio: "inherit",
      });
      // Current (left) pane: agent with env vars
      spawnSync(agentCmd, { shell: true, cwd, stdio: "inherit" });
      return;
    }

    // Case 2: tmux is installed — create a fresh session with two panes
    if (this.isTmuxInstalled()) {
      const sessionName = `mux-${Date.now().toString(36)}`;
      console.log(chalk.green(`Creating tmux session: ${sessionName}...`));

      // Pane 0 (left): agent with MUX_* env vars injected
      spawnSync(
        "tmux",
        ["new-session", "-d", "-s", sessionName, "-c", cwd, agentCmd],
        { stdio: "pipe" }
      );

      // Enable mouse support for easy pane switching
      spawnSync("tmux", ["set-option", "-t", sessionName, "mouse", "on"], { stdio: "pipe" });

      // Pane 1 (right): mux collab TUI
      const splitFlag = isVertical ? "-h" : "-v";
      spawnSync(
        "tmux",
        ["split-window", splitFlag, "-t", `${sessionName}:0`, "-c", cwd, muxCmd],
        { stdio: "pipe" }
      );

      // Set a nice status bar hint
      spawnSync("tmux", [
        "set-option", "-t", sessionName, "status-right",
        `#[fg=cyan]mux:${options.workspace || "default"} #[fg=green]● relay:${options.relayUrl || "ws://localhost:7331"}`,
      ], { stdio: "pipe" });

      // Focus the agent pane (left) by default
      spawnSync("tmux", ["select-pane", "-t", `${sessionName}:0.0`], { stdio: "pipe" });

      console.log(chalk.gray(
        `Pane LEFT: ${agentBase} (with MUX env) │ Pane RIGHT: mux collab TUI │ Switch: Ctrl+b ←/→`
      ));

      // Attach current terminal to the session
      const attach = spawn("tmux", ["attach-session", "-t", sessionName], {
        stdio: "inherit",
      });

      attach.on("exit", (code) => {
        process.exit(code ?? 0);
      });
      return;
    }

    // Case 3: macOS without tmux — open agent in new Terminal window
    if (os.platform() === "darwin") {
      console.log(chalk.yellow("tmux is not currently installed."));
      console.log(chalk.cyan("Launching agent in a new macOS Terminal window..."));

      try {
        const appleScript = `
          tell application "Terminal"
            do script "cd \\"${cwd}\\" && ${agentCmd}"
            activate
          end tell
        `;
        spawnSync("osascript", ["-e", appleScript], { stdio: "pipe" });
        console.log(chalk.green("Agent window opened."));
      } catch (err: any) {
        console.warn(chalk.yellow(`Could not open companion window: ${err.message}`));
      }

      console.log(chalk.gray("Starting mux collab TUI in current terminal...\n"));
      const res = spawnSync(muxCmd, { shell: true, cwd, stdio: "inherit" });
      process.exit(res.status ?? 0);
    }

    // Fallback — print install instructions for tmux
    console.log(chalk.yellow("\n⚠️  tmux is recommended for seamless side-by-side split terminals."));
    if (os.platform() === "darwin") {
      console.log(chalk.cyan("Install tmux on macOS:"));
      console.log(chalk.bold("   brew install tmux\n"));
    } else {
      console.log(chalk.cyan("Install tmux on Linux:"));
      console.log(chalk.bold("   sudo apt-get install tmux\n"));
    }
    console.log(chalk.gray("Starting mux collab TUI in current window..."));
    const res = spawnSync(muxCmd, { shell: true, cwd, stdio: "inherit" });
    process.exit(res.status ?? 0);
  }
}

