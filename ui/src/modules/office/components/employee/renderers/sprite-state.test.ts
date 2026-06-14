import { describe, expect, it } from "vitest";

import { selectSpriteAnimationKey } from "./sprite-state";

describe("sprite animation state mapping", () => {
  it("uses semantic activity rows before locomotion rows", () => {
    expect(
      selectSpriteAnimationKey({
        animationMode: "walking",
        movementDirection: "right",
        activityState: "waiting",
      }),
    ).toBe("waiting");
    expect(
      selectSpriteAnimationKey({
        animationMode: "idle",
        movementDirection: "none",
        activityState: "failed",
      }),
    ).toBe("failed");
    expect(
      selectSpriteAnimationKey({
        animationMode: "working",
        movementDirection: "none",
        activityState: "review",
      }),
    ).toBe("review");
    expect(
      selectSpriteAnimationKey({
        animationMode: "working",
        movementDirection: "none",
        activityState: "running",
      }),
    ).toBe("running");
  });

  it("maps walking to the neutral hatch-pet running row", () => {
    expect(
      selectSpriteAnimationKey({
        animationMode: "walking",
        movementDirection: "left",
      }),
    ).toBe("running");
    expect(
      selectSpriteAnimationKey({
        animationMode: "walking",
        movementDirection: "right",
      }),
    ).toBe("running");
    expect(
      selectSpriteAnimationKey({
        animationMode: "walking",
        movementDirection: "up",
      }),
    ).toBe("running");
  });
});
