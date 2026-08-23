/**
 * Permanent integration facilities in the Office.
 *
 * These are system endpoints, never task creators or employee chat sessions.
 * Artifact work begins at a workstation; a facility only reveals its operated
 * system and delivery boundary.
 */

import type { DepartmentIslandId } from "./department-island-layout";
import type { OperatingRoomId } from "./operating-room-catalog";

export type SystemFacilityDefinition = {
  id: string;
  displayName: string;
  departmentId: DepartmentIslandId;
  roomId: OperatingRoomId;
  system: string;
  skillId: string;
  detail: string;
};

export const SYSTEM_FACILITY_REGISTRY = [
  {
    id: "x-publishing",
    displayName: "X Publishing",
    departmentId: "marketing",
    roomId: "production",
    system: "x",
    skillId: "x-account",
    detail:
      "Operates X delivery after a reviewed thread artifact is ready. It never creates a task or publishes automatically.",
  },
] as const satisfies readonly SystemFacilityDefinition[];

const BY_ID = new Map<string, SystemFacilityDefinition>(
  SYSTEM_FACILITY_REGISTRY.map((facility) => [facility.id, facility]),
);

export function resolveSystemFacility(
  value: string | null | undefined,
): SystemFacilityDefinition | undefined {
  return BY_ID.get(value?.trim() ?? "");
}
