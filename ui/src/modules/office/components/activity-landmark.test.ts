import { describe, expect, it } from "vitest";
import { ACTIVITY_LANDMARK_KINDS, normalizeActivityLandmarkKind } from "./activity-landmark";

describe("activity landmark kinds", () => {
  it("keeps the thirteen persisted landmark kinds stable", () => {
    expect(ACTIVITY_LANDMARK_KINDS).toEqual([
      "gym",
      "library",
      "studio",
      "planning",
      "qa-arcade",
      "workshop",
      "skill-lab",
      "organization-hall",
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
});
