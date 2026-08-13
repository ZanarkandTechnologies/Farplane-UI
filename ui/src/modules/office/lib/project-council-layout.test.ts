import { describe, expect, it } from "vitest";
import { TICKET_SPECIALIST_REGISTRY } from "@/lib/ticket-routing/specialist-registry";
import { getDepartmentIslandGeometry, getDepartmentIslandId } from "./department-island-layout";
import { buildProjectCouncilLayout } from "./project-council-layout";

describe("project council layout", () => {
  it("sorts visible project ids so reordered input keeps every sector stable", () => {
    const projects = ["project-zeta", "project-alpha", "project-omega"];

    const layout = buildProjectCouncilLayout(projects, TICKET_SPECIALIST_REGISTRY);
    const reorderedLayout = buildProjectCouncilLayout(
      [...projects].reverse(),
      TICKET_SPECIALIST_REGISTRY,
    );

    expect(layout.sectors).toEqual(reorderedLayout.sectors);
    expect(layout.sectors.map((sector) => sector.projectId)).toEqual([
      "project-alpha",
      "project-omega",
      "project-zeta",
    ]);
  });

  it("covers the circle with equal, contiguous project sectors", () => {
    const layout = buildProjectCouncilLayout(
      ["project-alpha", "project-beta", "project-gamma", "project-delta"],
      TICKET_SPECIALIST_REGISTRY,
    );
    const sectorWidths = layout.sectors.map((sector) => sector.endAngle - sector.startAngle);

    expect(sectorWidths).toEqual(Array.from({ length: 4 }, () => Math.PI / 2));
    expect(layout.sectors.at(-1)?.endAngle - layout.sectors[0]?.startAngle).toBeCloseTo(
      Math.PI * 2,
    );
    for (const [index, sector] of layout.sectors.entries()) {
      if (index === 0) continue;
      const previousSector = layout.sectors[index - 1];
      if (!previousSector) throw new Error("Council sectors must be contiguous");
      expect(sector.startAngle).toBe(previousSector.endAngle);
    }
  });

  it("assigns one unique permanent anchor to every registered specialist", () => {
    const layout = buildProjectCouncilLayout(["project-alpha"], TICKET_SPECIALIST_REGISTRY);
    const anchors = layout.specialistStations.map((station) => station.position.join(":"));

    expect(layout.specialistStations).toHaveLength(TICKET_SPECIALIST_REGISTRY.length);
    expect(new Set(layout.specialistStations.map((station) => station.specialistId)).size).toBe(
      TICKET_SPECIALIST_REGISTRY.length,
    );
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("keeps every specialist anchor inside its mapped studio district", () => {
    const districtsById = new Map(
      getDepartmentIslandGeometry().map((district) => [district.id, district.bounds]),
    );
    const layout = buildProjectCouncilLayout(["project-alpha"], TICKET_SPECIALIST_REGISTRY);

    for (const station of layout.specialistStations) {
      const district = districtsById.get(station.departmentId);
      if (station.roomId) {
        expect(station.departmentId).toBe(getDepartmentIslandId(station.roomId));
      }
      expect(district).toBeDefined();
      if (!district) throw new Error(`Missing district bounds for ${station.departmentId}`);
      expect(station.position[0]).toBeGreaterThanOrEqual(district.minX);
      expect(station.position[0]).toBeLessThanOrEqual(district.maxX);
      expect(station.position[2]).toBeGreaterThanOrEqual(district.minZ);
      expect(station.position[2]).toBeLessThanOrEqual(district.maxZ);
    }
  });

  it("anchors Sales and Deals services directly inside their department bays", () => {
    const layout = buildProjectCouncilLayout(["project-alpha"], TICKET_SPECIALIST_REGISTRY);
    const byId = new Map(
      layout.specialistStations.map((station) => [station.specialistId, station]),
    );

    expect(byId.get("lead-scout-specialist")).toMatchObject({
      departmentId: "sales",
      roomId: undefined,
    });
    expect(byId.get("personalized-offer-specialist")).toMatchObject({
      departmentId: "deals",
      roomId: undefined,
    });
  });
});
