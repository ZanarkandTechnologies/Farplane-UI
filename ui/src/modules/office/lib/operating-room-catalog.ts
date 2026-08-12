/**
 * OPERATING ROOM CATALOG
 * ======================
 * Owns the fixed first-party operating-room inventory and the narrow migration
 * from enumerated legacy activity-room identities. User landmarks are never
 * inferred from visual kind or display name.
 */

import type { OfficeLandmarkKind } from "@/config/office-theme";
import type { OfficeInternalPanelId } from "../panels/internal-panel-catalog";
import type { OfficeObject } from "./types";

export const OPERATING_ROOM_SCHEMA_VERSION = 1;

export type OperatingRoomId =
  | "self-improvement"
  | "research"
  | "production"
  | "qa"
  | "harness"
  | "skills"
  | "organization"
  | "finance"
  | "comms"
  | "telemetry"
  | "thread-data";

export type OperatingRoomHostScope = "office" | "selected-project";

export type OperatingRoomDefinition = {
  id: OperatingRoomId;
  displayName: string;
  panelId: OfficeInternalPanelId;
  hostAgentId: string;
  hostScope: OperatingRoomHostScope;
  advisorSkillIds: readonly string[];
  activitySkillIds: readonly string[];
  visualKind: OfficeLandmarkKind;
  placement: {
    kind: "perimeter-room";
    hostAnchor: "interior";
  };
};

export type OperatingRoomMetadata = {
  operatingRoomId: OperatingRoomId;
  schemaVersion: typeof OPERATING_ROOM_SCHEMA_VERSION;
};

const room = (definition: Omit<OperatingRoomDefinition, "placement">): OperatingRoomDefinition => ({
  ...definition,
  placement: { kind: "perimeter-room", hostAnchor: "interior" },
});

export const OPERATING_ROOM_CATALOG = [
  room({
    id: "self-improvement",
    displayName: "Self-Improvement Lab",
    panelId: "self-improvement-runs",
    hostAgentId: "farplane-improvement",
    hostScope: "office",
    advisorSkillIds: ["self-improve"],
    activitySkillIds: ["self-improve"],
    visualKind: "gym",
  }),
  room({
    id: "research",
    displayName: "Research Library",
    panelId: "document-library",
    hostAgentId: "farplane-research",
    hostScope: "selected-project",
    advisorSkillIds: ["research"],
    activitySkillIds: ["research", "customer-research", "agency-opportunity-research"],
    visualKind: "library",
  }),
  room({
    id: "production",
    displayName: "Production Studio",
    panelId: "resource-bank",
    hostAgentId: "farplane-production",
    hostScope: "selected-project",
    advisorSkillIds: [
      "asset-advisor",
      "editing-advisor",
      "copywriting-advisor",
      "ai-image-advisor",
      "ai-video-advisor",
    ],
    activitySkillIds: [
      "content-impl-plan",
      "landing-page",
      "social-content",
      "storyboard",
      "video-production",
    ],
    visualKind: "studio",
  }),
  room({
    id: "qa",
    displayName: "QA Lab",
    panelId: "evals",
    hostAgentId: "farplane-qa",
    hostScope: "selected-project",
    advisorSkillIds: ["testing", "proof-advisor"],
    activitySkillIds: ["qa", "eval", "visual-qa", "agent-qa-test"],
    visualKind: "qa-arcade",
  }),
  room({
    id: "harness",
    displayName: "Harness Workshop",
    panelId: "harness",
    hostAgentId: "farplane-harness",
    hostScope: "office",
    advisorSkillIds: ["harness-advisor"],
    activitySkillIds: ["harness-creator", "optimize-harness"],
    visualKind: "workshop",
  }),
  room({
    id: "skills",
    displayName: "Skill Lab",
    panelId: "skill-os",
    hostAgentId: "farplane-skills",
    hostScope: "office",
    advisorSkillIds: ["skill-creator"],
    activitySkillIds: ["skill-creator", "skill-maintenance"],
    visualKind: "skill-lab",
  }),
  room({
    id: "organization",
    displayName: "Organization Hall",
    panelId: "organization",
    hostAgentId: "farplane-people",
    hostScope: "office",
    advisorSkillIds: [],
    activitySkillIds: [],
    visualKind: "organization-hall",
  }),
  room({
    id: "finance",
    displayName: "Finance Office",
    panelId: "leverage",
    hostAgentId: "farplane-finance",
    hostScope: "office",
    advisorSkillIds: [],
    activitySkillIds: [],
    visualKind: "finance-office",
  }),
  room({
    id: "comms",
    displayName: "Comms Hub",
    panelId: "user-communications",
    hostAgentId: "farplane-comms",
    hostScope: "office",
    advisorSkillIds: [],
    activitySkillIds: [],
    visualKind: "comms-hub",
  }),
  room({
    id: "telemetry",
    displayName: "Telemetry Console",
    panelId: "telemetry",
    hostAgentId: "farplane-usage",
    hostScope: "office",
    advisorSkillIds: [],
    activitySkillIds: [],
    visualKind: "telemetry-console",
  }),
  room({
    id: "thread-data",
    displayName: "Thread Data Lab",
    panelId: "thread-data",
    hostAgentId: "farplane-mining",
    hostScope: "office",
    advisorSkillIds: [],
    activitySkillIds: [],
    visualKind: "thread-data-lab",
  }),
] as const satisfies readonly OperatingRoomDefinition[];

