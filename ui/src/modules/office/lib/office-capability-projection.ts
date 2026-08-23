/**
 * OFFICE CAPABILITY PROJECTION
 * ============================
 * Translates Farplane's durable capability taxonomy into the Office's visual
 * vocabulary. It is an explanatory projection only: it never schedules work,
 * creates employees, or derives a ticket specialist from a skill invocation.
 *
 * A physical room may support more than one capability department. The
 * generated capability graph owns which workstations and facilities exist;
 * this file owns only the Office's visual islands and host rooms.
 */

import {
  resolveTicketSpecialist,
  type TicketSpecialistDefinition,
} from "@/lib/ticket-routing/specialist-registry";
import type { OperatingRoomId } from "./operating-room-catalog";
import type { SystemFacilityDefinition } from "./system-facility-registry";

export const OFFICE_CAPABILITY_DEPARTMENT_IDS = [
  "back-office",
  "sales",
  "deals",
  "marketing",
  "operations",
  "intelligence",
  "customer",
] as const;

export type OfficeCapabilityDepartmentId = (typeof OFFICE_CAPABILITY_DEPARTMENT_IDS)[number];

export type OfficeCapabilityDepartment = {
  id: OfficeCapabilityDepartmentId;
  displayName: string;
  /** Muted, night-safe accent for signs and permanent capability trims. */
  accentColor: string;
  /** Existing full-room UIs owned by this capability. Empty means service-bay only. */
  roomIds: readonly OperatingRoomId[];
};

export type GeneratedCapabilityNode = {
  capability?: { consumes?: string[]; produces?: string[]; system?: string };
  group?: string;
  id: string;
  kind?: string;
  skill_id?: string;
};

export type GeneratedCapabilityGraph = { nodes: readonly GeneratedCapabilityNode[] };

export type OfficeCapabilityBindings = {
  issues: string[];
  systemFacilities: SystemFacilityDefinition[];
  workstations: TicketSpecialistDefinition[];
};

export const OFFICE_CAPABILITY_DEPARTMENTS = [
  {
    id: "back-office",
    displayName: "Back Office",
    accentColor: "#a8ad76",
    roomIds: ["organization", "finance"],
  },
  {
    id: "sales",
    displayName: "Sales",
    accentColor: "#bf8aa8",
    roomIds: [],
  },
  {
    id: "deals",
    displayName: "Deals",
    accentColor: "#c9826b",
    roomIds: [],
  },
  {
    id: "marketing",
    displayName: "Marketing",
    accentColor: "#c8ad72",
    roomIds: ["production"],
  },
  {
    id: "operations",
    displayName: "Operations",
    accentColor: "#9b8bc5",
    roomIds: ["self-improvement", "qa", "harness", "skills", "telemetry"],
  },
  {
    id: "intelligence",
    displayName: "Intelligence",
    accentColor: "#7fa9c0",
    roomIds: ["research", "thread-data"],
  },
  {
    id: "customer",
    displayName: "Customer",
    accentColor: "#79b8a2",
    roomIds: ["research", "comms"],
  },
] as const satisfies readonly OfficeCapabilityDepartment[];

const DEPARTMENT_BY_ID = new Map<OfficeCapabilityDepartmentId, OfficeCapabilityDepartment>(
  OFFICE_CAPABILITY_DEPARTMENTS.map((department) => [department.id, department]),
);

const DEPARTMENTS_BY_ROOM_ID = new Map<OperatingRoomId, OfficeCapabilityDepartment[]>(
  OFFICE_CAPABILITY_DEPARTMENTS.reduce<Map<OperatingRoomId, OfficeCapabilityDepartment[]>>(
    (departmentsByRoom, department) => {
      for (const roomId of department.roomIds) {
        departmentsByRoom.set(roomId, [...(departmentsByRoom.get(roomId) ?? []), department]);
      }
      return departmentsByRoom;
    },
    new Map(),
  ),
);

export function getOfficeCapabilityDepartment(
  departmentId: OfficeCapabilityDepartmentId,
): OfficeCapabilityDepartment {
  const department = DEPARTMENT_BY_ID.get(departmentId);
  if (!department) throw new Error(`Unknown Office capability department: ${departmentId}`);
  return department;
}

