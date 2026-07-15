import { describe, expect, it } from "vitest";

import {
  getSpriteInitialElapsedMs,
  getSpriteInitialFrame,
  getSpriteTravelBobbleY,
} from "./sprite-sheet-2d";

describe("sprite sheet 2D travel bobble", () => {
  it("adds visible bobble only while the employee is walking", () => {
    expect(getSpriteTravelBobbleY("idle", 0.2)).toBe(0);
    expect(getSpriteTravelBobbleY("working", 0.2)).toBe(0);
    expect(getSpriteTravelBobbleY("walking", 0.2, "employee-a")).toBeGreaterThan(0);
  });

  it("derives stable per-employee starting frames", () => {
    expect(getSpriteInitialFrame("employee-a", "idle", 6)).toBe(
      getSpriteInitialFrame("employee-a", "idle", 6),
    );
    expect(getSpriteInitialFrame("employee-a", "idle", 6)).not.toBe(
      getSpriteInitialFrame("employee-b", "idle", 6),
    );
  });

  it("derives stable per-employee elapsed offsets even when frames match", () => {
    const durations = [120, 120, 120, 220];
    expect(getSpriteInitialElapsedMs("employee-a", "running-right", durations)).toBe(
      getSpriteInitialElapsedMs("employee-a", "running-right", durations),
    );
    expect(getSpriteInitialElapsedMs("employee-a", "running-right", durations)).not.toBe(
      getSpriteInitialElapsedMs("employee-b", "running-right", durations),
    );
  });
});
