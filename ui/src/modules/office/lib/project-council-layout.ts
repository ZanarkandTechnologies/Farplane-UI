/**
 * PROJECT COUNCIL LAYOUT
 * ======================
 * Owns the deterministic presentation geometry for the automatic Project
 * Council. Inputs are visible project ids plus the ticket-specialist registry;
 * outputs are equal council sectors, fixed room-internal specialist stations,
 * and camera-ready bounds. It only reads the existing archipelago plan and
 * never persists office objects, agents, or another layout model.
 */

import type { TicketSpecialistDefinition } from "@/lib/ticket-routing/specialist-registry";
import {
  ACTIVITY_DESTINATION_INTERIOR_INSET,
  ACTIVITY_DESTINATION_ROOM_DEPTH,
  ACTIVITY_DESTINATION_ROOM_WIDTH,
} from "./activity-destination-room";
import {
  type DepartmentIslandId,
  getDepartmentIslandGeometry,
  getDepartmentIslandId,
  planDepartmentArchipelago,
} from "./department-island-layout";
import {
  getOperatingRoomId,
  OPERATING_ROOM_CATALOG,
  type OperatingRoomId,
} from "./operating-room-catalog";
import type { OfficeObject } from "./types";

const TAU = Math.PI * 2;
const COUNCIL_START_ANGLE = -Math.PI / 2;
const MIN_COUNCIL_RADIUS = 5.8;
const MIN_SEAT_GAP = 2.1;
const COUNCIL_NEXUS_RADIUS = 3.55;
const COUNCIL_SEAT_RADIUS = 0.7;

export type ProjectCouncilPosition = [number, number, number];

export interface ProjectCouncilBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
}

export interface ProjectCouncilGeometry {
  center: ProjectCouncilPosition;
  /** The circular orbit where Council Leads are seated. */
  radius: number;
  nexusRadius: number;
  seatRadius: number;
}

export interface ProjectCouncilSector {
  projectId: string;
  index: number;
  startAngle: number;
  endAngle: number;
  angle: number;
  position: ProjectCouncilPosition;
}

export interface ProjectCouncilSpecialistStation {
  specialistId: string;
  displayName: string;
  roomId: OperatingRoomId;
  departmentId: DepartmentIslandId;
  position: ProjectCouncilPosition;
  rotationY: number;
}

export interface ProjectCouncilLayout {
  council: ProjectCouncilGeometry;
  sectors: ProjectCouncilSector[];
  specialistStations: ProjectCouncilSpecialistStation[];
  presentationBounds: ProjectCouncilBounds;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bounds(minX: number, maxX: number, minZ: number, maxZ: number): ProjectCouncilBounds {
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

function combineBounds(
  entries: readonly Pick<ProjectCouncilBounds, "minX" | "maxX" | "minZ" | "maxZ">[],
): ProjectCouncilBounds {
  return bounds(
    Math.min(...entries.map((entry) => entry.minX)),
    Math.max(...entries.map((entry) => entry.maxX)),
    Math.min(...entries.map((entry) => entry.minZ)),
    Math.max(...entries.map((entry) => entry.maxZ)),
  );
}

function normalizedProjectIds(visibleProjectIds: readonly string[]): string[] {
  return [...new Set(visibleProjectIds.filter((projectId) => projectId.trim().length > 0))].sort(
    compareText,
  );
}

function resolveCouncilRadius(projectCount: number): number {
  if (projectCount < 2) return MIN_COUNCIL_RADIUS;
  const radiusForSeatGap = MIN_SEAT_GAP / (2 * Math.sin(Math.PI / projectCount));
  return Math.max(MIN_COUNCIL_RADIUS, radiusForSeatGap);
}

function roomObjects(): OfficeObject[] {
  return OPERATING_ROOM_CATALOG.map((room) => ({
    _id: `project-council-room-${room.id}`,
    meshType: "activity-landmark",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    metadata: { operatingRoomId: room.id },
  }));
}

function getRoomCenters(): Map<OperatingRoomId, ProjectCouncilPosition> {
  const plan = planDepartmentArchipelago({ requiredObjects: [], destinations: roomObjects() });
  const centers = new Map<OperatingRoomId, ProjectCouncilPosition>();
  for (const room of plan?.placedDestinations ?? []) {
    const roomId = getOperatingRoomId(room);
    if (!roomId) continue;
    centers.set(roomId, [room.position[0], room.position[1], room.position[2]]);
  }
  return centers;
}

function stationOffsets(count: number): Array<{ x: number; z: number }> {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const xLimit = ACTIVITY_DESTINATION_ROOM_WIDTH / 2 - ACTIVITY_DESTINATION_INTERIOR_INSET;
  const zLimit = ACTIVITY_DESTINATION_ROOM_DEPTH / 2 - ACTIVITY_DESTINATION_INTERIOR_INSET;

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: columns === 1 ? 0 : -xLimit + (column / (columns - 1)) * xLimit * 2,
      z: rows === 1 ? 0 : -zLimit + (row / (rows - 1)) * zLimit * 2,
    };
  });
}

