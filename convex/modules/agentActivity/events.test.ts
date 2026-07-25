import { describe, expect, it } from "vitest";
import { normalizeEventStepKey } from "./events";

describe("agent activity event ingestion", () => {
  it("normalizes dedupe keys before indexed lookup and persistence", () => {
    expect(normalizeEventStepKey(" beat-1:status ")).toBe("beat-1:status");
    expect(normalizeEventStepKey("beat-1:status")).toBe("beat-1:status");
  });

  it("does not create a dedupe scope for missing or blank keys", () => {
    expect(normalizeEventStepKey(undefined)).toBeUndefined();
    expect(normalizeEventStepKey("   ")).toBeUndefined();
  });
});
