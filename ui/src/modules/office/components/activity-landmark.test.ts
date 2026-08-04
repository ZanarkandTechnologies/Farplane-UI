import { describe, expect, it } from "vitest";
import { getOfficePresentationRotationY } from "../scene/view-profile";
import {
  ACTIVITY_LANDMARK_KINDS,
  getActivityDestinationRoomDimensions,
  getActivityLandmarkLocalPresentationRotationY,
  normalizeActivityLandmarkKind,
} from "./activity-landmark";

describe("activity landmark kinds", () => {
  it("keeps the fourteen persisted landmark kinds stable", () => {
    expect(ACTIVITY_LANDMARK_KINDS).toEqual([
      "gym",
      "library",
      "studio",
      "planning",
      "qa-arcade",
      "workshop",
      "skill-lab",
      "organization-hall",
      "finance-office",
      "resource-archive",
      "comms-hub",
      "telemetry-console",
      "thread-data-lab",
      "world-orb",
    ]);
  });

  it.each(ACTIVITY_LANDMARK_KINDS)("preserves the supported %s kind", (kind) => {
    expect(normalizeActivityLandmarkKind(kind)).toBe(kind);
  });

  it.each([undefined, null, "", "unknown", 42])("falls back from %s to gym", (value) => {
    expect(normalizeActivityLandmarkKind(value)).toBe("gym");
  });

  it("keeps landmarks inside room-sized zones without shrinking larger authored zones", () => {
    expect(getActivityDestinationRoomDimensions(4.6, 3.6)).toEqual({ width: 5, depth: 5 });
    expect(getActivityDestinationRoomDimensions(8, 7)).toEqual({ width: 8, depth: 7 });
    expect(getActivityDestinationRoomDimensions(3, 2, true)).toEqual({ width: 5, depth: 4 });
  });

  it("counter-rotates placed furniture so it faces the fixed isometric camera", () => {
    const objectRotationY = -Math.PI / 2;
    const settings = {
      viewProfile: "fixed_2_5d" as const,
      orbitControlsEnabled: false,
      cameraOrientation: "south_east" as const,
    };
    const localRotation = getActivityLandmarkLocalPresentationRotationY({
      objectRotationY,
      settings,
    });

    expect(localRotation + objectRotationY).toBeCloseTo(
      getOfficePresentationRotationY(settings.cameraOrientation),
    );
  });
});
