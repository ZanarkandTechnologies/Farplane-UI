import { describe, expect, it } from "vitest";

import {
  connectionRecoveryCopy,
  filterRuntimeLines,
  runtimeEndpointLabel,
  runtimeEndpointUrl,
  sanitizeRuntimeText,
} from "./runtime-health-model";

describe("runtime health model", () => {
  it("labels Codex and OpenClaw endpoints without mixing runtime language", () => {
    expect(runtimeEndpointLabel("codex")).toBe("Codex App Server");
    expect(runtimeEndpointUrl("codex", "http://gateway", "http://ui")).toBe("http://ui");
    expect(connectionRecoveryCopy("unreachable", "fallback", "codex")).toContain(
      "Codex app-server bridge",
    );

    expect(runtimeEndpointLabel("openclaw")).toBe("Gateway");
    expect(runtimeEndpointUrl("openclaw", "http://gateway", "http://ui")).toBe("http://gateway");
    expect(connectionRecoveryCopy("unreachable", "fallback", "openclaw")).toContain("Gateway");
  });

  it("redacts local usernames and secret-like values from diagnostics", () => {
    const text =
      "failed /Users/kenjipcx/.codex/session.jsonl token=abc123456 password:supersecret Bearer abcdefghijklmnop";

    expect(sanitizeRuntimeText(text, 500)).toBe(
      "failed ~/.codex/session.jsonl token=[redacted] password=[redacted] Bearer [redacted]",
    );
  });

  it("filters runtime lines case-insensitively", () => {
    expect(filterRuntimeLines(["Hook ok", "Session degraded"], "session")).toEqual([
      "Session degraded",
    ]);
  });
});
