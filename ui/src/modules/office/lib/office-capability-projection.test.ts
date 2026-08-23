import { describe, expect, it } from "vitest";
import { TICKET_SPECIALIST_REGISTRY } from "@/lib/ticket-routing/specialist-registry";
import {
  getOfficeCapabilityDepartmentForSpecialist,
  getOfficeCapabilityDepartmentsForRoom,
  OFFICE_CAPABILITY_DEPARTMENTS,
  projectOfficeCapabilityBindings,
  validateOfficeCapabilityProjection,
} from "./office-capability-projection";
import { OPERATING_ROOM_IDS } from "./operating-room-catalog";
import { SYSTEM_FACILITY_REGISTRY } from "./system-facility-registry";

const X_CAPABILITY_GRAPH = {
  nodes: [
    {
      id: "skill:x-thread",
      skill_id: "x-thread",
      group: "marketing",
      kind: "workstation",
      capability: { consumes: ["content-brief"], produces: ["x-thread-draft"] },
    },
    {
      id: "skill:x-account",
      skill_id: "x-account",
      group: "marketing",
      kind: "facility",
      capability: { system: "x" },
    },
  ],
} as const;

describe("Office capability projection", () => {
  it("covers every real operating room while keeping roomless departments service-bay only", () => {
    expect(
      OPERATING_ROOM_IDS.every(
        (roomId) => getOfficeCapabilityDepartmentsForRoom(roomId).length > 0,
      ),
    ).toBe(true);
    expect(
      getOfficeCapabilityDepartmentsForRoom("comms").map((department) => department.id),
    ).toEqual(["customer"]);
    expect(
      getOfficeCapabilityDepartmentsForRoom("finance").map((department) => department.id),
    ).toEqual(["back-office"]);
  });

  it("keeps workstation routing in the registry while the projection owns only visual departments", () => {
    expect(
      TICKET_SPECIALIST_REGISTRY.every(
        (specialist) => getOfficeCapabilityDepartmentForSpecialist(specialist.id) !== undefined,
      ),
    ).toBe(true);
    expect(
      TICKET_SPECIALIST_REGISTRY.filter(
        (specialist) => "roomId" in specialist && specialist.roomId === "production",
      ).map((specialist) => getOfficeCapabilityDepartmentForSpecialist(specialist.id)?.id),
    ).toEqual(["marketing", "marketing", "marketing"]);
    expect(
      TICKET_SPECIALIST_REGISTRY.filter((specialist) => !("roomId" in specialist)).map(
        (specialist) => [specialist.id, specialist.departmentId],
      ),
    ).toEqual([
      ["lead-scout-specialist", "sales"],
      ["first-value-outreach-specialist", "sales"],
      ["outreach-campaign-specialist", "sales"],
      ["solution-specialist", "deals"],
      ["personalized-offer-specialist", "deals"],
      ["proposal-specialist", "deals"],
    ]);
    expect(
      OFFICE_CAPABILITY_DEPARTMENTS.every((department) => !("workflowSkillIds" in department)),
    ).toBe(true);
    expect(
      OFFICE_CAPABILITY_DEPARTMENTS.every((department) => !("specialistIds" in department)),
    ).toBe(true);
  });

  it("reports no invalid room or ticket-specialist bindings", () => {
    expect(
      validateOfficeCapabilityProjection({
        roomIds: OPERATING_ROOM_IDS,
        specialists: TICKET_SPECIALIST_REGISTRY,
      }),
    ).toEqual([]);
  });

  it("renders permanent Office objects only when the generated capability graph admits them", () => {
    expect(
      projectOfficeCapabilityBindings({
        graph: X_CAPABILITY_GRAPH,
        workstations: TICKET_SPECIALIST_REGISTRY,
        systemFacilities: SYSTEM_FACILITY_REGISTRY,
      }),
    ).toEqual({
      issues: [],
      workstations: [TICKET_SPECIALIST_REGISTRY[1]],
      systemFacilities: [SYSTEM_FACILITY_REGISTRY[0]],
    });
  });

  it("withholds an Office object when its generated capability role disagrees", () => {
    const graphWithMismatchedSystem = {
      nodes: [X_CAPABILITY_GRAPH.nodes[0], { ...X_CAPABILITY_GRAPH.nodes[1], kind: "workstation" }],
    } as const;

    const projection = projectOfficeCapabilityBindings({
      graph: graphWithMismatchedSystem,
      workstations: TICKET_SPECIALIST_REGISTRY,
      systemFacilities: SYSTEM_FACILITY_REGISTRY,
    });

    expect(projection.systemFacilities).toEqual([]);
    expect(projection.issues).toContain(
      "system facility x-publishing does not match capability skill:x-account",
    );
  });
});
