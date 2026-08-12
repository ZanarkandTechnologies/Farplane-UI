import { describe, expect, it } from "vitest";
import { parseOfficeObjectSkillBinding } from "../object-ui/metadata";
import {
  buildOperatingRooms,
  getOperatingRoomId,
  OPERATING_ROOM_CATALOG,
  restoreMissingManualFinanceOffice,
  restoreOperatingRooms,
} from "./operating-room-catalog";

describe("operating room catalog", () => {
  it("defines the accepted eleven rooms with independent host, panel, and activity contracts", () => {
    const rooms = buildOperatingRooms("company-test");
    expect(rooms).toHaveLength(11);
    expect(new Set(OPERATING_ROOM_CATALOG.map((room) => room.panelId)).size).toBe(11);
    expect(new Set(OPERATING_ROOM_CATALOG.map((room) => room.hostAgentId)).size).toBe(11);
    expect(OPERATING_ROOM_CATALOG.find((room) => room.id === "finance")?.panelId).toBe("leverage");
    expect(
      rooms.every(
        (room) =>
          room.meshType === "activity-landmark" &&
          room.metadata?.schemaVersion === 1 &&
          typeof room.metadata?.operatingRoomId === "string" &&
          room.metadata?.canonicalActivityRoomId === undefined,
      ),
    ).toBe(true);
    const activityOwners = OPERATING_ROOM_CATALOG.flatMap((room) =>
      room.activitySkillIds.map((skillId) => [skillId, room.id] as const),
    );
    expect(new Set(activityOwners.map(([skillId]) => skillId)).size).toBe(activityOwners.length);
    expect(activityOwners.map(([skillId]) => skillId)).not.toEqual(
      expect.arrayContaining([
        "plan",
        "execute",
        "ingest-content",
        "metric-advisor",
        "runtime-debugging",
      ]),
    );
  });

  it("migrates the Harness Workshop legacy object and fixes aliases for new writes", () => {
    const restored = restoreOperatingRooms([
      {
        _id: "activity-workshop",
        meshType: "activity-landmark",
        position: [8, 0, 3],
        rotation: [0, 1, 0],
        metadata: {
          canonicalActivityRoom: true,
          canonicalActivityRoomId: "activity-workshop",
          placementLocked: true,
          skillBinding: { skillId: "execute", aliases: ["hardening"] },
        },
      },
    ]);
    const workshop = restored.find((object) => getOperatingRoomId(object) === "harness");
    expect(workshop).toMatchObject({
      position: [8, 0, 3],
      rotation: [0, 1, 0],
      metadata: {
        operatingRoomId: "harness",
        schemaVersion: 1,
        placementLocked: true,
        uiBinding: { panelId: "harness" },
      },
    });
    expect(workshop?.metadata?.canonicalActivityRoomId).toBeUndefined();
    expect(parseOfficeObjectSkillBinding(workshop?.metadata)).toMatchObject({
      skillId: "harness-advisor",
      skillIds: ["harness-creator", "optimize-harness"],
    });
  });

  it("retires only enumerated legacy rooms and preserves user-created landmarks", () => {
    const userRoom = {
      _id: "user-planning-room",
      meshType: "activity-landmark",
      position: [4, 0, 4] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      metadata: { landmarkKind: "planning", displayName: "My Planning Room" },
    };
    const restored = restoreOperatingRooms([
      userRoom,
      {
        _id: "activity-planning-room",
        meshType: "activity-landmark",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      {
        _id: "activity-resource-archive",
        meshType: "activity-landmark",
        position: [7, 0, -18],
        rotation: [0, 0, 0],
      },
      {
        _id: "farplane-map-console",
        meshType: "activity-landmark",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
    ]);
    expect(restored).toHaveLength(12);
    expect(restored).toContainEqual(userRoom);
    expect(restored.some((object) => object._id === "activity-planning-room")).toBe(false);
    expect(restored.find((object) => getOperatingRoomId(object) === "finance")?.position).toEqual([
      7, 0, -18,
    ]);
    expect(restored.filter((object) => getOperatingRoomId(object) !== null)).toHaveLength(11);
  });

  it("is idempotent and prefers a kit-owned room over its raw legacy duplicate", () => {
    const once = restoreOperatingRooms([
      {
        _id: "activity-research-library",
        meshType: "activity-landmark",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      {
        _id: "office-kit:command-office:v1:operating-room:research",
        meshType: "activity-landmark",
        position: [8, 0, 3],
        rotation: [0, 0, 0],
        metadata: {
          operatingRoomId: "research",
          schemaVersion: 1,
          officeKit: { generatedObjectKey: "research" },
        },
      },
    ]);
    const twice = restoreOperatingRooms(once);
    expect(once).toEqual(twice);
    expect(once.find((object) => getOperatingRoomId(object) === "research")?.position).toEqual([
      8, 0, 3,
    ]);
  });

  it("fills the known Finance gap in a complete legacy manual room rail", () => {
    const xByRoom = new Map([
      ["self-improvement", -13.1666666667],
      ["research", -6.3333333333],
      ["production", 0.5],
      ["qa", 14.1666666667],
    ]);
    const legacyManualRooms = buildOperatingRooms()
      .filter((room) => getOperatingRoomId(room) !== "finance")
      .map((room) => {
        const roomId = getOperatingRoomId(room);
        const x = roomId ? xByRoom.get(roomId) : undefined;
        return x === undefined
          ? { ...room, rotation: [0, Math.PI / 2, 0] as [number, number, number] }
          : {
              ...room,
              position: [x, 0, -18.5] as [number, number, number],
              rotation: [0, 0, 0] as [number, number, number],
            };
      });

    const restored = restoreMissingManualFinanceOffice(legacyManualRooms);
    expect(restored.filter((room) => getOperatingRoomId(room) !== null)).toHaveLength(11);
    expect(restored.find((room) => getOperatingRoomId(room) === "finance")?.position).toEqual([
      7.33333333335, 0, -18.5,
    ]);
  });
});
