/**
 * OFFICE KIT MATERIALIZATION
 * ==========================
 * Ownership: converts an accepted generated scene snapshot into stable sidecar objects.
 * Inputs/outputs: derived scene objects + current sidecar/settings -> next sidecar/settings + receipt.
 * Side effects: none; persistence belongs to the runtime adapter edge.
 * Invariant: only explicitly owned semantic prefabs are replaced; user objects survive.
 */

import type { OfficeObjectSidecarModel, OfficeSettingsModel } from "@/modules/runtime";
import {
  createOfficePlacementReservation,
  reserveOfficeObjectPlacement,
} from "../systems/placement-engine";
import { isOperatingRoomId, resolveOperatingRoomId } from "./operating-room-catalog";
import type { OfficeObject } from "./types";

export const COMMAND_OFFICE_KIT_ID = "command-office";
export const COMMAND_OFFICE_KIT_VERSION = 1;
export const COMMAND_OFFICE_PROJECT_CAPACITY = 7;

export type OfficeKitOwnedMetadata = {
  kitId: string;
  kitVersion: number;
  prefabId: string;
  generatedObjectKey: string;
  slotId: string;
};

export type OfficeKitMaterialization = {
  settings: OfficeSettingsModel;
  objects: OfficeObjectSidecarModel[];
  receipt: {
    kitId: string;
    kitVersion: number;
    revision: number;
    generatedObjectKeys: string[];
    preservedObjectIds: string[];
    projectCapacity: number;
  };
};

function sanitizeStablePart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default"
  );
}

export function buildOfficeKitObjectKey(input: {
  kitId: string;
  kitVersion: number;
  prefabId: string;
  slotId: string;
}): string {
  return [
    "office-kit",
    sanitizeStablePart(input.kitId),
    `v${Math.max(1, Math.floor(input.kitVersion))}`,
    sanitizeStablePart(input.prefabId),
    sanitizeStablePart(input.slotId),
  ].join(":");
}

export function readOfficeKitOwnership(
  metadata: Record<string, unknown> | undefined,
): OfficeKitOwnedMetadata | null {
  const value = metadata?.officeKit;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const kitId = typeof row.kitId === "string" ? row.kitId.trim() : "";
  const generatedObjectKey =
    typeof row.generatedObjectKey === "string" ? row.generatedObjectKey.trim() : "";
  const prefabId = typeof row.prefabId === "string" ? row.prefabId.trim() : "";
  const slotId = typeof row.slotId === "string" ? row.slotId.trim() : "";
  const kitVersion = Math.floor(Number(row.kitVersion));
  if (!kitId || !generatedObjectKey || !prefabId || !slotId || !Number.isFinite(kitVersion)) {
    return null;
  }
  const expectedKey = buildOfficeKitObjectKey({ kitId, kitVersion, prefabId, slotId });
  if (generatedObjectKey !== expectedKey) return null;
  return { kitId, kitVersion, prefabId, generatedObjectKey, slotId };
}

function getSceneSemanticSlot(object: OfficeObject): { prefabId: string; slotId: string } | null {
  if (object.meshType === "command-commons") {
    return { prefabId: "command-commons", slotId: "commons" };
  }
  if (object.meshType === "activity-landmark") {
    const roomId = object.metadata?.operatingRoomId;
    return isOperatingRoomId(roomId) ? { prefabId: "operating-room", slotId: roomId } : null;
  }
  if (object.meshType !== "team-cluster") return null;
  const teamId = typeof object.metadata?.teamId === "string" ? object.metadata.teamId.trim() : "";
  if (!teamId) return null;
  return { prefabId: "team-neighborhood", slotId: teamId };
}

function toOwnedSidecarObject(
  object: OfficeObject,
  slot: { prefabId: string; slotId: string },
): OfficeObjectSidecarModel {
  const generatedObjectKey = buildOfficeKitObjectKey({
    kitId: COMMAND_OFFICE_KIT_ID,
    kitVersion: COMMAND_OFFICE_KIT_VERSION,
    prefabId: slot.prefabId,
    slotId: slot.slotId,
  });
  const ownership: OfficeKitOwnedMetadata = {
    kitId: COMMAND_OFFICE_KIT_ID,
    kitVersion: COMMAND_OFFICE_KIT_VERSION,
    prefabId: slot.prefabId,
    generatedObjectKey,
    slotId: slot.slotId,
  };
  return {
    id: generatedObjectKey,
    identifier: generatedObjectKey,
    meshType: object.meshType as OfficeObjectSidecarModel["meshType"],
    position: [...object.position],
    rotation: [...object.rotation],
    scale: object.scale ? [...object.scale] : undefined,
    metadata: { ...(object.metadata ?? {}), officeKit: ownership },
  };
}

