import { describe, expect, it } from "vitest";
import { TICKET_SPECIALIST_REGISTRY } from "@/lib/ticket-routing/specialist-registry";
import {
  getOfficeCapabilityDepartmentForSpecialist,
  getOfficeCapabilityDepartmentsForRoom,
  OFFICE_CAPABILITY_DEPARTMENTS,
  validateOfficeCapabilityProjection,
} from "./office-capability-projection";
import { OPERATING_ROOM_IDS } from "./operating-room-catalog";

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

  it("puts every ticket specialist at one capability station in its department", () => {
    const routedSpecialists = OFFICE_CAPABILITY_DEPARTMENTS.flatMap((department) =>
      department.specialistIds.map((specialistId) => [specialistId, department.id]),
    );

    expect(new Set(routedSpecialists.map(([specialistId]) => specialistId)).size).toBe(
      routedSpecialists.length,
    );
    expect(
      TICKET_SPECIALIST_REGISTRY.every(
        (specialist) => getOfficeCapabilityDepartmentForSpecialist(specialist.id) !== undefined,
      ),
    ).toBe(true);
    expect(
      TICKET_SPECIALIST_REGISTRY.filter((specialist) => specialist.roomId === "production").map(
        (specialist) => getOfficeCapabilityDepartmentForSpecialist(specialist.id)?.id,
      ),
    ).toEqual(["marketing", "marketing", "marketing"]);
    expect(
      TICKET_SPECIALIST_REGISTRY.filter((specialist) => specialist.roomId === undefined).map(
        (specialist) => [specialist.id, specialist.departmentId],
      ),
    ).toEqual([
      ["customer-research-specialist", "customer"],
      ["lead-scout-specialist", "sales"],
      ["first-value-outreach-specialist", "sales"],
      ["outreach-campaign-specialist", "sales"],
      ["solution-specialist", "deals"],
      ["personalized-offer-specialist", "deals"],
      ["proposal-specialist", "deals"],
    ]);
  });

  it("reports no invalid room or ticket-specialist bindings", () => {
    expect(
      validateOfficeCapabilityProjection({
        roomIds: OPERATING_ROOM_IDS,
        specialists: TICKET_SPECIALIST_REGISTRY,
      }),
    ).toEqual([]);
  });
});
