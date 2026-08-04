/**
 * OPERATING ROOM HOST PROJECTION
 * ==============================
 * Projects stable profile identities into final placed operating rooms.
 * Hosts are deskless presentation employees: persistent, non-wandering, and
 * intentionally absent from team membership and desk-demand calculations.
 */

import { getExecutiveSpecialist } from "@/lib/executive-specialists";
import type { RoomHostConversationKey } from "@/modules/runtime";
import { getOfficeSkillAnchorPosition } from "../skill-targeting";
import {
  getOperatingRoomByHostAgentId,
  getOperatingRoomId,
  OPERATING_ROOM_CATALOG,
} from "./operating-room-catalog";
import type { EmployeeData, OfficeObject } from "./types";

export function buildRoomHostConversationKey(input: {
  hostAgentId: string;
  selectedProjectId: string | null;
}): RoomHostConversationKey | null {
  const room = getOperatingRoomByHostAgentId(input.hostAgentId);
  if (!room) return null;
  if (room.hostScope === "office") {
    return { hostAgentId: room.hostAgentId, roomId: room.id, scopeKind: "office" };
  }
  const projectId = input.selectedProjectId?.trim();
  return projectId
    ? { hostAgentId: room.hostAgentId, roomId: room.id, scopeKind: "project", projectId }
    : null;
}

export function buildRoomHostEmployees(input: {
  officeObjects: OfficeObject[];
  companyId?: string;
}): EmployeeData[] {
  const objectsByRoomId = new Map(
    input.officeObjects.flatMap((object) => {
      const roomId = getOperatingRoomId(object);
      return roomId ? ([[roomId, object]] as const) : [];
    }),
  );

  return OPERATING_ROOM_CATALOG.flatMap((room) => {
    const object = objectsByRoomId.get(room.id);
    const profile = getExecutiveSpecialist(room.hostAgentId);
    if (!object || !profile) return [];
    return [
      {
        _id: `employee-${profile.agentId}`,
        companyId: input.companyId,
        builtInRole: profile.role,
        name: profile.name,
        team: room.displayName,
        initialPosition: getOfficeSkillAnchorPosition(object),
        isBusy: false,
        isCEO: false,
        isSupervisor: true,
        jobTitle: profile.title,
        status: "info",
        statusMessage: profile.status,
        activityState: "idle",
        activityLabel: `${room.displayName} host`,
        presencePersistent: true,
        persistenceTag: "pinned",
        wantsToWander: false,
        appearance: profile.appearance,
      },
    ];
  });
}
