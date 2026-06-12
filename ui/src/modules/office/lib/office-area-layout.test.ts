import { describe, expect, it } from "vitest";

import type { CompanyModel } from "@/modules/runtime";
import { createRectangularOfficeLayout } from "./office-layout";
import { buildOfficeAreaLayout, getOfficeAreaAnchor } from "./office-area-layout";

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
        trackingContext: "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane",
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
        trackingContext: "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI",
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
    expect(layout.projectAreaByProjectId["proj-farplane-ui"]?.label).toBe("Farplane UI");
    expect(layout.projectAreaByProjectId["proj-farplane-ui"]?.parentId).toContain("farplane");
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
    expect(layout.projectAreaByProjectId["proj-ai-brain"]?.parentId).toBe("office");
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
    expect(layout.projectAreaByProjectId["proj-alpha"].label).toBe("Alpha Tool");
  });
});
