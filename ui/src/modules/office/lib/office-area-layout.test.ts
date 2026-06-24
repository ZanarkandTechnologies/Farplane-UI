import { describe, expect, it } from "vitest";

import type { CompanyModel } from "@/modules/runtime";
import { createRectangularOfficeLayout } from "./office-layout";
import {
  buildOfficeAreaLayout,
  getOfficeAreaAnchor,
  OFFICE_AREA_MIN_LANE_SIZE,
} from "./office-area-layout";

function company(overrides: Partial<CompanyModel> = {}): CompanyModel {
  return {
    version: 1,
    departments: [
      {
        id: "dept-codex-projects",
        name: "Codex Projects",
        description: "",
        goal: "",
      },
    ],
    projects: [
      {
        id: "proj-zanarkand",
        departmentId: "dept-codex-projects",
        name: "Zanarkand Technologies",
        githubUrl: "",
        status: "active",
        goal: "",
        kpis: [],
        trackingContext: "/Users/kenjipcx/Zanarkand Technologies",
        accountEvents: [],
        ledger: [],
        experiments: [],
        metricEvents: [],
        resources: [],
        resourceEvents: [],
      },
      {
        id: "proj-farplane",
        departmentId: "dept-codex-projects",
        name: "Farplane",
        githubUrl: "",
        status: "active",
        goal: "",
        kpis: [],
        trackingContext:
          "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane",
        accountEvents: [],
        ledger: [],
        experiments: [],
        metricEvents: [],
        resources: [],
        resourceEvents: [],
      },
      {
        id: "proj-farplane-ui",
        departmentId: "dept-codex-projects",
        name: "Farplane UI",
        githubUrl: "",
        status: "active",
        goal: "",
        kpis: [],
        trackingContext:
          "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI",
        accountEvents: [],
        ledger: [],
        experiments: [],
        metricEvents: [],
        resources: [],
        resourceEvents: [],
      },
      {
        id: "proj-life",
        departmentId: "dept-codex-projects",
        name: "Life",
        githubUrl: "",
        status: "active",
        goal: "",
        kpis: [],
        trackingContext: "/Users/kenjipcx/life",
        accountEvents: [],
        ledger: [],
        experiments: [],
        metricEvents: [],
        resources: [],
        resourceEvents: [],
      },
      {
        id: "proj-ai-brain",
        departmentId: "dept-codex-projects",
        name: "ai-brain",
        githubUrl: "",
        status: "active",
        goal: "",
        kpis: [],
        trackingContext: "/Users/kenjipcx/60x/ai-brain",
        accountEvents: [],
        ledger: [],
        experiments: [],
        metricEvents: [],
        resources: [],
        resourceEvents: [],
      },
    ],
    agents: [
      {
        agentId: "codex-thread:a",
        role: "builder",
        projectId: "proj-farplane-ui",
        heartbeatProfileId: "hb-thread",
        lifecycleState: "active",
      },
    ],
    roleSlots: [],
    tasks: [],
    federationPolicies: [],
    providerIndexProfiles: [],
    heartbeatProfiles: [],
    channelBindings: [],
    heartbeatRuntime: {
      enabled: false,
      pluginId: "",
      serviceId: "",
      cadenceMinutes: 0,
    },
    officeObjects: [],
    ...overrides,
  };
}

