import { EventEmitter } from "node:events";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

class MockChild extends EventEmitter {
  stdout = null;
  stderr = null;
  stdin = null;
}

describe("gateway CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("runs the Telegram gateway through the CLI adapter entrypoint", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    const parsePromise = program.parseAsync(
      ["gateway", "telegram", "--once", "--check-config"],
      { from: "user" },
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("node_modules/.bin/tsx"),
      ["scripts/telegram-gateway.ts", "--once", "--check-config"],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: "inherit",
      }),
    );
  });
});