export const OPERATING_ROOM_IDS = OPERATING_ROOM_CATALOG.map((definition) => definition.id);

export function getOperatingRoomByHostAgentId(
  hostAgentId: string,
): OperatingRoomDefinition | undefined {
  return OPERATING_ROOM_CATALOG.find((definition) => definition.hostAgentId === hostAgentId);
}

const DEFINITIONS_BY_ID = new Map<OperatingRoomId, OperatingRoomDefinition>(
  OPERATING_ROOM_CATALOG.map((definition) => [definition.id, definition]),
);
const OPERATING_ROOM_ID_SET = new Set<string>(OPERATING_ROOM_IDS);

const LEGACY_ROOM_ID_TO_OPERATING_ROOM_ID = new Map<string, OperatingRoomId>([
  ["activity-training-gym", "self-improvement"],
  ["activity-research-library", "research"],
  ["activity-production-studio", "production"],
  ["activity-qa-arcade", "qa"],
  ["activity-workshop", "harness"],
  ["activity-skill-lab", "skills"],
  ["activity-resource-archive", "finance"],
  ["activity-organization-hall", "organization"],
  ["activity-comms-hub", "comms"],
  ["activity-telemetry-console", "telemetry"],
  ["activity-thread-data-lab", "thread-data"],
]);

const RETIRED_LEGACY_ROOM_IDS = new Set(["activity-planning-room", "farplane-map-console"]);

function legacyIdentity(input: {
  objectId: string;
  metadata?: Record<string, unknown>;
}): string | null {
  const metadataId = input.metadata?.canonicalActivityRoomId;
  if (typeof metadataId === "string") {
    if (LEGACY_ROOM_ID_TO_OPERATING_ROOM_ID.has(metadataId)) return metadataId;
    if (RETIRED_LEGACY_ROOM_IDS.has(metadataId)) return metadataId;
  }
  const objectId = input.objectId;
  if (LEGACY_ROOM_ID_TO_OPERATING_ROOM_ID.has(objectId)) return objectId;
  return RETIRED_LEGACY_ROOM_IDS.has(objectId) ? objectId : null;
}

export function isOperatingRoomId(value: unknown): value is OperatingRoomId {
  return typeof value === "string" && OPERATING_ROOM_ID_SET.has(value);
}

export function getOperatingRoomDefinition(roomId: OperatingRoomId): OperatingRoomDefinition {
  const definition = DEFINITIONS_BY_ID.get(roomId);
  if (!definition) throw new Error(`Unknown operating room: ${roomId}`);
  return definition;
}

export function getOperatingRoomId(object: OfficeObject): OperatingRoomId | null {
  return resolveOperatingRoomId({ objectId: String(object._id), metadata: object.metadata });
}

export function resolveOperatingRoomId(input: {
  objectId: string;
  metadata?: Record<string, unknown>;
}): OperatingRoomId | null {
  const currentId = input.metadata?.operatingRoomId;
  if (isOperatingRoomId(currentId)) return currentId;
  const legacyId = legacyIdentity(input);
  return legacyId ? (LEGACY_ROOM_ID_TO_OPERATING_ROOM_ID.get(legacyId) ?? null) : null;
}

export function isRetiredLegacyOperatingRoom(object: OfficeObject): boolean {
  const identity = legacyIdentity({ objectId: String(object._id), metadata: object.metadata });
  return identity !== null && RETIRED_LEGACY_ROOM_IDS.has(identity);
}

function roomPriority(object: OfficeObject): number {
  if (object.metadata?.officeKit && typeof object.metadata.officeKit === "object") return 4;
  if (isOperatingRoomId(object.metadata?.operatingRoomId)) return 3;
  if (object.metadata?.canonicalActivityRoom === true) return 2;
  return 1;
}

export function dedupeOperatingRooms(existing: OfficeObject[]): OfficeObject[] {
  const winners = new Map<OperatingRoomId, OfficeObject>();
  for (const object of existing) {
    const identity = getOperatingRoomId(object);
    if (!identity) continue;
    const winner = winners.get(identity);
    if (!winner || roomPriority(object) > roomPriority(winner)) winners.set(identity, object);
  }
  return existing.filter((object) => {
    const identity = getOperatingRoomId(object);
    return !identity || winners.get(identity) === object;
  });
}

function buildSkillBinding(
  definition: OperatingRoomDefinition,
): Record<string, unknown> | undefined {
  const skillIds = [...new Set([...definition.advisorSkillIds, ...definition.activitySkillIds])];
  const [skillId, ...aliases] = skillIds;
  return skillId
    ? {
        skillId,
        ...(aliases.length > 0 ? { skillIds: aliases } : {}),
        label: definition.displayName,
        effectMode: "random",
        effectPool: ["ghost", "blink"],
      }
    : undefined;
}

