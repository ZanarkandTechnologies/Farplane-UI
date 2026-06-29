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

function renderOfficeAreaAscii(layout: ReturnType<typeof buildOfficeAreaLayout>): string {
  const areas = layout.areas.filter((area) => area.depth > 0);
  if (areas.length === 0) return "";
  const minX = Math.min(...areas.map((area) => area.rect.minX));
  const maxX = Math.max(...areas.map((area) => area.rect.maxX));
  const minZ = Math.min(...areas.map((area) => area.rect.minZ));
  const maxZ = Math.max(...areas.map((area) => area.rect.maxZ));
  const width = 72;
  const depth = 28;
  const grid = Array.from({ length: depth }, () => Array(width).fill(" "));
  const toGridX = (value: number) =>
    Math.max(
      0,
      Math.min(width - 1, Math.round(((value - minX) / (maxX - minX || 1)) * (width - 1))),
    );
  const toGridZ = (value: number) =>
    Math.max(
      0,
      Math.min(depth - 1, Math.round(((value - minZ) / (maxZ - minZ || 1)) * (depth - 1))),
    );

  for (const area of areas) {
    const left = toGridX(area.rect.minX);
    const right = toGridX(area.rect.maxX);
    const top = toGridZ(area.rect.minZ);
    const bottom = toGridZ(area.rect.maxZ);
    const mark = area.kind === "district" ? "#" : area.kind === "project-tables" ? "=" : "-";
    for (let x = left; x <= right; x += 1) {
      grid[top]![x] = mark;
      grid[bottom]![x] = mark;
    }
    for (let z = top; z <= bottom; z += 1) {
      grid[z]![left] = mark;
      grid[z]![right] = mark;
    }
    const label = area.label.slice(0, Math.max(3, Math.min(18, right - left - 1)));
    const labelX = Math.min(right - label.length, left + 1);
    const labelZ = Math.max(top, Math.min(bottom, Math.round((top + bottom) / 2)));
    if (labelX > left && labelZ >= 0 && labelZ < depth) {
      for (let index = 0; index < label.length; index += 1) {
        grid[labelZ]![labelX + index] = label[index]!;
      }
    }
  }

  return grid.map((row) => row.join("").trimEnd()).join("\n");
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

  it("reserves self table areas for parent projects in hierarchical treemap mode", () => {
    const layout = buildOfficeAreaLayout({
      company: company({
        agents: [
          {
            agentId: "codex-thread:zanarkand",
            role: "ceo",
            projectId: "proj-zanarkand",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:farplane-a",
            role: "builder",
            projectId: "proj-farplane",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:farplane-b",
            role: "builder",
            projectId: "proj-farplane",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:ui",
            role: "builder",
            projectId: "proj-farplane-ui",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:life",
            role: "pm",
            projectId: "proj-life",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
        ],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 48, depth: 32 }),
      layoutStrategy: "hierarchical_treemap",
      workload: [
        {
          projectId: "proj-life",
          openTickets: 12,
          closedTickets: 0,
          queuePressure: "high",
        },
      ],
      activity: [{ projectId: "proj-life", recentActivityScore: 99 }],
    });

    const labels = layout.areas.map((area) => area.label);
    const zanarkandArea = layout.areas.find(
      (area) => area.label === "Zanarkand Technologies",
    );
    const zanarkandTables = layout.projectAreaByProjectId["proj-zanarkand"];
    const farplaneArea = layout.areas.find((area) => area.label === "Farplane");
    const farplaneTables = layout.projectAreaByProjectId["proj-farplane"];
    const farplaneUiArea = layout.projectAreaByProjectId["proj-farplane-ui"];
    const lifeArea = layout.projectAreaByProjectId["proj-life"];

    expect(labels).toEqual(
      expect.arrayContaining([
        "Zanarkand Technologies",
        "Zanarkand Technologies Tables",
        "Farplane",
        "Farplane Tables",
        "Farplane UI",
      ]),
    );
    expect(labels).not.toContain("Shared Plaza");
    expect(zanarkandArea?.projectId).toBeUndefined();
    expect(zanarkandArea?.kind).toBe("district");
    expect(zanarkandArea?.weight).toBeGreaterThan(lifeArea.weight);
    expect(zanarkandTables.label).toBe("Zanarkand Technologies Tables");
    expect(zanarkandTables.kind).toBe("project-tables");
    expect(zanarkandTables.parentId).toBe(zanarkandArea?.id);
    expect(farplaneArea?.projectId).toBeUndefined();
    expect(farplaneArea?.kind).toBe("district");
    expect(farplaneTables.label).toBe("Farplane Tables");
    expect(farplaneTables.kind).toBe("project-tables");
    expect(farplaneTables.parentId).toBe(farplaneArea?.id);
    expect(farplaneUiArea.label).toBe("Farplane UI");
    expect(farplaneUiArea.kind).toBe("project");
    expect(lifeArea.kind).toBe("project");
    expect(lifeArea.weight).toBe(farplaneUiArea.weight);
    expect(farplaneTables.rect.minX).toBeGreaterThanOrEqual(
      farplaneArea?.rect.minX ?? Number.NEGATIVE_INFINITY,
    );
    expect(farplaneTables.rect.maxX).toBeLessThanOrEqual(
      farplaneArea?.rect.maxX ?? Number.POSITIVE_INFINITY,
    );
  });

  it("places root peer projects on cardinal sides around the heaviest district first", () => {
    const siblingProject = (id: string, name: string, path: string) => ({
      id,
      departmentId: "dept-codex-projects",
      name,
      githubUrl: "",
      status: "active" as const,
      goal: "",
      kpis: [],
      trackingContext: path,
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    });
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: [
          ...company().projects,
          siblingProject("proj-absorcerer", "Absorcerer", "/Users/k/Absorcerer"),
          siblingProject("proj-reels", "Reels", "/Users/k/Reels"),
        ],
        agents: [
          {
            agentId: "codex-thread:zanarkand",
            role: "ceo",
            projectId: "proj-zanarkand",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:farplane",
            role: "builder",
            projectId: "proj-farplane",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:farplane-ui-a",
            role: "builder",
            projectId: "proj-farplane-ui",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:farplane-ui-b",
            role: "builder",
            projectId: "proj-farplane-ui",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:farplane-ui-c",
            role: "builder",
            projectId: "proj-farplane-ui",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:life",
            role: "pm",
            projectId: "proj-life",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:absorcerer",
            role: "builder",
            projectId: "proj-absorcerer",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:reels",
            role: "builder",
            projectId: "proj-reels",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          {
            agentId: "codex-thread:ai-brain",
            role: "builder",
            projectId: "proj-ai-brain",
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
        ],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 54, depth: 36 }),
      layoutStrategy: "hierarchical_treemap",
    });
    const center = layout.areas.find(
      (area) => area.label === "Zanarkand Technologies",
    );
    const peers = [
      layout.projectAreaByProjectId["proj-life"],
      layout.projectAreaByProjectId["proj-ai-brain"],
      layout.projectAreaByProjectId["proj-absorcerer"],
      layout.projectAreaByProjectId["proj-reels"],
    ];

    expect(center).toBeDefined();
    expect(peers.some((area) => area.rect.maxZ <= center!.rect.minZ)).toBe(
      true,
    );
    expect(peers.some((area) => area.rect.minX >= center!.rect.maxX)).toBe(
      true,
    );
    expect(peers.some((area) => area.rect.minZ >= center!.rect.maxZ)).toBe(
      true,
    );
    expect(peers.some((area) => area.rect.maxX <= center!.rect.minX)).toBe(
      true,
    );
  });

  it("compacts nested small project siblings into side shelves", () => {
    const project = (id: string, name: string, path: string) => ({
      id,
      departmentId: "dept-codex-projects",
      name,
      githubUrl: "",
      status: "active" as const,
      goal: "",
      kpis: [],
      trackingContext: path,
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    });
    const agent = (agentId: string, projectId: string) => ({
      agentId,
      role: "builder" as const,
      projectId,
      heartbeatProfileId: "hb-thread",
      lifecycleState: "active" as const,
    });
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: [
          project(
            "proj-zanarkand",
            "Zanarkand Technologies",
            "/Users/kenjipcx/Zanarkand Technologies",
          ),
          project(
            "proj-farplane",
            "Farplane",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane",
          ),
          project(
            "proj-farplane-ui",
            "Farplane UI",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI",
          ),
          project(
            "proj-skills",
            "skills",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills",
          ),
          project(
            "proj-valefor",
            "Valefor",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Valefor",
          ),
        ],
        agents: [
          agent("codex-thread:zanarkand", "proj-zanarkand"),
          agent("codex-thread:farplane", "proj-farplane"),
          agent("codex-thread:farplane-ui-a", "proj-farplane-ui"),
          agent("codex-thread:farplane-ui-b", "proj-farplane-ui"),
          agent("codex-thread:farplane-ui-c", "proj-farplane-ui"),
          agent("codex-thread:skills", "proj-skills"),
          agent("codex-thread:valefor", "proj-valefor"),
        ],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 54, depth: 36 }),
      layoutStrategy: "hierarchical_treemap",
    });
    const farplane = layout.areas.find((area) => area.label === "Farplane");
    const zanarkandTables =
      layout.projectAreaByProjectId["proj-zanarkand"];
    const valefor = layout.projectAreaByProjectId["proj-valefor"];

    expect(farplane).toBeDefined();
    expect(zanarkandTables.rect.minX).toBeGreaterThanOrEqual(
      farplane!.rect.maxX,
    );
    expect(valefor.rect.minX).toBeGreaterThanOrEqual(farplane!.rect.maxX);
    expect(zanarkandTables.rect.minZ).toBeGreaterThanOrEqual(
      farplane!.rect.minZ,
    );
    expect(valefor.rect.maxZ).toBeLessThanOrEqual(farplane!.rect.maxZ);
  });

  it("grows project areas from the table footprint needed by larger teams", () => {
    const smallProject = {
      id: "proj-small-table",
      departmentId: "dept-codex-projects",
      name: "Small Table",
      githubUrl: "",
      status: "active" as const,
      goal: "",
      kpis: [],
      trackingContext: "/workspace/small-table",
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const largeProject = {
      id: "proj-large-table",
      departmentId: "dept-codex-projects",
      name: "Large Table",
      githubUrl: "",
      status: "active" as const,
      goal: "",
      kpis: [],
      trackingContext: "/workspace/large-table",
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: [smallProject, largeProject],
        agents: [
          {
            agentId: "small-table-worker",
            role: "builder",
            projectId: smallProject.id,
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active",
          },
          ...Array.from({ length: 8 }, (_, index) => ({
            agentId: `large-table-worker-${index}`,
            role: "builder" as const,
            projectId: largeProject.id,
            heartbeatProfileId: "hb-thread",
            lifecycleState: "active" as const,
          })),
        ],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 60, depth: 40 }),
      layoutStrategy: "hierarchical_treemap",
    });
    const smallArea = layout.projectAreaByProjectId[smallProject.id];
    const largeArea = layout.projectAreaByProjectId[largeProject.id];

    expect(largeArea.rect.width * largeArea.rect.depth).toBeGreaterThan(
      smallArea.rect.width * smallArea.rect.depth,
    );
    expect(largeArea.rect.width).toBeGreaterThanOrEqual(smallArea.rect.width);
    expect(largeArea.rect.depth).toBeGreaterThanOrEqual(smallArea.rect.depth);
  });

  it("seeds the largest area-sorted child at the bottom-left of its parent hull", () => {
    const project = (id: string, name: string, path: string) => ({
      id,
      departmentId: "dept-codex-projects",
      name,
      githubUrl: "",
      status: "active" as const,
      goal: "",
      kpis: [],
      trackingContext: path,
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    });
    const agent = (agentId: string, projectId: string) => ({
      agentId,
      role: "builder" as const,
      projectId,
      heartbeatProfileId: "hb-thread",
      lifecycleState: "active" as const,
    });
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: [
          project(
            "proj-zanarkand",
            "Zanarkand Technologies",
            "/Users/kenjipcx/Zanarkand Technologies",
          ),
          project(
            "proj-farplane",
            "Farplane",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane",
          ),
          project(
            "proj-farplane-ui",
            "Farplane UI",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI",
          ),
          project(
            "proj-skills",
            "skills",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane/skills",
          ),
          project(
            "proj-valefor",
            "Valefor",
            "/Users/kenjipcx/Zanarkand Technologies/projects/Valefor",
          ),
          project("proj-life", "Life", "/Users/kenjipcx/life"),
          project("proj-reels", "Reels", "/Users/kenjipcx/reels"),
          project("proj-ai-brain", "ai-brain", "/Users/kenjipcx/ai-brain"),
          project("proj-absorcerer", "Absorcerer", "/Users/kenjipcx/absorcerer"),
        ],
        agents: [
          agent("codex-thread:zanarkand", "proj-zanarkand"),
          agent("codex-thread:farplane-a", "proj-farplane"),
          agent("codex-thread:farplane-b", "proj-farplane"),
          agent("codex-thread:farplane-c", "proj-farplane"),
          agent("codex-thread:farplane-ui-a", "proj-farplane-ui"),
          agent("codex-thread:farplane-ui-b", "proj-farplane-ui"),
          agent("codex-thread:skills", "proj-skills"),
          agent("codex-thread:valefor", "proj-valefor"),
          agent("codex-thread:life", "proj-life"),
          agent("codex-thread:reels", "proj-reels"),
          agent("codex-thread:ai-brain", "proj-ai-brain"),
          agent("codex-thread:absorcerer", "proj-absorcerer"),
        ],
      }),
      officeLayout: createRectangularOfficeLayout({ width: 72, depth: 48 }),
      layoutStrategy: "area_sorted_pack",
    });
    const ascii = renderOfficeAreaAscii(layout);
    const zanarkand = layout.areas.find(
      (area) => area.label === "Zanarkand Technologies",
    );
    const farplane = layout.areas.find((area) => area.label === "Farplane");
    const zanarkandChildren = layout.areas.filter(
      (area) => area.parentId === zanarkand?.id,
    );
    const childMinX = Math.min(...zanarkandChildren.map((area) => area.rect.minX));
    const childMaxZ = Math.max(...zanarkandChildren.map((area) => area.rect.maxZ));

    expect(ascii).toContain("Farplane");
    expect(ascii).toContain("Zanark");
    expect(farplane).toBeDefined();
    expect(farplane?.rect.minX).toBeCloseTo(childMinX, 5);
    expect(farplane?.rect.maxZ).toBeCloseTo(childMaxZ, 5);
    expect(
      zanarkandChildren.every((area) => {
        if (area.id === farplane?.id) return true;
        return (
          area.rect.minZ < farplane!.rect.minZ ||
          area.rect.minX > farplane!.rect.minX
        );
      }),
    ).toBe(true);
  });

  it("packs equal area-sorted siblings into a square-ish shape instead of one line", () => {
    const layout = buildOfficeAreaLayout({
      company: company({
        projects: Array.from({ length: 4 }, (_, index) => ({
          id: `proj-pack-${index}`,
          departmentId: "dept-codex-projects",
          name: `Pack ${index}`,
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
      officeLayout: createRectangularOfficeLayout({ width: 48, depth: 36 }),
      layoutStrategy: "area_sorted_pack",
    });
    const projectAreas = Object.values(layout.projectAreaByProjectId);
    const centerXs = new Set(projectAreas.map((area) => Math.round(area.rect.centerX)));
    const centerZs = new Set(projectAreas.map((area) => Math.round(area.rect.centerZ)));
    const bounds = {
      minX: Math.min(...projectAreas.map((area) => area.rect.minX)),
      maxX: Math.max(...projectAreas.map((area) => area.rect.maxX)),
      minZ: Math.min(...projectAreas.map((area) => area.rect.minZ)),
      maxZ: Math.max(...projectAreas.map((area) => area.rect.maxZ)),
    };
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;

    expect(centerXs.size).toBeGreaterThan(1);
    expect(centerZs.size).toBeGreaterThan(1);
    expect(Math.max(width, depth) / Math.max(1, Math.min(width, depth))).toBeLessThan(2);
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

  it("treats older project-area strategies as aliases of the centered project layout", () => {
    for (const layoutStrategy of [
      "team_neighborhoods",
      "activity_treemap",
      "command_districts",
    ] as const) {
      const layout = buildOfficeAreaLayout({
        company: company(),
        officeLayout: createRectangularOfficeLayout({ width: 40, depth: 28 }),
        layoutStrategy,
      });
      const labels = layout.areas.map((area) => area.label);
      const sharedPlaza = layout.areas.find(
        (area) => area.id === "office/shared-plaza",
      );

      expect(sharedPlaza).toBeUndefined();
      expect(labels).toContain("Zanarkand Technologies Tables");
      expect(layout.projectAreaByProjectId["proj-zanarkand"].kind).toBe(
        "project-tables",
      );
      expect(layout.projectAreaByProjectId["proj-farplane-ui"].parentId).toContain(
        "farplane",
      );
    }
  });
});
