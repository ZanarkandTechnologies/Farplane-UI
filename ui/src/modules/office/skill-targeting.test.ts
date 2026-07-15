import { describe, expect, it } from "vitest";

import type { OfficeObject } from "@/modules/office/lib/types";
import {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPosition,
  getOfficeSkillAnchorPositionForOccupant,
} from "./skill-targeting";

describe("office skill targeting", () => {
  it("offsets anchors slightly in front of the bound object", () => {
    const object: OfficeObject = {
      _id: "monitor-1",
      meshType: "custom-mesh",
      position: [4, 0, 7],
      rotation: [0, 0, 0],
      metadata: {
        skillBinding: {
          skillId: "world-monitor",
        },
      },
    };

    expect(getOfficeSkillAnchorPosition(object)).toEqual([4, 0, 9.1]);
  });

  it.each([
    [0, [0, 0, 1.15]],
    [Math.PI / 2, [-1.15, 0, 0]],
    [Math.PI, [0, 0, -1.15]],
    [-Math.PI / 2, [1.15, 0, 0]],
  ] as const)("uses a walkable interior spot at rotation %s", (rotationY, expected) => {
    const object: OfficeObject = {
      _id: "activity-library",
      meshType: "activity-landmark",
      position: [0, 0, 0],
      rotation: [0, rotationY, 0],
      metadata: {
        landmarkKind: "library",
        footprintWidth: 2,
        footprintDepth: 2,
        footprintClearance: 0,
      },
    };
    const actual = getOfficeSkillAnchorPosition(object);

    expect(actual[0]).toBeCloseTo(expected[0]);
    expect(actual[1]).toBeCloseTo(expected[1]);
    expect(actual[2]).toBeCloseTo(expected[2]);
  });

  it("spreads multiple occupants around the same bound object", () => {
    const object: OfficeObject = {
      _id: "monitor-1",
      meshType: "custom-mesh",
      position: [1, 0, 2],
      rotation: [0, 0, 0],
      metadata: { skillBinding: { skillId: "world-monitor" } },
    };

    const first = getOfficeSkillAnchorPositionForOccupant(object, 0, 3);
    const second = getOfficeSkillAnchorPositionForOccupant(object, 1, 3);
    const third = getOfficeSkillAnchorPositionForOccupant(object, 2, 3);

    expect(first).not.toEqual(second);
    expect(second).not.toEqual(third);
    expect(first[2]).toBeLessThanOrEqual(4.1);
    expect(third[2]).toBeLessThanOrEqual(4.1);
  });

  it("builds a lookup from skill bindings and ignores duplicates", () => {
    const objects: OfficeObject[] = [
      {
        _id: "monitor-1",
        meshType: "custom-mesh",
        position: [1, 0, 2],
        rotation: [0, 0, 0],
        metadata: {
          skillBinding: {
            skillId: "world-monitor",
            skillIds: ["research", "summarize"],
          },
        },
      },
      {
        _id: "monitor-2",
        meshType: "custom-mesh",
        position: [9, 0, 9],
        rotation: [0, 1.57, 0],
        metadata: { skillBinding: { skillId: "world-monitor" } },
      },
      {
        _id: "plant-1",
        meshType: "plant",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
    ];

    const map = buildSkillTargetObjectMap(objects);
    expect(map.get("world-monitor")?._id).toBe("monitor-1");
    expect(map.get("research")?._id).toBe("monitor-1");
    expect(map.get("summarize")?._id).toBe("monitor-1");
    expect(map.size).toBe(3);
  });
});
