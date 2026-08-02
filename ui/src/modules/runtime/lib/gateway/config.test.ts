// Proves the browser gateway config boundary: only non-secret settings persist locally.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function localStorageStub(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("gateway UI config", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: localStorageStub(),
      location: { origin: "http://127.0.0.1:5173" },
    });
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("ignores stored credentials and never persists an injected credential", async () => {
    window.localStorage.setItem(
      "farplane.gateway-config.v1",
      JSON.stringify({ gatewayBase: "http://saved.local", gatewayToken: "stored-secret" }),
    );
    const config = await import("./config");

    expect(config.getGatewayUiConfig().gatewayToken).not.toBe("stored-secret");
    config.saveGatewayUiConfig({ gatewayBase: "http://next.local", gatewayToken: "form-secret" });

    expect(window.localStorage.getItem("farplane.gateway-config.v1")).toBe(
      JSON.stringify({
        gatewayBase: "http://next.local",
        stateBase: window.location.origin,
        defaultSessionKey: "",
        language: "English",
      }),
    );
  });
});
