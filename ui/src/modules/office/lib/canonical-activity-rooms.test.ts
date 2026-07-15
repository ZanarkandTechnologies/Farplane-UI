import { describe, expect, it } from "vitest";
import { OFFICE_LANDMARK_KINDS } from "@/config/office-theme";
import {
  buildCanonicalActivityRooms,
  dedupeCanonicalActivityRooms,
  hydrateCanonicalActivityRooms,
  restoreCanonicalActivityRooms,
} from "./canonical-activity-rooms";
import { parseOfficeObjectUiBinding } from "../object-ui/metadata";

describe("canonical activity rooms", () => {
  it("defines exactly one room for every supported landmark kind", () => {
    const rooms = buildCanonicalActivityRooms("company-test");
    expect(rooms).toHaveLength(OFFICE_LANDMARK_KINDS.length);
    expect(rooms.map((room) => room.metadata?.landmarkKind).sort()).toEqual(
      [...OFFICE_LANDMARK_KINDS].sort(),
    );
    expect(
      rooms.every((room) => parseOfficeObjectUiBinding(room.metadata).kind === "internalPanel"),
    ).toBe(true);
  });

  it("restores missing rooms while preserving persisted placement and user landmarks", () => {
    const restored = restoreCanonicalActivityRooms([
      {
        _id: "activity-research-library",
        meshType: "activity-landmark",
        position: [8, 0, 3],
        rotation: [0, 1, 0],
        metadata: { landmarkKind: "library", placementLocked: true },
      },
      {
        _id: "user-quiet-room",
        meshType: "activity-landmark",
        position: [4, 0, 4],
        rotation: [0, 0, 0],
        metadata: { landmarkKind: "library" },
      },
    ]);

    expect(restored).toHaveLength(OFFICE_LANDMARK_KINDS.length + 1);
    expect(restored.find((room) => room._id === "activity-research-library")).toMatchObject({
      position: [8, 0, 3],
      metadata: { canonicalActivityRoom: true, placementLocked: true },
    });
    expect(restored.some((room) => room._id === "user-quiet-room")).toBe(true);
  });

  it("prefers a kit-owned canonical room over its legacy raw duplicate", () => {
    const deduped = dedupeCanonicalActivityRooms([
      {
        _id: "activity-research-library",
        meshType: "activity-landmark",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        metadata: { landmarkKind: "library" },
      },
      {
        _id: "office-kit:command-office:v1:activity-room:activity-research-library",
        meshType: "activity-landmark",
        position: [8, 0, 3],
        rotation: [0, 0, 0],
        metadata: {
          canonicalActivityRoom: true,
          canonicalActivityRoomId: "activity-research-library",
          landmarkKind: "library",
          officeKit: { generatedObjectKey: "activity-research-library" },
        },
      },
      {
        _id: "user-quiet-room",
        meshType: "activity-landmark",
        position: [4, 0, 4],
        rotation: [0, 0, 0],
        metadata: { landmarkKind: "library" },
      },
    ]);

    expect(deduped.map((room) => room._id)).toEqual([
      "office-kit:command-office:v1:activity-room:activity-research-library",
      "user-quiet-room",
    ]);
  });

  it("hydrates older kit rooms with their canonical panel and furniture bindings", () => {
    const hydrated = hydrateCanonicalActivityRooms([
      {
        _id: "office-kit:command-office:v1:activity-room:activity-training-gym",
        meshType: "activity-landmark",
        position: [3, 0, 4],
        rotation: [0, 0, 0],
        metadata: {
          canonicalActivityRoomId: "activity-training-gym",
          landmarkKind: "gym",
          officeKit: { generatedObjectKey: "activity-training-gym" },
        },
      },
    ]);

    expect(hydrated[0]).toMatchObject({
      position: [3, 0, 4],
      metadata: {
        roomFurnitureStyle: "executive-walnut-v1",
        uiBinding: { kind: "internalPanel", panelId: "skill-rollout" },
      },
    });
  });
});
