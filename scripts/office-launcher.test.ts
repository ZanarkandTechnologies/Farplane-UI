import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { launchOffice } from "./office-launcher.mjs";

function child() {
  return Object.assign(new EventEmitter(), { kill: vi.fn(), exitCode: null, signalCode: null });
}
function fixture(office = "absent", owned = true) {
  const bridge = child();
  const vite = child();
  const operation = { result: { ready: true, outcome: owned ? "started" : "attached" }, ownedChildren: owned ? [{ child: bridge, kind: "bridge" }] : [] };
  const deps = {
    startRuntime: vi.fn(async () => operation), releaseRuntime: vi.fn(async () => {}),
    probeOffice: vi.fn(async () => office), startVite: vi.fn(() => vite),
    signals: new EventEmitter(), log: vi.fn(), error: vi.fn(),
  };
  return { deps, bridge, vite, operation };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe("one-command office lifecycle", () => {
  it("starts services before Vite and cleans owned services on Ctrl+C", async () => {
    const { deps, operation, vite } = fixture();
    const running = launchOffice(deps);
    await tick();
    expect(deps.startRuntime.mock.invocationCallOrder[0]).toBeLessThan(deps.startVite.mock.invocationCallOrder[0]);
    deps.signals.emit("SIGINT");
    expect(await running).toBe(130);
    expect(vite.kill).toHaveBeenCalledWith("SIGTERM");
    expect(deps.releaseRuntime).toHaveBeenCalledWith(operation);
    expect(deps.signals.listenerCount("SIGINT")).toBe(0);
  });
  it("reuses an existing office and runtime without spawning Vite", async () => {
    const { deps } = fixture("ready", false);
    expect(await launchOffice(deps)).toBe(0);
    expect(deps.startVite).not.toHaveBeenCalled();
  });
  it("keeps newly owned services foreground when reusing the office", async () => {
    const { deps } = fixture("ready");
    let done = false;
    const running = launchOffice(deps).then((code) => { done = true; return code; });
    await tick();
    expect(done).toBe(false);
    expect(deps.startVite).not.toHaveBeenCalled();
    deps.signals.emit("SIGTERM");
    expect(await running).toBe(143);
  });
  it.each(["conflict", "unconfigured"])("does not start dependencies for a %s office", async (state) => {
    const { deps } = fixture(state);
    expect(await launchOffice(deps)).toBe(1);
    expect(deps.startRuntime).not.toHaveBeenCalled();
  });
  it("blocks office readiness if analysis services failed", async () => {
    const { deps, operation } = fixture();
    operation.result.ready = false;
    expect(await launchOffice(deps)).toBe(1);
    expect(deps.startVite).not.toHaveBeenCalled();
    expect(deps.releaseRuntime).toHaveBeenCalledWith(operation);
  });
  it("cleans up when an owned runtime child exits", async () => {
    const { deps, bridge, vite } = fixture();
    const running = launchOffice(deps);
    await tick();
    bridge.emit("exit", 1);
    expect(await running).toBe(1);
    expect(vite.kill).toHaveBeenCalled();
  });
  it("handles cancellation while dependencies are still starting", async () => {
    const { deps, operation } = fixture();
    let release!: () => void;
    deps.startRuntime.mockImplementation(async ({ signal }) => {
      await new Promise<void>((resolve) => { release = resolve; });
      expect(signal.aborted).toBe(true);
      return operation;
    });
    const running = launchOffice(deps);
    await tick();
    deps.signals.emit("SIGINT");
    release();
    expect(await running).toBe(130);
    expect(deps.startVite).not.toHaveBeenCalled();
    expect(deps.releaseRuntime).toHaveBeenCalledWith(operation);
  });
  it("continues the same command after interactive sign-in", async () => {
    const { deps, operation } = fixture("ready", false);
    deps.startRuntime.mockResolvedValueOnce({ result: { ready: false, reason: "codex_sign_in_required" }, ownedChildren: [] });
    const signIn = vi.fn(async () => {});
    expect(await launchOffice({ ...deps, signIn })).toBe(0);
    expect(signIn).toHaveBeenCalledOnce();
    expect(deps.startRuntime).toHaveBeenCalledTimes(2);
    expect(deps.releaseRuntime).toHaveBeenCalledWith(operation);
  });
});
