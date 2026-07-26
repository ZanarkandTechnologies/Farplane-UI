import { EventEmitter } from "node:events";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

class MockChild extends EventEmitter {
  stdout = null;
  stderr = null;
  stdin = null;
}

describe("ui CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("runs the shared repo-local UI launcher", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerUiCommands } = await import("./ui-commands.js");

    const program = new Command();
    registerUiCommands(program);
    const parsePromise = program.parseAsync(["ui"], { from: "user" });
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringMatching(/scripts[\\/]run-ui\.mjs$/)],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: "inherit",
      }),
    );
  });

  it("does not re-signal the parent when launched in onboarding handoff mode", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
    const { startUiDevServer } = await import("./ui-commands.js");

    const startPromise = startUiDevServer({ cwd: "/tmp/farplane-ui", propagateSignal: false });
    child.emit("exit", null, "SIGINT");
    await startPromise;

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringMatching(/scripts[\\/]run-ui\.mjs$/)],
      expect.objectContaining({
        cwd: "/tmp/farplane-ui",
        stdio: "inherit",
      }),
    );
    expect(killSpy).not.toHaveBeenCalled();
  });

  it("forwards Vite flags after the command separator", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerUiCommands } = await import("./ui-commands.js");

    const program = new Command();
    registerUiCommands(program);
    const parsePromise = program.parseAsync(
      ["ui", "--", "--host", "127.0.0.1", "--port", "5999"],
      { from: "user" },
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [
        expect.stringMatching(/scripts[\\/]run-ui\.mjs$/),
        "--host",
        "127.0.0.1",
        "--port",
        "5999",
      ],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("uses the Node launcher directly on Windows", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    vi.stubGlobal("process", {
      ...process,
      platform: "win32",
    });
    const { startUiDevServer } = await import("./ui-commands.js");

    const startPromise = startUiDevServer({ cwd: "C:/farplane-ui", propagateSignal: false });
    child.emit("exit", 0, null);
    await startPromise;

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringMatching(/scripts[\\/]run-ui\.mjs$/)],
      expect.objectContaining({
        cwd: "C:/farplane-ui",
        stdio: "inherit",
      }),
    );
  });
});
