import { afterEach, describe, expect, it, vi } from "vitest";
import { probeYoutubeBridge } from "./youtube-extension-runtime-contract.js";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("analysis readiness includes authentication", () => {
  it.each(["required", "unavailable", undefined])("rejects transport-only health with auth %s", async (authentication) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, service: true, appServer: true, intelligestSkill: true, authentication })));
    expect((await probeYoutubeBridge()).state).toBe("unready");
  });
  it("allows authenticated readiness to take longer than the old five-second budget", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      await new Promise<void>((resolve, reject) => {
        setTimeout(resolve, 6000);
        options.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
      return Response.json({ ok: true, service: true, appServer: true, intelligestSkill: true, authentication: "ready" });
    }));
    const result = probeYoutubeBridge();
    await vi.advanceTimersByTimeAsync(6000);
    expect((await result).state).toBe("ready");
  });
  it("requests an explicit refresh and accepts proven auth readiness", async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true, service: true, appServer: true, intelligestSkill: true, authentication: "ready" }));
    vi.stubGlobal("fetch", fetch);
    expect((await probeYoutubeBridge()).state).toBe("ready");
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ "x-farplane-auth-refresh": "true" }) }));
  });
});
