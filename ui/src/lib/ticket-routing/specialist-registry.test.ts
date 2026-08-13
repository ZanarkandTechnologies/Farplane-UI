import { describe, expect, it } from "vitest";
import { DEPARTMENT_ISLAND_IDS } from "@/modules/office/lib/department-island-layout";
import { OPERATING_ROOM_IDS } from "@/modules/office/lib/operating-room-catalog";
import { resolveTicketSpecialist, TICKET_SPECIALIST_REGISTRY } from "./specialist-registry";

describe("ticket specialist registry", () => {
  it("maps every declared specialist to either a current room or an explicit department bay", () => {
    const rooms = new Set(OPERATING_ROOM_IDS);
    const departments = new Set(DEPARTMENT_ISLAND_IDS);
    expect(
      TICKET_SPECIALIST_REGISTRY.every(
        (specialist) =>
          departments.has(specialist.departmentId) &&
          (!("roomId" in specialist) || rooms.has(specialist.roomId)),
      ),
    ).toBe(true);
    expect(resolveTicketSpecialist("lead-scout-specialist")?.departmentId).toBe("sales");
    expect(resolveTicketSpecialist("lead-scout-specialist")?.roomId).toBeUndefined();
    expect(resolveTicketSpecialist("personalized-offer-specialist")?.departmentId).toBe("deals");
    expect(resolveTicketSpecialist("personalized-offer-specialist")?.roomId).toBeUndefined();
  });

  it("resolves known specialists and leaves unknown routing unplaced", () => {
    expect(resolveTicketSpecialist("landing-page-specialist")).toMatchObject({
      departmentId: "marketing",
      roomId: "production",
      displayName: "Landing Page Specialist",
    });
    expect(resolveTicketSpecialist("unknown-specialist")).toBeUndefined();
    expect(resolveTicketSpecialist(" ")).toBeUndefined();
  });
});
