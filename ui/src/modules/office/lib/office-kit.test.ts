import { describe, expect, it } from "vitest";
import { toOfficeSettings } from "@/modules/runtime/lib/openclaw/normalize";
import { buildOfficeKitObjectKey, materializeCommandOfficeKit } from "./office-kit";
import { createRectangularOfficeLayout } from "./office-layout";
import { buildOperatingRooms } from "./operating-room-catalog";
import type { OfficeObject } from "./types";

const sceneObjects: OfficeObject[] = [
  {
    _id: "generated-commons",
    meshType: "command-commons",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  {
    _id: "generated-team",
    meshType: "team-cluster",
    position: [4, 0, 2],
    rotation: [0, 0, 0],
    metadata: { teamId: "team-alpha", commandCommonsNeighborhood: true },
  },
];

describe("office kit materialization", () => {
  it("builds semantic stable keys independent of scene ids and ordering", () => {
    expect(
      buildOfficeKitObjectKey({
        kitId: "Command Office",
        kitVersion: 1,
        prefabId: "Team Neighborhood",
        slotId: "team-alpha",
      }),
    ).toBe("office-kit:command-office:v1:team-neighborhood:team-alpha");
    const settings = toOfficeSettings({});
    const first = materializeCommandOfficeKit({ sceneObjects, persistedObjects: [], settings });
    const second = materializeCommandOfficeKit({
      sceneObjects: [...sceneObjects]
        .reverse()
        .map((object) => ({ ...object, _id: `${object._id}-2` })),
      persistedObjects: [],
      settings,
    });
    expect(first.receipt.generatedObjectKeys).toEqual(second.receipt.generatedObjectKeys);
  });

  it("preserves user objects and replaces prior kit-owned objects", () => {
    const settings = toOfficeSettings({});
    const oldKitObjectId = buildOfficeKitObjectKey({
      kitId: "command-office",
      kitVersion: 1,
      prefabId: "command-commons",
      slotId: "commons",
    });
    const result = materializeCommandOfficeKit({
      sceneObjects,
      settings,
      persistedObjects: [
        {
          id: "user-plant",
          identifier: "user-plant",
          meshType: "plant",
          position: [1, 0, 1],
        },
        {
          id: oldKitObjectId,
          identifier: oldKitObjectId,
          meshType: "command-commons",
          position: [99, 0, 99],
          metadata: {
            officeKit: {
              kitId: "command-office",
              kitVersion: 1,
              prefabId: "command-commons",
              generatedObjectKey: oldKitObjectId,
              slotId: "commons",
            },
          },
        },
      ],
    });
    expect(result.objects.some((object) => object.id === "user-plant")).toBe(true);
    expect(result.objects.some((object) => object.id === oldKitObjectId)).toBe(true);
    expect(result.objects.filter((object) => object.id === oldKitObjectId)).toHaveLength(1);
    expect(result.settings.layoutStrategy).toBe("manual");
    expect(result.settings.officeKit).toMatchObject({ status: "equipped", revision: 1 });
  });

  it("persists every operating room as a stable kit-owned semantic object", () => {
    const result = materializeCommandOfficeKit({
      sceneObjects: [...sceneObjects, ...buildOperatingRooms()],
      persistedObjects: [],
      settings: toOfficeSettings({}),
    });
    const rooms = result.objects.filter((object) => object.meshType === "activity-landmark");

    expect(rooms).toHaveLength(11);
    expect(rooms.every((room) => room.id.includes(":operating-room:"))).toBe(true);
    expect(rooms.every((room) => typeof room.metadata?.operatingRoomId === "string")).toBe(true);
  });

  it("preserves an object with tampered kit ownership metadata", () => {
    const settings = toOfficeSettings({});
    const result = materializeCommandOfficeKit({
      sceneObjects,
      settings,
      persistedObjects: [
        {
          id: "user-command-model",
          identifier: "user-command-model",
          meshType: "custom-mesh",
          position: [8, 0, 8],
          metadata: {
            officeKit: {
              kitId: "command-office",
              kitVersion: 1,
              prefabId: "command-commons",
              generatedObjectKey: "tampered-key",
              slotId: "commons",
            },
          },
        },
      ],
    });
    expect(result.objects.some((object) => object.id === "user-command-model")).toBe(true);
  });

  it("increments revision and stays idempotent at semantic object identity", () => {
    const first = materializeCommandOfficeKit({
      sceneObjects,
      persistedObjects: [],
      settings: toOfficeSettings({}),
    });
    const second = materializeCommandOfficeKit({
      sceneObjects,
      persistedObjects: first.objects,
      settings: first.settings,
    });
    expect(second.settings.officeKit?.revision).toBe(2);
    expect(second.objects.map((object) => object.id)).toEqual(
      first.objects.map((object) => object.id),
    );
  });

  it("places team neighborhoods using their rendered visual footprint", () => {
    const result = materializeCommandOfficeKit({
      sceneObjects: [
        {
          _id: "edge-team",
          meshType: "team-cluster",
          position: [8, 0, 0],
          rotation: [0, 0, 0],
          metadata: {
            teamId: "team-edge",
            footprintWidth: 2,
            footprintDepth: 2,
            visualFootprintWidth: 6,
            visualFootprintDepth: 6,
          },
        },
      ],
      persistedObjects: [],
      settings: toOfficeSettings({
        officeLayout: createRectangularOfficeLayout({ width: 21, depth: 21 }),
      }),
    });

    expect(result.objects[0]?.position).not.toEqual([8, 0, 0]);
    expect(Math.abs(result.objects[0]?.position[0] ?? 99)).toBeLessThanOrEqual(7);
  });
});
