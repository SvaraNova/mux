import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export type AgentStatus = "idle" | "working" | "error" | "offline";

export interface AgentLogLine {
  id: string;
  type: "stdout" | "stderr" | "system" | "prompt";
  text: string;
  timestamp: string;
}

export interface AgentAdapterOptions {
  agentId?: string;
  name?: string;
  targetDir: string;
}

export class AgyProcessAdapter extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly targetDir: string;
  private currentProcess: ChildProcessWithoutNullStreams | null = null;
  private _status: AgentStatus = "idle";
  private _currentTask: string | null = null;
  private binaryPath: string = "agy";

  constructor(options: AgentAdapterOptions) {
    super();
    this.id = options.agentId || `agy-${os.userInfo().username || "dev"}`;
    this.name = options.name || "agy";
    this.targetDir = path.resolve(options.targetDir);
    this.locateBinary();
  }

  private locateBinary(): void {
    // Check ~/.local/bin/agy first if in PATH or local
    const localBinAgy = path.join(os.homedir(), ".local", "bin", "agy");
    if (fs.existsSync(localBinAgy)) {
      this.binaryPath = localBinAgy;
    } else {
      this.binaryPath = "agy";
    }
  }

  get status(): AgentStatus {
    return this._status;
  }

  get currentTask(): string | null {
    return this._currentTask;
  }

  private setStatus(status: AgentStatus, task?: string | null): void {
    this._status = status;
    this._currentTask = task !== undefined ? task : this._currentTask;
    this.emit("status", { status: this._status, task: this._currentTask });
  }

  send(prompt: string): void {
    if (this._status === "working") {
      this.emit("log", {
        id: crypto.randomUUID(),
        type: "system",
        text: "Agent is currently busy with another task. Please wait...",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const timestamp = new Date().toISOString();
    this.emit("log", {
      id: crypto.randomUUID(),
      type: "prompt",
      text: `> ${prompt}`,
      timestamp,
    });

    this.setStatus("working", prompt);

    try {
      const childEnv = {
        ...process.env,
        PATH: `${path.join(os.homedir(), ".local", "bin")}:${process.env.PATH || ""}`,
      };

      this.currentProcess = spawn(this.binaryPath, ["-p", prompt], {
        cwd: this.targetDir,
        env: childEnv,
      });

      this.currentProcess.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            this.emit("log", {
              id: crypto.randomUUID(),
              type: "stdout",
              text: line,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });

      this.currentProcess.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            this.emit("log", {
              id: crypto.randomUUID(),
              type: "stderr",
              text: line,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });

      this.currentProcess.on("close", (code: number) => {
        this.currentProcess = null;
        if (code === 0) {
          this.emit("log", {
            id: crypto.randomUUID(),
            type: "system",
            text: `✓ Task completed by ${this.name}`,
            timestamp: new Date().toISOString(),
          });
          this.setStatus("idle", null);
        } else {
          this.emit("log", {
            id: crypto.randomUUID(),
            type: "system",
            text: `⚠ ${this.name} exited with code ${code}`,
            timestamp: new Date().toISOString(),
          });
          this.setStatus("error", null);
        }
      });

      this.currentProcess.on("error", (err: Error) => {
        this.currentProcess = null;
        this.emit("log", {
          id: crypto.randomUUID(),
          type: "system",
          text: `Failed to spawn ${this.name}: ${err.message}`,
          timestamp: new Date().toISOString(),
        });
        this.setStatus("error", null);
      });
    } catch (err: any) {
      this.setStatus("error", null);
      this.emit("log", {
        id: crypto.randomUUID(),
        type: "system",
        text: `Error executing ${this.name}: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
      this.setStatus("idle", null);
      this.emit("log", {
        id: crypto.randomUUID(),
        type: "system",
        text: `Stopped ${this.name} process.`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
