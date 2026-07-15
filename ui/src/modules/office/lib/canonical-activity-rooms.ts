/**
 * CANONICAL ACTIVITY ROOMS
 * ========================
 * Owns the complete first-party activity-room inventory used by auto layout and office-kit equip.
 * Missing canonical rooms are restored before placement; user-created landmarks remain untouched.
 */

import { OFFICE_LANDMARK_KINDS, type OfficeLandmarkKind } from "@/config/office-theme";
import {
  getOfficeInternalPanelEntry,
  type OfficeInternalPanelId,
} from "../panels/internal-panel-catalog";
import type { OfficeObject } from "./types";

type CanonicalActivityRoomDefinition = {
  id: string;
  kind: OfficeLandmarkKind;
  displayName: string;
  skillId: string;
  panelId: OfficeInternalPanelId;
  aliases?: string[];
};

const DEFINITIONS: readonly CanonicalActivityRoomDefinition[] = [
  {
    id: "activity-training-gym",
    kind: "gym",
    displayName: "Training Gym",
    skillId: "self-improve",
    panelId: "skill-rollout",
    aliases: ["eval", "testing"],
  },
  {
    id: "activity-research-library",
    kind: "library",
    displayName: "Research Library",
    skillId: "research",
    panelId: "document-library",
    aliases: ["reference-grounding", "summarize", "customer-research"],
  },
  {
    id: "activity-production-studio",
    kind: "studio",
    displayName: "Production Studio",
    skillId: "content-impl-plan",
    panelId: "resource-bank",
    aliases: ["storyboard", "video-production"],
  },
  {
    id: "activity-planning-room",
    kind: "planning",
    displayName: "Planning Room",
    skillId: "plan",
    panelId: "ceo-workbench",
    aliases: ["impl-plan", "prd"],
  },
  {
    id: "activity-qa-arcade",
    kind: "qa-arcade",
    displayName: "QA Arcade",
    skillId: "qa",
    panelId: "evals",
    aliases: ["agent-qa-test", "visual-qa"],
  },
  {
    id: "activity-workshop",
    kind: "workshop",
    displayName: "Workshop",
    skillId: "execute",
    panelId: "harness",
    aliases: ["refactoring", "hardening"],
  },
  {
    id: "activity-skill-lab",
    kind: "skill-lab",
    displayName: "Skill Lab",
    skillId: "skill-creator",
    panelId: "skill-os",
    aliases: ["skill-maintenance"],
  },
  {
    id: "activity-organization-hall",
    kind: "organization-hall",
    displayName: "Organization Hall",
    skillId: "harness-advisor",
    panelId: "organization",
    aliases: ["deep-system-design"],
  },
  {
    id: "activity-resource-archive",
    kind: "resource-archive",
    displayName: "Resource Archive",
    skillId: "ingest-content",
    panelId: "resource-bank",
    aliases: ["knowledge-tidier"],
  },
  {
    id: "activity-comms-hub",
    kind: "comms-hub",
    displayName: "Comms Hub",
    skillId: "telegram-message",
    panelId: "user-communications",
    aliases: ["user-communications"],
  },
  {
    id: "activity-telemetry-console",
    kind: "telemetry-console",
    displayName: "Telemetry Console",
    skillId: "metric-advisor",
    panelId: "raw-telemetry",
    aliases: ["interval-update"],
  },
  {
    id: "activity-thread-data-lab",
    kind: "thread-data-lab",
    displayName: "Thread Data Lab",
    skillId: "runtime-debugging",
    panelId: "thread-data",
    aliases: ["codebase-analysis"],
  },
  {
    id: "farplane-map-console",
    kind: "world-orb",
    displayName: "Farplane Map",
    skillId: "farplane-map",
    panelId: "world",
  },
] as const;

export const CANONICAL_ACTIVITY_ROOM_KINDS = OFFICE_LANDMARK_KINDS;

const CANONICAL_ACTIVITY_ROOM_IDS = new Set(DEFINITIONS.map((definition) => definition.id));