function metadataForDefinition(definition: OperatingRoomDefinition): Record<string, unknown> {
  const skillBinding = buildSkillBinding(definition);
  return {
    operatingRoomId: definition.id,
    schemaVersion: OPERATING_ROOM_SCHEMA_VERSION,
    landmarkKind: definition.visualKind,
    displayName: definition.displayName,
    roomFurnitureStyle: "executive-walnut-v1",
    uiBinding: {
      kind: "internalPanel",
      panelId: definition.panelId,
      title: definition.displayName,
      openMode: "panel",
    },
    ...(skillBinding ? { skillBinding } : {}),
  };
}

export function buildOperatingRooms(companyId?: string): OfficeObject[] {
  return OPERATING_ROOM_CATALOG.map((definition) => ({
    _id: `operating-room-${definition.id}`,
    companyId,
    meshType: "activity-landmark",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    metadata: metadataForDefinition(definition),
  }));
}

function migrateRoomObject(object: OfficeObject, roomId: OperatingRoomId): OfficeObject {
  const definition = getOperatingRoomDefinition(roomId);
  const {
    canonicalActivityRoom: _canonicalMarker,
    canonicalActivityRoomId: _canonicalId,
    skillBinding: _oldSkillBinding,
    uiBinding: _oldUiBinding,
    ...preservedMetadata
  } = object.metadata ?? {};
  return {
    ...object,
    meshType: "activity-landmark",
    metadata: { ...preservedMetadata, ...metadataForDefinition(definition) },
  };
}

export function hydrateOperatingRooms(existing: OfficeObject[]): OfficeObject[] {
  return dedupeOperatingRooms(existing)
    .filter((object) => !isRetiredLegacyOperatingRoom(object))
    .map((object) => {
      const roomId = getOperatingRoomId(object);
      return roomId ? migrateRoomObject(object, roomId) : object;
    });
}

export function restoreOperatingRooms(
  existing: OfficeObject[],
  companyId?: string,
): OfficeObject[] {
  const hydrated = hydrateOperatingRooms(existing);
  const existingById = new Map(
    hydrated.flatMap((object) => {
      const roomId = getOperatingRoomId(object);
      return roomId ? ([[roomId, object]] as const) : [];
    }),
  );
  const userObjects = hydrated.filter((object) => getOperatingRoomId(object) === null);
  return [
    ...userObjects,
    ...buildOperatingRooms(companyId).map((room) => {
      const roomId = getOperatingRoomId(room);
      const persisted = roomId ? existingById.get(roomId) : undefined;
      return persisted ?? room;
    }),
  ];
}

function inferManualFinancePlacement(existing: OfficeObject[]): {
  position: [number, number, number];
  rotation: [number, number, number];
} | null {
  const northRooms = existing
    .filter((object) => {
      const rotationY = object.rotation?.[1] ?? 0;
      return getOperatingRoomId(object) !== null && Math.abs(rotationY) < 0.001;
    })
    .sort((left, right) => left.position[0] - right.position[0]);
  if (northRooms.length < 3) return null;
  const gaps = northRooms.slice(1).map((room, index) => ({
    index,
    width: room.position[0] - (northRooms[index]?.position[0] ?? room.position[0]),
  }));
  const orderedWidths = gaps
    .map((gap) => gap.width)
    .filter((width) => width > 0)
    .sort((a, b) => a - b);
  const typicalWidth = orderedWidths[0];
  const largestGap = gaps.sort((left, right) => right.width - left.width)[0];
  if (!largestGap || !typicalWidth || largestGap.width < typicalWidth * 1.5) return null;
  const left = northRooms[largestGap.index];
  const right = northRooms[largestGap.index + 1];
  if (!left || !right) return null;
  return {
    position: [
      (left.position[0] + right.position[0]) / 2,
      (left.position[1] + right.position[1]) / 2,
      (left.position[2] + right.position[2]) / 2,
    ],
    rotation: [0, 0, 0],
  };
}

export function restoreMissingManualFinanceOffice(
  existing: OfficeObject[],
  companyId?: string,
): OfficeObject[] {
  const hydrated = hydrateOperatingRooms(existing);
  const roomIds = new Set(
    hydrated.flatMap((object) => {
      const roomId = getOperatingRoomId(object);
      return roomId ? [roomId] : [];
    }),
  );
  if (roomIds.has("finance") || roomIds.size !== OPERATING_ROOM_CATALOG.length - 1) {
    return hydrated;
  }
  const placement = inferManualFinancePlacement(hydrated);
  const financeRoom = buildOperatingRooms(companyId).find(
    (object) => getOperatingRoomId(object) === "finance",
  );
  return placement && financeRoom
    ? [...hydrated, { ...financeRoom, position: placement.position, rotation: placement.rotation }]
    : hydrated;
}

export function hasOperatingRoomSeed(existing: OfficeObject[]): boolean {
  return existing.some(
    (object) => getOperatingRoomId(object) !== null || isRetiredLegacyOperatingRoom(object),
  );
}
