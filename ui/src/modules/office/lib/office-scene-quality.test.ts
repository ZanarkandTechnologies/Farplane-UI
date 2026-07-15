import { describe, expect, it } from "vitest";
import { measureOfficeSceneQuality } from "./office-scene-quality";
import { createRectangularOfficeLayout } from "./office-layout";
import { buildCanonicalActivityRooms } from "./canonical-activity-rooms";

describe("office scene quality", () => {
  it("measures avatar scale and semantic furniture clearance from source geometry", () => {
    const report = measureOfficeSceneQuality([
      { _id: "a", meshType: "team-cluster", position: [0, 0, 0], rotation: [0, 0, 0] },
      { _id: "b", meshType: "team-cluster", position: [12, 0, 0], rotation: [0, 0, 0] },
      { _id: "wall", meshType: "glass-wall", position: [0, 0, 8], rotation: [0, 0, 0] },
    ], createRectangularOfficeLayout({ width: 41, depth: 21 }));
    expect(report.employeeToDeskHeightRatio).toBeGreaterThanOrEqual(1.8);
    expect(report.employeeToDeskHeightRatio).toBeLessThanOrEqual(2.4);
    expect(report.employeeHitCapsuleWidth).toBeGreaterThanOrEqual(0.45);
    expect(report.leafIntersectionCount).toBe(0);
    expect(report.wallIntersectionCount).toBe(0);
    expect(report.measuredWallCount).toBeGreaterThan(0);
    expect(report.minimumCirculationClearance).toBeGreaterThanOrEqual(0.65);
  });

  it("reports semantic furniture that crosses the rendered office shell", () => {
    const report = measureOfficeSceneQuality(
      [{ _id: "outside", meshType: "team-cluster", position: [5, 0, 0], rotation: [0, 0, 0] }],
      createRectangularOfficeLayout({ width: 7, depth: 7 }),
    );

    expect(report.shellBoundaryIntersectionCount).toBe(1);
    expect(report.wallIntersectionCount).toBe(1);
    expect(report.wallIntersections).toContain("outside<>office-shell");
  });

  it("uses visible composition footprints instead of smaller placement proxies", () => {
    const report = measureOfficeSceneQuality([
      {
        _id: "commons",
        meshType: "command-commons",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        metadata: {
          footprintWidth: 4,
          footprintDepth: 4,
          visualFootprintWidth: 12,
          visualFootprintDepth: 8,
        },
      },
      {
        _id: "team",
        meshType: "team-cluster",
        position: [6.5, 0, 0],
        rotation: [0, 0, 0],
        metadata: { footprintWidth: 2, footprintDepth: 2 },
      },
    ]);

    expect(report.leafIntersectionCount).toBe(1);
    expect(report.leafIntersections).toContain("commons<>team");
  });

  it("reports incomplete first-party activity-room inventory", () => {
    const rooms = buildCanonicalActivityRooms();
    const complete = measureOfficeSceneQuality(rooms);
    const incomplete = measureOfficeSceneQuality(rooms.slice(1));

    expect(complete.activityRoomCount).toBe(13);
    expect(complete.missingActivityRoomKinds).toEqual([]);
    expect(complete.duplicateActivityRoomKinds).toEqual([]);
    expect(incomplete.activityRoomCount).toBe(12);
    expect(incomplete.missingActivityRoomKinds).toEqual([rooms[0]?.metadata?.landmarkKind]);
  });
});
