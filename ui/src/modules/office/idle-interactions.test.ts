import { describe, expect, it } from "vitest";
import { buildIdleInteractionTargets } from "./idle-interactions";
import type { OfficeObject } from "./lib/types";

function createObject(overrides: Partial<OfficeObject> = {}): OfficeObject {
  return {
    _id: "object-1",
    meshType: "bookshelf",
    position: [2, 0, 3],
    rotation: [0, 0, 0],
    metadata: {},
    ...overrides,
  };
}

describe("office idle interactions", () => {
  it("builds object-interest targets from metadata phrases", () => {
    const targets = buildIdleInteractionTargets([
      createObject({
        _id: "object-research-shelf",
        metadata: {
          displayName: "Research Shelf",
          idleInteraction: {
            phrases: ["Checking docs", "Found a pattern"],
          },
        },
      }),
    ]);

    expect(targets).toEqual([
      expect.objectContaining({
        objectId: "object-research-shelf",
        label: "Research Shelf",
        phrases: ["Checking docs", "Found a pattern"],
        objectPosition: [2, 0, 3],
      }),
    ]);
    expect(targets[0]?.position[2]).toBeGreaterThan(3);
  });

  it("uses default furniture phrases and ignores structural objects", () => {
    const targets = buildIdleInteractionTargets([
      createObject({ _id: "object-couch", meshType: "couch" }),
      createObject({ _id: "cluster-1", meshType: "team-cluster" }),
      createObject({
        _id: "object-muted-plant",
        meshType: "plant",
        metadata: { idleInteraction: { enabled: false } },
      }),
    ]);

    expect(targets.map((target) => target.objectId)).toEqual(["object-couch"]);
    expect(targets[0]?.phrases.length).toBeGreaterThan(0);
  });
});
