import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import type {
  AgentAdapter,
  AgentAdapterOptions,
  AgentLogLine,
  AgentProvider,
  AgentStatus,
} from "./types.js";

export abstract class BaseProcessAdapter extends EventEmitter implements AgentAdapter {
  public abstract readonly provider: AgentProvider;
  public readonly id: string;
  public readonly name: string;
  public readonly targetDir: string;
  protected currentProcess: ChildProcessWithoutNullStreams | null = null;
  protected _status: AgentStatus = "idle";
  protected _currentTask: string | null = null;

  constructor(options: AgentAdapterOptions) {
    super();
    this.id = options.agentId || `agent-${crypto.randomBytes(3).toString("hex")}`;
    this.name = options.name || this.constructor.name;
    this.targetDir = path.resolve(options.targetDir);
  }

  get status(): AgentStatus {
    return this._status;
  }

  get currentTask(): string | null {
    return this._currentTask;
  }

  protected abstract getBinaryName(): string;
  protected abstract buildArguments(prompt: string): string[];
  protected abstract buildInteractiveArguments(prompt?: string): string[];

  /**
   * Resolve binary executable path across standard user PATH and local bin dirs.
   */
  public resolveBinary(): string | null {
    const binName = this.getBinaryName();
    const candidateDirs = [
      path.join(os.homedir(), ".local", "bin"),
      path.join(os.homedir(), ".antigravity", "bin"),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ];

    // If env PATH has directories, check them too
    const pathDirs = (process.env.PATH || "").split(path.delimiter);
    const allDirs = Array.from(new Set([...candidateDirs, ...pathDirs]));

    for (const dir of allDirs) {
      if (!dir) continue;
      const fullPath = path.join(dir, binName);
      try {
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            return fullPath;
          }
        }
      } catch {
        // ignore access errors
      }
    }

    return null;
  }

  public isAvailable(): boolean {
    return this.resolveBinary() !== null;
  }

  protected setStatus(status: AgentStatus, task?: string | null): void {
    this._status = status;
    this._currentTask = task !== undefined ? task : this._currentTask;
    this.emit("status", {
      status: this._status,
      task: this._currentTask,
      provider: this.provider,
    });
  }

  protected emitLog(type: AgentLogLine["type"], text: string): void {
    const log: AgentLogLine = {
      id: crypto.randomUUID(),
      type,
      text,
      timestamp: new Date().toISOString(),
      provider: this.provider,
    };
    this.emit("log", log);
  }

  public send(prompt: string): void {
    if (this._status === "working") {
      this.emitLog("system", `Agent "${this.name}" (${this.provider}) is currently busy. Please wait...`);
      return;
    }

    const binaryPath = this.resolveBinary();
    if (!binaryPath) {
      this.setStatus("error", null);
      this.emitLog(
        "system",
        `⚠ Binary "${this.getBinaryName()}" for agent provider "${this.provider}" not found in PATH or ~/.local/bin.`
      );
      this.emitLog(
        "system",
        `Tip: Make sure "${this.getBinaryName()}" is installed, or switch to another agent (e.g. /agent use agy).`
      );
      return;
    }

    this.emitLog("prompt", `[${this.provider}] > ${prompt}`);
    this.setStatus("working", prompt);

    try {
      const childEnv = {
        ...process.env,
        PATH: `${path.join(os.homedir(), ".local", "bin")}:${process.env.PATH || ""}`,
      };

      const args = this.buildArguments(prompt);
      this.currentProcess = spawn(binaryPath, args, {
        cwd: this.targetDir,
        env: childEnv,
      });

      this.currentProcess.stdout.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            this.emitLog("stdout", line);
          }
        }
      });

      this.currentProcess.stderr.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            this.emitLog("stderr", line);
          }
        }
      });

      this.currentProcess.on("close", (code: number) => {
        this.currentProcess = null;
        if (code === 0) {
          this.emitLog("system", `✓ Task completed by ${this.name} (${this.provider})`);
          this.setStatus("idle", null);
        } else {
          this.emitLog("system", `⚠ ${this.name} (${this.provider}) exited with code ${code}`);
          this.setStatus("error", null);
        }
      });

      this.currentProcess.on("error", (err: Error) => {
        this.currentProcess = null;
        this.emitLog("system", `Failed to execute ${this.name}: ${err.message}`);
        this.setStatus("error", null);
      });
    } catch (err: any) {
      this.currentProcess = null;
      this.setStatus("error", null);
      this.emitLog("system", `Error spawning ${this.name}: ${err.message}`);
    }
  }

  public launchInteractive(prompt?: string): number {
    const binaryPath = this.resolveBinary();
    if (!binaryPath) {
      this.setStatus("error", null);
      this.emitLog(
        "system",
        `⚠ Binary "${this.getBinaryName()}" for provider "${this.provider}" not found in PATH or ~/.local/bin.`
      );
      this.emitLog(
        "system",
        `Tip: Make sure "${this.getBinaryName()}" is installed, or switch agent with /agent use <provider>.`
      );
      return -1;
    }

    const args = this.buildInteractiveArguments(prompt);
    const taskName = prompt ? `"${prompt}"` : `Interactive Shell`;
    this.setStatus("working", taskName);

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {
        // ignore
      }
    }

    // Clear terminal screen before launching interactive session
    process.stdout.write("\x1b[2J\x1b[0f");

    const childEnv = {
      ...process.env,
      PATH: `${path.join(os.homedir(), ".local", "bin")}:${process.env.PATH || ""}`,
    };

    let exitCode = 0;
    try {
      const result = spawnSync(binaryPath, args, {
        cwd: this.targetDir,
        stdio: "inherit",
        env: childEnv,
      });
      exitCode = result.status ?? 0;
    } catch (err: any) {
      exitCode = 1;
      this.emitLog("system", `Failed to launch ${this.name}: ${err.message}`);
    } finally {
      if (process.stdin.isTTY) {
        try {
          process.stdin.resume();
          if (wasRaw) {
            process.stdin.setRawMode(true);
          }
        } catch {
          // ignore
        }
      }
      process.stdout.write("\x1b[2J\x1b[0f");
    }

    this.setStatus("idle", null);
    if (exitCode === 0) {
      this.emitLog("system", `✓ Closed interactive ${this.name} (${this.provider}) session.`);
    } else {
      this.emitLog("system", `⚠ ${this.name} (${this.provider}) exited with code ${exitCode}.`);
    }

    return exitCode;
  }

  public stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
      this.setStatus("idle", null);
      this.emitLog("system", `Stopped ${this.name} (${this.provider}) process.`);
    }
  }
}
