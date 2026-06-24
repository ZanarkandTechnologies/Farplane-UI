import { describe, expect, it } from "vitest";

import type { OfficeAreaLayout } from "./office-area-layout";
import { createRectangularOfficeLayout } from "./office-layout";
import { buildOfficeSectionWallObjects } from "./office-section-walls";
import type { ProjectModel } from "@/modules/runtime";

function project(id: string, name: string): ProjectModel {
  return {
    id,
    departmentId: "dept-codex-projects",
    name,
    githubUrl: "",
    status: "active",
    goal: "",
    kpis: [],
    accountEvents: [],
    ledger: [],
    experiments: [],
    metricEvents: [],
    resources: [],
    resourceEvents: [],
  };
}

const projects = [project("proj-left", "Left"), project("proj-right", "Right")];

const officeAreaLayout: OfficeAreaLayout = {
  areas: [
    {
      id: "office/left",
      label: "Left",
      depth: 1,
      parentId: "office",
      projectId: "proj-left",
      weight: 1,
      color: "#38bdf8",
      rect: {
        minX: 0,
        maxX: 8,
        minZ: 0,
        maxZ: 8,
        centerX: 4,
        centerZ: 4,
        width: 8,
        depth: 8,
      },
    },
    {
      id: "office/right",
      label: "Right",
      depth: 1,
      parentId: "office",
      projectId: "proj-right",
      weight: 1,
      color: "#34d399",
      rect: {
        minX: 8,
        maxX: 16,
        minZ: 0,
        maxZ: 8,
        centerX: 12,
        centerZ: 4,
        width: 8,
        depth: 8,
      },
    },
  ],
  projectAreaByProjectId: {},
};
officeAreaLayout.projectAreaByProjectId["proj-left"] =
  officeAreaLayout.areas[0]!;
officeAreaLayout.projectAreaByProjectId["proj-right"] =
  officeAreaLayout.areas[1]!;

describe("office section wall strategies", () => {
  it("keeps sibling project faces open in the legacy strategy", () => {
    const walls = buildOfficeSectionWallObjects({
      companyId: "company-test",
      projects,
      clusterObjects: [],
      officeAreaLayout,
      officeLayout: createRectangularOfficeLayout({ width: 20, depth: 12 }),
      layoutStrategy: "legacy",
      wallColor: "#ffffff",
    });

    expect(walls).toHaveLength(0);
  });

  it("draws shared project faces with a door gap in the activity treemap strategy", () => {
    const walls = buildOfficeSectionWallObjects({
      companyId: "company-test",
      projects,
      clusterObjects: [],
      officeAreaLayout,
      officeLayout: createRectangularOfficeLayout({ width: 20, depth: 12 }),
      layoutStrategy: "activity_treemap",
      wallColor: "#ffffff",
    });

    expect(walls).toHaveLength(2);
    expect(
      walls.every((wall) => wall.metadata?.sectionType === "project-room"),
    ).toBe(true);
    expect(walls.every((wall) => wall.position[0] === 8)).toBe(true);
    expect(
      walls.every((wall) => typeof wall.metadata?.footprintWidth === "number"),
    ).toBe(true);
  });

  it("leaves minimum lane gaps open for circulation", () => {
    const laneAreaLayout: OfficeAreaLayout = {
      areas: [
        {
          ...officeAreaLayout.areas[0]!,
          rect: {
            ...officeAreaLayout.areas[0]!.rect,
            maxX: 8,
            width: 8,
            centerX: 4,
          },
        },
        {
          ...officeAreaLayout.areas[1]!,
          rect: {
            ...officeAreaLayout.areas[1]!.rect,
            minX: 9,
            maxX: 17,
            centerX: 13,
            width: 8,
          },
        },
      ],
      projectAreaByProjectId: {},
    };
    laneAreaLayout.projectAreaByProjectId["proj-left"] =
      laneAreaLayout.areas[0]!;
    laneAreaLayout.projectAreaByProjectId["proj-right"] =
      laneAreaLayout.areas[1]!;

    const walls = buildOfficeSectionWallObjects({
      companyId: "company-test",
      projects,
      clusterObjects: [],
      officeAreaLayout: laneAreaLayout,
      officeLayout: createRectangularOfficeLayout({ width: 20, depth: 12 }),
      layoutStrategy: "activity_treemap",
      wallColor: "#ffffff",
    });

    expect(walls).toHaveLength(0);
  });
});
