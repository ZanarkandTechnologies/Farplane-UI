/**
 * OFFICE CAPABILITY PROJECTION
 * ============================
 * Translates Farplane's durable capability taxonomy into the Office's visual
 * vocabulary. It is an explanatory projection only: it never schedules work,
 * creates employees, or derives a ticket specialist from a skill invocation.
 *
 * A physical room may support more than one capability department. Artifact
 * specialists remain fixed service stations inside a shared Studio or
 * department service bay; they do not become a room or a persistent employee
 * of their own.
 */

import type { TicketSpecialistDefinition } from "@/lib/ticket-routing/specialist-registry";
import type { OperatingRoomId } from "./operating-room-catalog";

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
  /** Muted, night-safe accent for signs and specialist station trims. */
  accentColor: string;
  /** Existing full-room UIs owned by this capability. Empty means service-bay only. */
  roomIds: readonly OperatingRoomId[];
  /** Declared workflow roots used by Capability Map; not invocation triggers. */
  workflowSkillIds: readonly string[];
  /** Ticket specialist services that currently have a visible station. */
  specialistIds: readonly string[];
};

export const OFFICE_CAPABILITY_DEPARTMENTS = [
  {
    id: "back-office",
    displayName: "Back Office",
    accentColor: "#a8ad76",
    roomIds: ["organization", "finance"],
    workflowSkillIds: ["knowledge-tidier", "update-memory"],
    specialistIds: [],
  },
  {
    id: "sales",
    displayName: "Sales",
    accentColor: "#bf8aa8",
    roomIds: [],
    workflowSkillIds: ["lead-scout", "outreach-impl-plan"],
    specialistIds: [
      "lead-scout-specialist",
      "first-value-outreach-specialist",
      "outreach-campaign-specialist",
    ],
  },
  {
    id: "deals",
    displayName: "Deals",
    accentColor: "#c9826b",
    roomIds: [],
    workflowSkillIds: ["solution-shaping", "personalized-offer", "proposal-pricing"],
    specialistIds: ["solution-specialist", "personalized-offer-specialist", "proposal-specialist"],
  },
  {
    id: "marketing",
    displayName: "Marketing",
    accentColor: "#c8ad72",
    roomIds: ["production"],
    workflowSkillIds: ["social-content", "ad-advisor", "landing-page", "product-photography"],
    specialistIds: ["landing-page-specialist", "content-specialist", "video-specialist"],
  },
  {
    id: "operations",
    displayName: "Operations",
    accentColor: "#9b8bc5",
    roomIds: ["self-improvement", "qa", "harness", "skills", "telemetry"],
    workflowSkillIds: ["init-advisor", "impl-plan", "automation-advisor", "agent-testability-plan"],
    specialistIds: ["skill-specialist"],
  },
  {
    id: "intelligence",
    displayName: "Intelligence",
    accentColor: "#7fa9c0",
    roomIds: ["research", "thread-data"],
    workflowSkillIds: ["agency-opportunity-research", "feed-scout", "learn-from-video"],
    specialistIds: ["research-specialist", "customer-research-specialist"],
  },
  {
    id: "customer",
    displayName: "Customer",
    accentColor: "#79b8a2",
    roomIds: ["research", "comms"],
    workflowSkillIds: ["customer-research"],
    specialistIds: [],
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

const DEPARTMENT_BY_SPECIALIST_ID = new Map<string, OfficeCapabilityDepartment>(
  OFFICE_CAPABILITY_DEPARTMENTS.flatMap((department) =>
    department.specialistIds.map((specialistId) => [specialistId, department] as const),
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
  return DEPARTMENT_BY_SPECIALIST_ID.get(specialistId);
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

  const declaredSpecialistIds = new Set(input.specialists.map((specialist) => specialist.id));
  for (const department of OFFICE_CAPABILITY_DEPARTMENTS) {
    for (const specialistId of department.specialistIds) {
      if (!declaredSpecialistIds.has(specialistId)) {
        issues.push(`${department.id} references unknown specialist ${specialistId}`);
      }
    }
  }
  for (const specialist of input.specialists) {
    const department = getOfficeCapabilityDepartmentForSpecialist(specialist.id);
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
