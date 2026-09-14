import { spawn, spawnSync, execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";

export interface SplitOptions {
  agent?: string; // "agy" | "claude" | "codex"
  agentCmd?: string; // custom command
  direction?: "horizontal" | "vertical"; // default vertical (side-by-side)
  muxCommand: string; // the mux host or join command to run
  targetDir?: string;
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

  public static launch(options: SplitOptions): void {
    const cwd = options.targetDir || process.cwd();
    const agentCmd = this.resolveAgentCommand(options.agent, options.agentCmd);
    const muxCmd = options.muxCommand;
    const isVertical = options.direction !== "horizontal";

    console.log(chalk.cyan.bold("\n🚀 mux Split-Pane Multiplexer"));
    console.log(chalk.gray(`   Working Dir:  ${cwd}`));
    console.log(chalk.gray(`   Agent Pane:   ${agentCmd}`));
    console.log(chalk.gray(`   Mux TUI Pane: ${muxCmd}`));
    console.log("");

    // Case 1: Already inside an active tmux session
    if (this.isInsideTmux()) {
      console.log(chalk.green("Detected active tmux session. Splitting current window..."));
      const splitFlag = isVertical ? "-h" : "-v";
      // Split current window and run mux in the new pane
      spawnSync("tmux", ["split-window", splitFlag, "-c", cwd, muxCmd], {
        stdio: "inherit",
      });
      // In current pane, execute agent
      spawnSync(agentCmd, { shell: true, cwd, stdio: "inherit" });
      return;
    }

    // Case 2: tmux is installed on system
    if (this.isTmuxInstalled()) {
      const sessionName = `mux-${Date.now().toString(36)}`;
      console.log(chalk.green(`Creating tmux session: ${sessionName}...`));

      // 1. Create detached session running agent in Pane 0
      spawnSync(
        "tmux",
        ["new-session", "-d", "-s", sessionName, "-c", cwd, agentCmd],
        { stdio: "pipe" }
      );

      // 2. Enable mouse support so user can easily scroll & click between panes
      spawnSync("tmux", ["set-option", "-t", sessionName, "mouse", "on"], { stdio: "pipe" });

      // 3. Split window side-by-side or stacked running mux TUI in Pane 1
      const splitFlag = isVertical ? "-h" : "-v";
      spawnSync(
        "tmux",
        ["split-window", splitFlag, "-t", `${sessionName}:0`, "-c", cwd, muxCmd],
        { stdio: "pipe" }
      );

      // 4. Select the agent pane (Pane 0) by default
      spawnSync("tmux", ["select-pane", "-t", `${sessionName}:0.0`], { stdio: "pipe" });

      // 5. Attach user's terminal to the new tmux session
      console.log(
        chalk.gray("Pane 0: Interactive Agent │ Pane 1: Team Mux TUI │ Switch panes: Ctrl+b then arrows")
      );
      const attach = spawn("tmux", ["attach-session", "-t", sessionName], {
        stdio: "inherit",
      });

      attach.on("exit", (code) => {
        process.exit(code ?? 0);
      });
      return;
    }

    // Case 3: macOS without tmux
    if (os.platform() === "darwin") {
      console.log(chalk.yellow("tmux is not currently installed."));
      console.log(chalk.cyan("Launching companion agent window side-by-side via macOS Terminal..."));

      try {
        const appleScript = `
          tell application "Terminal"
            do script "cd \\"${cwd}\\" && ${agentCmd}"
            activate
          end tell
        `;
        spawnSync("osascript", ["-e", appleScript], { stdio: "pipe" });
        console.log(chalk.green("Companion window opened for " + agentCmd));
      } catch (err: any) {
        console.warn(chalk.yellow(`Could not launch companion window: ${err.message}`));
      }

      console.log(chalk.gray("Starting mux in current terminal...\n"));
      const res = spawnSync(muxCmd, { shell: true, cwd, stdio: "inherit" });
      process.exit(res.status ?? 0);
    }

    // Fallback: Instructions on installing tmux
    console.log(chalk.yellow("\n⚠️  tmux is recommended for seamless side-by-side split terminals."));
    if (os.platform() === "darwin") {
      console.log(chalk.cyan("To install tmux on macOS:"));
      console.log(chalk.bold("   brew install tmux\n"));
    } else {
      console.log(chalk.cyan("To install tmux on Linux:"));
      console.log(chalk.bold("   sudo apt-get install tmux\n"));
    }
    console.log(chalk.gray("Starting mux in current window directly..."));
    const res = spawnSync(muxCmd, { shell: true, cwd, stdio: "inherit" });
    process.exit(res.status ?? 0);
  }
}
