import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { ActivityScenePresentation } from "../../activity-scenes";
import {
  isSameActivityScenePresentation,
  resolveActivityRouteTarget,
  resolveActivityScenePhase,
} from "./use-employee-locomotion";

describe("activity scene locomotion phase", () => {
  it("does not engage presentation while travelling", () => {
    expect(resolveActivityScenePhase({ hasTarget: true, arrived: false })).toBe("travel");
  });

  it("engages only after arrival or an explicit projection handoff", () => {
    expect(resolveActivityScenePhase({ hasTarget: true, arrived: true })).toBe("engaged");
    expect(
      resolveActivityScenePhase({
        hasTarget: true,
        arrived: false,
        projectionActive: true,
      }),
    ).toBe("engaged");
  });

  it("clears on route failure or target removal", () => {
    expect(
      resolveActivityScenePhase({
        hasTarget: true,
        arrived: false,
        routeFailed: true,
      }),
    ).toBe("none");
    expect(resolveActivityScenePhase({ hasTarget: false, arrived: true })).toBe("none");
    expect(
      resolveActivityScenePhase({
        hasTarget: true,
        arrived: true,
        cancelled: true,
      }),
    ).toBe("none");
  });

  it("engages at the reachable route endpoint when the ideal bay anchor is blocked", () => {
    const requested = new THREE.Vector3(14.9, 0.475, 2);
    const reachable = new THREE.Vector3(13.675, 0.475, 1.25);

    expect(resolveActivityRouteTarget(requested, [reachable])).toEqual(reachable);
    expect(resolveActivityRouteTarget(requested, null)).toBe(requested);
  });

  it("does not reuse a descriptor when landmarks share a scene key but differ visually", () => {
    const gym: ActivityScenePresentation = {
      sceneKey: "train-skill",
      label: "Training",
      propKind: "training-orb",
      baseSpriteAnimation: "running",
      ambientPhrases: [],
      accentColor: "#0ea5e9",
    };
    const skillLab: ActivityScenePresentation = {
      ...gym,
      accentColor: "#34d399",
    };

    expect(isSameActivityScenePresentation(gym, gym)).toBe(true);
    expect(isSameActivityScenePresentation(gym, skillLab)).toBe(false);
  });
});
