import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
    vi.doUnmock("node:child_process");
    vi.unstubAllEnvs();
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

  it("runs replyable Telegram sends through the gateway script entrypoint", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    const parsePromise = program.parseAsync(
      [
        "gateway",
        "telegram",
        "send",
        "--thread-id",
        "thread-source",
        "--session-id",
        "session-source",
        "--text",
        "Approve?",
        "--title",
        "Approval request",
      ],
      { from: "user" },
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("node_modules/.bin/tsx"),
      [
        "scripts/telegram-gateway.ts",
        "--send",
        "--thread-id",
        "thread-source",
        "--session-id",
        "session-source",
        "--text",
        "Approve?",
        "--title",
        "Approval request",
        "--parse-mode",
        "none",
      ],
      expect.objectContaining({ cwd: process.cwd(), stdio: "inherit" }),
    );
  });

  it("passes explicit Telegram document sends through the gateway script entrypoint", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    const parsePromise = program.parseAsync(
      [
        "gateway",
        "telegram",
        "send",
        "--thread-id",
        "thread-source",
        "--document",
        "/tmp/plan.md",
        "--text",
        "Plan attached",
      ],
      { from: "user" },
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("node_modules/.bin/tsx"),
      [
        "scripts/telegram-gateway.ts",
        "--send",
        "--thread-id",
        "thread-source",
        "--text",
        "Plan attached",
        "--document",
        "/tmp/plan.md",
        "--parse-mode",
        "none",
      ],
      expect.objectContaining({ cwd: process.cwd(), stdio: "inherit" }),
    );
  });

  it("runs Phone Chaser review binding through the gateway script entrypoint", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    const parsePromise = program.parseAsync(
      [
        "gateway",
        "telegram",
        "review-bind",
        "--thread-id",
        "thread-source",
        "--title",
        "Review request",
        "--ttl-minutes",
        "15",
      ],
      { from: "user" },
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("node_modules/.bin/tsx"),
      [
        "scripts/telegram-gateway.ts",
        "review-bind",
        "--thread-id",
        "thread-source",
        "--title",
        "Review request",
        "--ttl-minutes",
        "15",
      ],
      expect.objectContaining({ cwd: process.cwd(), stdio: "inherit" }),
    );
  });

  it("runs the Phone Chaser review relay through the gateway script entrypoint", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    const parsePromise = program.parseAsync(
      ["gateway", "telegram", "review-relay", "--port", "8790"],
      { from: "user" },
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("node_modules/.bin/tsx"),
      ["scripts/telegram-gateway.ts", "review-relay", "--port", "8790"],
      expect.objectContaining({ cwd: process.cwd(), stdio: "inherit" }),
    );
  });

  it("installs Telegram daemon LaunchAgent files from the CLI", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "farplane-telegram-daemon-"));
    vi.stubEnv("HOME", home);
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    await program.parseAsync(["gateway", "telegram", "daemon", "install"], { from: "user" });

    const runnerPath = path.join(home, ".farplane", "telegram-gateway", "run-gateway.sh");
    const plistPath = path.join(home, "Library", "LaunchAgents", "com.farplane.telegram-gateway.plist");
    const runner = await readFile(runnerPath, "utf8");
    const plist = await readFile(plistPath, "utf8");
    const runnerStat = await stat(runnerPath);

    expect(runner).toContain("gateway telegram");
    expect(plist).toContain("com.farplane.telegram-gateway");
    expect(runnerStat.mode & 0o700).toBe(0o700);

    await rm(home, { recursive: true, force: true });
  });

  it("restarts the Telegram daemon through launchctl", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "farplane-telegram-daemon-"));
    vi.stubEnv("HOME", home);
    const spawnMock = vi.fn(() => {
      const child = new MockChild();
      queueMicrotask(() => child.emit("exit", 0, null));
      return child;
    });
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerGatewayCommands } = await import("./gateway-commands.js");

    const program = new Command();
    registerGatewayCommands(program);
    await program.parseAsync(["gateway", "telegram", "daemon", "restart"], { from: "user" });

    expect(spawnMock).toHaveBeenCalledWith("plutil", expect.arrayContaining(["-lint"]), expect.any(Object));
    expect(spawnMock).toHaveBeenCalledWith(
      "launchctl",
      expect.arrayContaining(["bootout", expect.stringMatching(/^gui\//)]),
      expect.any(Object),
    );
    expect(spawnMock).toHaveBeenCalledWith(
      "launchctl",
      expect.arrayContaining(["bootstrap", expect.stringMatching(/^gui\//)]),
      expect.any(Object),
    );
    expect(spawnMock).toHaveBeenCalledWith(
      "launchctl",
      expect.arrayContaining(["kickstart", "-k", expect.stringContaining("com.farplane.telegram-gateway")]),
      expect.any(Object),
    );

    await rm(home, { recursive: true, force: true });
  });
});