export function materializeCommandOfficeKit(input: {
  sceneObjects: OfficeObject[];
  persistedObjects: OfficeObjectSidecarModel[];
  settings: OfficeSettingsModel;
  seed?: string;
}): OfficeKitMaterialization {
  const ownedObjectsUnplaced = input.sceneObjects
    .map((object) => {
      const slot = getSceneSemanticSlot(object);
      return slot ? toOwnedSidecarObject(object, slot) : null;
    })
    .filter((object): object is OfficeObjectSidecarModel => object !== null);
  const replacedTeamIds = new Set(
    ownedObjectsUnplaced
      .filter((object) => object.meshType === "team-cluster")
      .map((object) => String(object.metadata?.teamId ?? ""))
      .filter(Boolean),
  );
  const replacedOperatingRoomIds = new Set(
    ownedObjectsUnplaced
      .filter((object) => object.meshType === "activity-landmark")
      .map((object) => String(object.metadata?.operatingRoomId ?? ""))
      .filter(Boolean),
  );
  const preservedObjects = input.persistedObjects.filter((object) => {
    const ownership = readOfficeKitOwnership(object.metadata);
    if (ownership?.kitId === COMMAND_OFFICE_KIT_ID) return false;
    // These three template partitions belong to the replaced starter focus pod,
    // not to user-authored inventory, and geometrically conflict with the commons.
    if (object.id.startsWith("farplane-focus-wall-")) return false;
    const persistedOperatingRoomId = resolveOperatingRoomId({
      objectId: object.id,
      metadata: object.metadata,
    });
    if (persistedOperatingRoomId && replacedOperatingRoomIds.has(persistedOperatingRoomId)) {
      return false;
    }
    if (object.meshType !== "team-cluster") return true;
    const teamId = typeof object.metadata?.teamId === "string" ? object.metadata.teamId : "";
    if (replacedTeamIds.has(teamId)) return false;
    // Legacy/generated project clusters beyond kit capacity must not survive as furniture.
    return teamId === "team-management" || !teamId.startsWith("team-");
  });
  const commandCommons = ownedObjectsUnplaced.filter(
    (object) => object.meshType === "command-commons",
  );
  const reservation = createOfficePlacementReservation(
    [...preservedObjects.filter((object) => object.meshType !== "wall-art"), ...commandCommons].map(
      (object) => ({
        meshType: object.meshType,
        position: object.position,
        rotation: object.rotation,
        metadata: object.metadata,
      }),
    ),
  );
  const ownedObjects = [...ownedObjectsUnplaced]
    .sort((left, right) => {
      if (left.meshType === "command-commons") return -1;
      if (right.meshType === "command-commons") return 1;
      return left.id.localeCompare(right.id);
    })
    .map((object) => {
      if (object.meshType === "command-commons") {
        return object;
      }
      if (object.meshType !== "team-cluster") return object;
      const visualFootprintWidth = object.metadata?.visualFootprintWidth;
      const visualFootprintDepth = object.metadata?.visualFootprintDepth;
      const placementMetadata = {
        ...(object.metadata ?? {}),
        ...(typeof visualFootprintWidth === "number"
          ? { footprintWidth: visualFootprintWidth }
          : {}),
        ...(typeof visualFootprintDepth === "number"
          ? { footprintDepth: visualFootprintDepth }
          : {}),
      };
      const placement = reserveOfficeObjectPlacement({
        object: {
          meshType: object.meshType,
          position: object.position,
          rotation: object.rotation,
          metadata: placementMetadata,
        },
        layout: input.settings.officeLayout,
        reservation,
        allowCollisionFallback: false,
      });
      return placement ? { ...object, position: placement.position } : object;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const revision = (input.settings.officeKit?.revision ?? 0) + 1;
  const settings: OfficeSettingsModel = {
    ...input.settings,
    layoutStrategy: "manual",
    officeKit: {
      kitId: COMMAND_OFFICE_KIT_ID,
      kitVersion: COMMAND_OFFICE_KIT_VERSION,
      seed: input.seed?.trim() || "accepted-command-office",
      status: "equipped",
      projectCapacity: COMMAND_OFFICE_PROJECT_CAPACITY,
      revision,
    },
  };
  return {
    settings,
    objects: [...preservedObjects, ...ownedObjects],
    receipt: {
      kitId: COMMAND_OFFICE_KIT_ID,
      kitVersion: COMMAND_OFFICE_KIT_VERSION,
      revision,
      generatedObjectKeys: ownedObjects.map((object) => object.id),
      preservedObjectIds: preservedObjects.map((object) => object.id),
      projectCapacity: COMMAND_OFFICE_PROJECT_CAPACITY,
    },
  };
}

export function markOfficeKitCustomized(settings: OfficeSettingsModel): OfficeSettingsModel {
  if (!settings.officeKit) return { ...settings, layoutStrategy: "manual" };
  if (settings.layoutStrategy === "manual" && settings.officeKit.status === "customized") {
    return settings;
  }
  return {
    ...settings,
    layoutStrategy: "manual",
    officeKit: { ...settings.officeKit, status: "customized" },
  };
}

export async function persistOfficeKitCustomization(adapter: {
  getOfficeSettings: () => Promise<OfficeSettingsModel>;
  saveOfficeSettings: (
    settings: OfficeSettingsModel,
  ) => Promise<{ ok: boolean; error?: string; settings: OfficeSettingsModel }>;
}): Promise<void> {
  const current = await adapter.getOfficeSettings();
  if (!current.officeKit || current.officeKit.status === "customized") return;
  const result = await adapter.saveOfficeSettings(markOfficeKitCustomized(current));
  if (!result.ok) throw new Error(result.error ?? "office_kit_customize_failed");
}