function stationRotation(center: ProjectCouncilPosition, position: ProjectCouncilPosition): number {
  return Math.atan2(center[0] - position[0], center[2] - position[2]);
}

function buildSpecialistStations(
  specialistRegistry: readonly TicketSpecialistDefinition[],
): ProjectCouncilSpecialistStation[] {
  const roomCenters = getRoomCenters();
  const specialistsByRoom = new Map<OperatingRoomId, TicketSpecialistDefinition[]>();
  for (const specialist of [...specialistRegistry].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    if (!roomCenters.has(specialist.roomId)) continue;
    const roomSpecialists = specialistsByRoom.get(specialist.roomId) ?? [];
    roomSpecialists.push(specialist);
    specialistsByRoom.set(specialist.roomId, roomSpecialists);
  }

  const stations: ProjectCouncilSpecialistStation[] = [];
  for (const [roomId, specialists] of specialistsByRoom) {
    const center = roomCenters.get(roomId);
    if (!center) continue;
    const offsets = stationOffsets(specialists.length);
    specialists.forEach((specialist, index) => {
      const offset = offsets[index];
      if (!offset) return;
      const position: ProjectCouncilPosition = [
        center[0] + offset.x,
        center[1],
        center[2] + offset.z,
      ];
      stations.push({
        specialistId: specialist.id,
        displayName: specialist.displayName,
        roomId,
        departmentId: getDepartmentIslandId(roomId),
        position,
        rotationY: stationRotation(center, position),
      });
    });
  }

  return stations.sort((left, right) => compareText(left.specialistId, right.specialistId));
}

/**
 * Plans the central council and permanent specialist stations for the automatic
 * Office3D view. Project and specialist order never affects the result.
 */
export function buildProjectCouncilLayout(
  visibleProjectIds: readonly string[],
  specialistRegistry: readonly TicketSpecialistDefinition[],
): ProjectCouncilLayout {
  const projectIds = normalizedProjectIds(visibleProjectIds);
  const radius = resolveCouncilRadius(projectIds.length);
  const council: ProjectCouncilGeometry = {
    center: [0, 0, 0],
    radius,
    nexusRadius: COUNCIL_NEXUS_RADIUS,
    seatRadius: COUNCIL_SEAT_RADIUS,
  };
  const sectorAngle = projectIds.length === 0 ? 0 : TAU / projectIds.length;
  const sectors = projectIds.map((projectId, index) => {
    const startAngle = COUNCIL_START_ANGLE + index * sectorAngle;
    const angle = startAngle + sectorAngle / 2;
    return {
      projectId,
      index,
      startAngle,
      endAngle: startAngle + sectorAngle,
      angle,
      position: [
        council.center[0] + Math.cos(angle) * council.radius,
        council.center[1],
        council.center[2] + Math.sin(angle) * council.radius,
      ] as ProjectCouncilPosition,
    };
  });
  const specialistStations = buildSpecialistStations(specialistRegistry);
  const councilBounds = bounds(
    council.center[0] - council.radius - council.seatRadius,
    council.center[0] + council.radius + council.seatRadius,
    council.center[2] - council.radius - council.seatRadius,
    council.center[2] + council.radius + council.seatRadius,
  );

  return {
    council,
    sectors,
    specialistStations,
    presentationBounds: combineBounds([
      ...getDepartmentIslandGeometry().map((island) => island.bounds),
      councilBounds,
    ]),
  };
}