describe("office area layout", () => {
  it("derives nested Zanarkand project hierarchy from project paths", () => {
    const layout = buildOfficeAreaLayout({
      company: company(),
      officeLayout: createRectangularOfficeLayout({ width: 32, depth: 24 }),
    });

    const labels = layout.areas.map((area) => area.label);
    expect(labels).toContain("Zanarkand Technologies");
    expect(labels).toContain("Farplane");
    expect(labels).toContain("Farplane UI");
    expect(layout.projectAreaByProjectId["proj-farplane-ui"]?.label).toBe(
      "Farplane UI",
    );
    expect(
      layout.projectAreaByProjectId["proj-farplane-ui"]?.parentId,
    ).toContain("farplane");
  });

  it("keeps unrelated local Codex projects as root siblings instead of home-folder areas", () => {
    const layout = buildOfficeAreaLayout({
      company: company(),
      officeLayout: createRectangularOfficeLayout({ width: 32, depth: 24 }),
    });

    const labels = layout.areas.map((area) => area.label);
    expect(labels).toContain("Life");
    expect(labels).toContain("Ai Brain");
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Kenjipcx");
    expect(layout.projectAreaByProjectId["proj-life"]?.parentId).toBe("office");
    expect(layout.projectAreaByProjectId["proj-ai-brain"]?.parentId).toBe(
      "office",
    );
  });

  it("allocates deterministic bounded rectangles and anchors", () => {
    const layout = buildOfficeAreaLayout({
      company: company(),
      officeLayout: createRectangularOfficeLayout({ width: 32, depth: 24 }),
      workload: [
        {
          projectId: "proj-farplane-ui",
          openTickets: 4,
          closedTickets: 0,
          queuePressure: "high",
        },
      ],
    });
    const uiArea = layout.projectAreaByProjectId["proj-farplane-ui"];
    const farplaneArea = layout.projectAreaByProjectId["proj-farplane"];

    expect(uiArea.rect.width).toBeGreaterThan(0);
    expect(uiArea.rect.depth).toBeGreaterThan(0);
    expect(uiArea.rect.minX).toBeGreaterThanOrEqual(-16);
    expect(uiArea.rect.maxX).toBeLessThanOrEqual(16);
    expect(getOfficeAreaAnchor(uiArea)[1]).toBe(0);
    expect(uiArea.rect.minX).toBeGreaterThanOrEqual(farplaneArea.rect.minX);
    expect(uiArea.rect.maxX).toBeLessThanOrEqual(farplaneArea.rect.maxX);
    expect(uiArea.rect.minZ).toBeGreaterThanOrEqual(farplaneArea.rect.minZ);
    expect(uiArea.rect.maxZ).toBeLessThanOrEqual(farplaneArea.rect.maxZ);
  });

  it("balances equal sibling projects into readable blocks instead of strips", () => {
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: Array.from({ length: 8 }, (_, index) => ({
          id: `proj-block-${index}`,
          departmentId: "dept-codex-projects",
          name: `Block ${index}`,
          githubUrl: "",
          status: "active" as const,
          goal: "",
          kpis: [],
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: [],
          resourceEvents: [],
        })),
        agents: [],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 40, depth: 24 }),
    });
    const projectAreas = Object.values(layout.projectAreaByProjectId);

    expect(projectAreas).toHaveLength(8);
    expect(
      Math.min(...projectAreas.map((area) => area.rect.width)),
    ).toBeGreaterThan(5);
    expect(
      Math.min(...projectAreas.map((area) => area.rect.depth)),
    ).toBeGreaterThan(4);
  });

  it("reserves a minimum lane between sibling project blocks", () => {
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: Array.from({ length: 4 }, (_, index) => ({
          id: `proj-lane-${index}`,
          departmentId: "dept-codex-projects",
          name: `Lane ${index}`,
          githubUrl: "",
          status: "active" as const,
          goal: "",
          kpis: [],
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: [],
          resourceEvents: [],
        })),
        agents: [],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 32, depth: 20 }),
    });
    const projectAreas = Object.values(layout.projectAreaByProjectId);
    const gaps: number[] = [];
    for (let leftIndex = 0; leftIndex < projectAreas.length; leftIndex += 1) {
      const left = projectAreas[leftIndex];
      if (!left) continue;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < projectAreas.length;
        rightIndex += 1
      ) {
        const right = projectAreas[rightIndex];
        if (!right) continue;
        const zOverlap =
          Math.min(left.rect.maxZ, right.rect.maxZ) -
          Math.max(left.rect.minZ, right.rect.minZ);
        if (zOverlap > 0) {
          if (left.rect.maxX <= right.rect.minX) {
            gaps.push(right.rect.minX - left.rect.maxX);
          } else if (right.rect.maxX <= left.rect.minX) {
            gaps.push(left.rect.minX - right.rect.maxX);
          }
        }
        const xOverlap =
          Math.min(left.rect.maxX, right.rect.maxX) -
          Math.max(left.rect.minX, right.rect.minX);
        if (xOverlap > 0) {
          if (left.rect.maxZ <= right.rect.minZ) {
            gaps.push(right.rect.minZ - left.rect.maxZ);
          } else if (right.rect.maxZ <= left.rect.minZ) {
            gaps.push(left.rect.minZ - right.rect.maxZ);
          }
        }
      }
    }

    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(OFFICE_AREA_MIN_LANE_SIZE);
  });

  it("allocates more area to recently active projects", () => {
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: [
          {
            id: "proj-hot",
            departmentId: "dept-codex-projects",
            name: "Hot Project",
            githubUrl: "",
            status: "active" as const,
            goal: "",
            kpis: [],
            accountEvents: [],
            ledger: [],
            experiments: [],
            metricEvents: [],
            resources: [],
            resourceEvents: [],
          },
          {
            id: "proj-cold",
            departmentId: "dept-codex-projects",
            name: "Cold Project",
            githubUrl: "",
            status: "active" as const,
            goal: "",
            kpis: [],
            accountEvents: [],
            ledger: [],
            experiments: [],
            metricEvents: [],
            resources: [],
            resourceEvents: [],
          },
        ],
        agents: [],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 32, depth: 20 }),
      activity: [{ projectId: "proj-hot", recentActivityScore: 6 }],
    });
    const hotArea = layout.projectAreaByProjectId["proj-hot"];
    const coldArea = layout.projectAreaByProjectId["proj-cold"];

    expect(hotArea.rect.width * hotArea.rect.depth).toBeGreaterThan(
      coldArea.rect.width * coldArea.rect.depth,
    );
  });

  it("falls back to department/project hierarchy when no tracking path exists", () => {
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: [
          {
            id: "proj-alpha",
            departmentId: "dept-codex-projects",
            name: "Alpha Tool",
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
          },
        ],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 20, depth: 20 }),
    });

    expect(layout.areas.map((area) => area.label)).toEqual(
      expect.arrayContaining(["Codex Projects", "Alpha Tool"]),
    );
    expect(layout.projectAreaByProjectId["proj-alpha"].label).toBe(
      "Alpha Tool",
    );
  });

  it("places the parent project near the center in command districts", () => {
    const layout = buildOfficeAreaLayout({
      company: company(),
      officeLayout: createRectangularOfficeLayout({ width: 40, depth: 28 }),
      layoutStrategy: "command_districts",
    });
    const rootArea = layout.projectAreaByProjectId["proj-zanarkand"];
    const childArea = layout.projectAreaByProjectId["proj-farplane"];
    const leafArea = layout.projectAreaByProjectId["proj-farplane-ui"];
    const rootAnchor = getOfficeAreaAnchor(rootArea);
    const childAnchor = getOfficeAreaAnchor(childArea);

    expect(Math.abs(rootAnchor[0])).toBeLessThanOrEqual(2);
    expect(Math.abs(rootAnchor[2])).toBeLessThanOrEqual(2);
    expect(Math.abs(childAnchor[0]) + Math.abs(childAnchor[2])).toBeGreaterThan(
      Math.abs(rootAnchor[0]) + Math.abs(rootAnchor[2]),
    );
    expect(leafArea.parentId).toContain("farplane");
  });
});
