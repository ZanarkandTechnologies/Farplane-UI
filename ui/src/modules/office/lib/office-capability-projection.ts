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
  capability?: { consumes?: readonly string[]; produces?: readonly string[] };
  department?: string;
  deliverable?: string;
  id: string;
  kind?: string;
  /** Workstations are specialist desks: `skill_id` is the primary, `skill_ids` every variant. */
  skill_id?: string;
  skill_ids?: readonly string[];
  specialist_id?: string;
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
 * Joins persistent Office objects to the generated capability payload. Farplane
 * owns which specialist desks exist and which skills each offers; this file
 * owns only where they sit. A workstation binds to the desk in its department
 * that lists its primary skill; a system facility binds to the facility node for
 * its skill. Matching is by skill id and department, never display name.
 */
export function projectOfficeCapabilityBindings(input: {
  graph: GeneratedCapabilityGraph;
  systemFacilities: readonly SystemFacilityDefinition[];
  workstations: readonly TicketSpecialistDefinition[];
}): OfficeCapabilityBindings {
  const issues: string[] = [];
  const desks = input.graph.nodes.filter((node) => node.kind === "workstation");
  const facilityNodes = new Map(
    input.graph.nodes
      .filter((node) => node.kind === "facility" && node.skill_id)
      .map((node) => [node.skill_id as string, node]),
  );
  const boundDesks = new Set<string>();
  const workstations = input.workstations.filter((workstation) => {
    const skillId = workstation.primarySkillId ?? "";
    const desk = desks.find((node) => (node.skill_ids ?? []).includes(skillId));
    if (!desk) {
      issues.push(`workstation ${workstation.id} has no specialist desk offering ${skillId || "a skill"}`);
      return false;
    }
    if (desk.department !== workstation.departmentId) {
      issues.push(`workstation ${workstation.id} does not match capability ${desk.id}`);
      return false;
    }
    boundDesks.add(desk.id);
    return true;
  });
  const systemFacilities = input.systemFacilities.filter((facility) => {
    const node = facilityNodes.get(facility.skillId);
    if (!node) return false;
    if (node.department !== facility.departmentId) {
      issues.push(`system facility ${facility.id} does not match capability ${node.id}`);
      return false;
    }
    return true;
  });

  for (const desk of desks) {
    if (!boundDesks.has(desk.id)) issues.push(`capability ${desk.id} has no Office workstation binding`);
  }
  for (const node of facilityNodes.values()) {
    if (!systemFacilities.some((item) => item.skillId === node.skill_id)) {
      issues.push(`capability ${node.id} has no Office system-facility binding`);
    }
  }
  return { issues, systemFacilities, workstations };
}