function getCanonicalActivityRoomIdentity(object: OfficeObject): string | null {
  const metadataIdentity = object.metadata?.canonicalActivityRoomId;
  if (typeof metadataIdentity === "string" && CANONICAL_ACTIVITY_ROOM_IDS.has(metadataIdentity)) {
    return metadataIdentity;
  }
  const objectId = String(object._id);
  return CANONICAL_ACTIVITY_ROOM_IDS.has(objectId) ? objectId : null;
}

function canonicalActivityRoomPriority(object: OfficeObject): number {
  if (object.metadata?.officeKit && typeof object.metadata.officeKit === "object") return 3;
  if (object.metadata?.canonicalActivityRoom === true) return 2;
  return 1;
}

export function dedupeCanonicalActivityRooms(existing: OfficeObject[]): OfficeObject[] {
  const winners = new Map<string, OfficeObject>();
  for (const object of existing) {
    const identity = getCanonicalActivityRoomIdentity(object);
    if (!identity) continue;
    const winner = winners.get(identity);
    if (!winner || canonicalActivityRoomPriority(object) > canonicalActivityRoomPriority(winner)) {
      winners.set(identity, object);
    }
  }
  return existing.filter((object) => {
    const identity = getCanonicalActivityRoomIdentity(object);
    return !identity || winners.get(identity) === object;
  });
}

export function buildCanonicalActivityRooms(companyId?: string): OfficeObject[] {
  return DEFINITIONS.map((definition) => ({
    _id: definition.id,
    companyId,
    meshType: "activity-landmark",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    metadata: {
      canonicalActivityRoom: true,
      canonicalActivityRoomId: definition.id,
      landmarkKind: definition.kind,
      displayName: definition.displayName,
      roomFurnitureStyle: "executive-walnut-v1",
      uiBinding: {
        kind: "internalPanel",
        panelId: definition.panelId,
        title: getOfficeInternalPanelEntry(definition.panelId).label,
        openMode: "panel",
      },
      skillBinding: {
        skillId: definition.skillId,
        label: definition.displayName,
        aliases: definition.aliases,
        effectMode: "random",
        effectPool: ["ghost", "blink"],
      },
    },
  }));
}

export function hydrateCanonicalActivityRooms(
  existing: OfficeObject[],
  companyId?: string,
): OfficeObject[] {
  const canonicalById = new Map(
    buildCanonicalActivityRooms(companyId).map((room) => [String(room._id), room]),
  );
  return dedupeCanonicalActivityRooms(existing).map((object) => {
    const identity = getCanonicalActivityRoomIdentity(object);
    const canonical = identity ? canonicalById.get(identity) : undefined;
    if (!canonical) return object;
    return {
      ...canonical,
      ...object,
      companyId: object.companyId ?? canonical.companyId,
      metadata: { ...(canonical.metadata ?? {}), ...(object.metadata ?? {}) },
    };
  });
}

export function hasCanonicalActivityRoomSeed(existing: OfficeObject[]): boolean {
  return existing.some((object) => getCanonicalActivityRoomIdentity(object) !== null);
}

export function restoreCanonicalActivityRooms(
  existing: OfficeObject[],
  companyId?: string,
): OfficeObject[] {
  const dedupedExisting = hydrateCanonicalActivityRooms(existing, companyId);
  const canonical = buildCanonicalActivityRooms(companyId);
  const existingById = new Map(
    dedupedExisting.flatMap((object) => {
      const identity = getCanonicalActivityRoomIdentity(object);
      return identity ? [[identity, object] as const] : [];
    }),
  );
  const userObjects = dedupedExisting.filter(
    (object) => getCanonicalActivityRoomIdentity(object) === null,
  );
  return [
    ...userObjects,
    ...canonical.map((room) => {
      const persisted = existingById.get(String(room._id));
      return persisted
        ? {
            ...room,
            ...persisted,
            metadata: { ...(room.metadata ?? {}), ...(persisted.metadata ?? {}) },
          }
        : room;
    }),
  ];
}
