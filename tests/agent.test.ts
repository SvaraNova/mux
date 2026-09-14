import { describe, it, expect } from "vitest";
import { AgyProcessAdapter } from "../apps/cli/src/agent/AgyProcessAdapter.js";

describe("AgyProcessAdapter", () => {
  it("initializes with target directory and idle status", () => {
    const adapter = new AgyProcessAdapter({
      targetDir: ".",
      name: "agy",
    });

    expect(adapter.status).toBe("idle");
    expect(adapter.currentTask).toBeNull();
    expect(adapter.name).toBe("agy");
  });

  it("emits log events when prompt is dispatched", async () => {
    const adapter = new AgyProcessAdapter({
      targetDir: ".",
      name: "agy",
    });

    const logs: any[] = [];
    adapter.on("log", (l) => logs.push(l));

    adapter.send("test prompt");
    expect(adapter.status).toBe("working");
    expect(adapter.currentTask).toBe("test prompt");
    expect(logs.some((l) => l.text.includes("test prompt"))).toBe(true);

    adapter.stop();
    expect(adapter.status).toBe("idle");
  });
});
