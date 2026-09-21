import { EventEmitter } from "node:events";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import {
  registerYoutubeExtensionCommands,
  startYoutubeExtensionRuntime,
  stopYoutubeExtensionRuntime,
  type YoutubeBridgeHealth,
  type YoutubeRuntimeRecord,
  type YoutubeRuntimeStore,
} from "./youtube-extension-commands.js";

class MockChild extends EventEmitter {
  constructor(readonly pid: number) {
    super();
  }

  kill = vi.fn();
}

function readyHealth(runtimeToken?: string): YoutubeBridgeHealth {
  return {
    ok: true,
    service: true,
    runtime: "farplane-youtube-shortcut",
    appServer: true,
    authentication: "ready",
    intelligestSkill: true,
    ...(runtimeToken ? { runtimeToken } : {}),
  };
}

function memoryStore(
  initial?: YoutubeRuntimeRecord,
): YoutubeRuntimeStore & { current?: YoutubeRuntimeRecord } {
  let current = initial;
  return {
    path: "/tmp/farplane/youtube-shortcut/runtime.json",
    get current() {
      return current;
    },
    async read() {
      return current;
    },
    async write(record) {
      current = record;
    },
    async remove() {
      current = undefined;
    },
  };
}

describe("YouTube extension runtime CLI", () => {
  it("attaches to a healthy bridge without starting duplicate processes", async () => {
    const spawnProcess = vi.fn();
    const operation = await startYoutubeExtensionRuntime({
      probeBridge: async () => ({ state: "ready", health: readyHealth() }),
      spawnProcess,
      runtimeStore: memoryStore(),
    });

    expect(operation.result).toMatchObject({ outcome: "attached", ready: true });
    expect(operation.ownedChildren).toEqual([]);
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("attaches to a ready pre-runtime-token bridge without claiming ownership", async () => {
    const spawnProcess = vi.fn();
    const legacyHealth = readyHealth();
    delete legacyHealth.runtime;
    const operation = await startYoutubeExtensionRuntime({
      probeBridge: async () => ({ state: "ready", health: legacyHealth }),
      spawnProcess,
      runtimeStore: memoryStore(),
    });

    expect(operation.result).toMatchObject({ outcome: "attached", ready: true });
    expect(operation.runtimeRecord).toBeUndefined();
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("starts missing services, verifies the per-launch bridge identity, and records its listener PID", async () => {
    const appChild = new MockChild(4101);
    const bridgeChild = new MockChild(4102);
    const spawnProcess = vi.fn().mockReturnValueOnce(appChild).mockReturnValueOnce(bridgeChild);
    const store = memoryStore();
    let probeCalls = 0;

    const operation = await startYoutubeExtensionRuntime({
      probeBridge: async (token) => {
        probeCalls += 1;
        if (probeCalls === 1) return { state: "absent" };
        if (token === "test-runtime-token") return { state: "ready", health: readyHealth(token) };
        return { state: "ready", health: readyHealth() };
      },
      isAppServerListening: async () => false,
      findListeningPid: async () => 8123,
      spawnProcess: spawnProcess as never,
      runtimeStore: store,
      randomToken: () => "test-runtime-token",
      now: () => Date.parse("2026-08-25T00:00:00.000Z"),
      sleep: async () => undefined,
    });

    expect(operation.result).toMatchObject({ outcome: "started", ready: true });
    expect(spawnProcess).toHaveBeenNthCalledWith(
      1,
      "codex",
      ["app-server", "--listen", "ws://127.0.0.1:47892"],
      expect.objectContaining({ cwd: expect.any(String) }),
    );
    expect(spawnProcess).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^pnpm/),
      ["--filter", "@farplane/youtube-shortcut", "exec", "tsx", "scripts/local-agent.ts"],
      expect.objectContaining({
        env: expect.objectContaining({ FARPLANE_YOUTUBE_RUNTIME_TOKEN: "test-runtime-token" }),
      }),
    );
    expect(store.current).toMatchObject({ bridgePid: 8123, runtimeToken: "test-runtime-token" });
  });

  it.each([
    { state: "conflict" as const, reason: "unknown_service" as const },
    { state: "unready" as const, health: { ...readyHealth(), appServer: false } },
  ])("reports a $state bridge safely without trying to replace it", async (probe) => {
    const spawnProcess = vi.fn();
    const operation = await startYoutubeExtensionRuntime({
      probeBridge: async () => probe,
      spawnProcess,
      runtimeStore: memoryStore(),
    });

    expect(operation.result).toMatchObject({ outcome: "conflict", ready: false });
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("does not signal a bridge when the listening PID differs from the owned record", async () => {
    const signalProcess = vi.fn();
    const record: YoutubeRuntimeRecord = {
      schemaVersion: 1,
      bridgePid: 8123,
      runtimeToken: "test-runtime-token-which-is-long-enough",
      startedAt: "2026-08-25T00:00:00.000Z",
    };

    const result = await stopYoutubeExtensionRuntime({
      runtimeStore: memoryStore(record),
      findListeningPid: async () => 9999,
      probeBridge: async () => ({ state: "ready", health: readyHealth(record.runtimeToken) }),
      signalProcess,
    });

    expect(result).toMatchObject({ outcome: "identity_mismatch", reason: "listener_pid_mismatch" });
    expect(signalProcess).not.toHaveBeenCalled();
  });

  it("does not signal a bridge when the record token cannot authenticate its health response", async () => {
    const signalProcess = vi.fn();
    const record: YoutubeRuntimeRecord = {
      schemaVersion: 1,
      bridgePid: 8123,
      runtimeToken: "test-runtime-token-which-is-long-enough",
      startedAt: "2026-08-25T00:00:00.000Z",
    };

    const result = await stopYoutubeExtensionRuntime({
      runtimeStore: memoryStore(record),
      findListeningPid: async () => 8123,
      probeBridge: async () => ({ state: "ready", health: readyHealth("another-runtime-token") }),
      signalProcess,
    });

    expect(result).toMatchObject({
      outcome: "identity_mismatch",
      reason: "runtime_token_mismatch",
    });
    expect(signalProcess).not.toHaveBeenCalled();
  });

  it("registers the exact extension youtube action grammar", () => {
    const program = new Command();
    registerYoutubeExtensionCommands(program);

    const extension = program.commands.find((command) => command.name() === "extension");
    const youtube = extension?.commands.find((command) => command.name() === "youtube");
    expect(youtube?.name()).toBe("youtube");
    expect(youtube?.usage()).toContain("<action>");
    expect(youtube?.options.some((option) => option.long === "--json")).toBe(true);
  });
});