export function getOfficeCapabilityDepartmentsForRoom(
  roomId: OperatingRoomId,
): readonly OfficeCapabilityDepartment[] {
  return DEPARTMENTS_BY_ROOM_ID.get(roomId) ?? [];
}

export function getOfficeCapabilityDepartmentForSpecialist(
  specialistId: string,
): OfficeCapabilityDepartment | undefined {
  // Specialist routing is declared by its own registry. This compatibility
  // helper stays at the visual boundary rather than becoming a second map.
  const specialist = resolveTicketSpecialist(specialistId);
  return specialist ? DEPARTMENT_BY_ID.get(specialist.departmentId) : undefined;
}

/**
 * Reports crosswalk integrity without claiming missing services exist. Callers
 * can use this in diagnostics; UI rendering should keep unknown input unplaced.
 */
export function validateOfficeCapabilityProjection(input: {
  roomIds: readonly OperatingRoomId[];
  specialists: readonly TicketSpecialistDefinition[];
}): string[] {
  const issues: string[] = [];
  const configuredRooms = new Set(input.roomIds);
  for (const department of OFFICE_CAPABILITY_DEPARTMENTS) {
    for (const roomId of department.roomIds) {
      if (!configuredRooms.has(roomId)) {
        issues.push(`${department.id} references unknown room ${roomId}`);
      }
    }
  }

  for (const specialist of input.specialists) {
    const department = DEPARTMENT_BY_ID.get(specialist.departmentId);
    if (!department) {
      issues.push(`specialist ${specialist.id} has no capability department`);
      continue;
    }
    if (department.id !== specialist.departmentId) {
      issues.push(
        `specialist ${specialist.id} declares ${specialist.departmentId}, outside ${department.id}`,
      );
    }
    if (specialist.roomId && !department.roomIds.includes(specialist.roomId)) {
      issues.push(
        `specialist ${specialist.id} is assigned to ${specialist.roomId}, outside ${department.id}`,
      );
    }
  }
  return issues;
}

/**
 * Joins persistent Office objects to the generated capability payload. Unknown
 * or unclassified registry entries stay out of the classified Office view;
 * matching is by declared skill id and department, never display name.
 */
export function projectOfficeCapabilityBindings(input: {
  graph: GeneratedCapabilityGraph;
  systemFacilities: readonly SystemFacilityDefinition[];
  workstations: readonly TicketSpecialistDefinition[];
}): OfficeCapabilityBindings {
  const issues: string[] = [];
  const nodeBySkillId = new Map(
    input.graph.nodes
      .filter((node) => Boolean(node.skill_id))
      .map((node) => [node.skill_id as string, node]),
  );
  const workstations = input.workstations.filter((workstation) => {
    const node = nodeBySkillId.get(workstation.primarySkillId ?? "");
    if (!node) return false;
    if (node.kind !== "workstation" || node.group !== workstation.departmentId) {
      issues.push(`workstation ${workstation.id} does not match capability ${node.id}`);
      return false;
    }
    const produces = node.capability?.produces ?? [];
    if (produces.length !== 1) {
      issues.push(`workstation ${workstation.id} lacks one declared artifact output`);
      return false;
    }
    return true;
  });
  const systemFacilities = input.systemFacilities.filter((facility) => {
    const node = nodeBySkillId.get(facility.skillId);
    if (!node) return false;
    if (
      node.kind !== "facility" ||
      node.group !== facility.departmentId ||
      node.capability?.system !== facility.system
    ) {
      issues.push(`system facility ${facility.id} does not match capability ${node.id}`);
      return false;
    }
    return true;
  });

  for (const node of nodeBySkillId.values()) {
    if (
      node.kind === "workstation" &&
      !workstations.some((item) => item.primarySkillId === node.skill_id)
    ) {
      issues.push(`capability ${node.id} has no Office workstation binding`);
    }
    if (
      node.kind === "facility" &&
      !systemFacilities.some((item) => item.skillId === node.skill_id)
    ) {
      issues.push(`capability ${node.id} has no Office system-facility binding`);
    }
  }
  return { issues, systemFacilities, workstations };
}
