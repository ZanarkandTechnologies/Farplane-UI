import { describe, expect, it } from "vitest";
import { coerceLiveState } from "./live-status";

describe("coerceLiveState", () => {
  it("accepts self-report states", () => {
    expect(coerceLiveState("planning")).toBe("planning");
    expect(coerceLiveState("executing")).toBe("executing");
    expect(coerceLiveState("blocked")).toBe("blocked");
    expect(coerceLiveState("done")).toBe("done");
  });

  it("falls back to idle for unknown values", () => {
    expect(coerceLiveState("unknown-state")).toBe("idle");
  });
});
