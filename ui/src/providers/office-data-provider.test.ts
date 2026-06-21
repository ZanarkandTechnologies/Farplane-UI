import { describe, expect, it } from "vitest";

import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";
import { getOfficeLayoutBounds } from "@/modules/office/lib/office-layout";
import { deriveOfficeSpaceStats } from "@/modules/office/lib/office-space-stats";
import {
  canReserveOfficeObject,
  createOfficePlacementReservation,
} from "@/modules/office/systems/placement-engine";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyModel,
  OfficeSettingsModel,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import { repairTeamClusterPlacements, toOfficeData } from "./office-data-mapper";
import { mergeAgentLiveStatuses } from "./office-data-provider";
import {
  buildEmployeeSignature,
  buildOfficeObjectSignature,
  stabilizeOfficeData,
} from "./office-data-stability";

function createOfficeSettings(): OfficeSettingsModel {
  return {
    meshAssetDir: "",
    officeFootprint: { width: 30, depth: 24 },
    officeLayout: {
      version: 1,
      tileSize: 1,
      tiles: ["0,0"],
    },
    decor: {
      floorPatternId: "sandstone_tiles",
      wallColorId: "gallery_cream",
      backgroundId: "shell_haze",
    },
    viewProfile: "free_orbit_3d",
    orbitControlsEnabled: true,
    cameraOrientation: "south_east",
  };
}

function createEmployee(overrides: Partial<EmployeeData> = {}): EmployeeData {
  return {
    _id: "employee-main",
    teamId: "team-farplane",
    name: "Main Agent",
    initialPosition: [0, 0, 0],
    isBusy: false,
    team: "Farplane",
    ...overrides,
  };
}

function createOfficeObject(overrides: Partial<OfficeObject> = {}): OfficeObject {
  return {
    _id: "monitor-1",
    meshType: "custom-mesh",
    position: [1, 0, 1],
    rotation: [0, 0, 0],
    metadata: {},
    ...overrides,
  };
}

function createValue(params?: { employees?: EmployeeData[]; officeObjects?: OfficeObject[] }) {
  return {
    company: { _id: "company-demo", name: "Farplane UI" },
    teams: [],
    employees: params?.employees ?? [createEmployee()],
    officeObjects: params?.officeObjects ?? [createOfficeObject()],
    officeAreas: [],
    desks: [],
    officeSettings: createOfficeSettings(),
    companyModel: null,
    workload: [],
    warnings: [],
    refresh: async () => {},
    applyOfficeSettings: () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

function createRuntimeAgent(overrides: Partial<AgentCardModel> = {}): AgentCardModel {
  return {
    agentId: "main",
    displayName: "Main Agent",
    workspacePath: "/tmp/main",
    agentDir: "/tmp/main/agent",
    sandboxMode: "workspace-write",
    toolPolicy: { allow: [], deny: [] },
    sessionCount: 0,
    ...overrides,
  };
}

function createCompanyModel(overrides: Partial<CompanyModel> = {}): CompanyModel {
  return {
    version: 1,
    departments: [],
    projects: [],
    agents: [
      {
        agentId: "main",
        role: "ceo",
        heartbeatProfileId: "hb-ceo",
        isCeo: true,
        lifecycleState: "active",
      },
    ],
    roleSlots: [],
    tasks: [],
    federationPolicies: [],
    providerIndexProfiles: [],
    heartbeatProfiles: [
      {
        id: "hb-ceo",
        role: "ceo",
        cadenceMinutes: 15,
        teamDescription: "Executive oversight",
        productDetails: "Company control surface",
        goal: "Keep the company aligned",
      },
    ],
    channelBindings: [],
    heartbeatRuntime: {
      enabled: true,
      pluginId: "farplane-heartbeat",
      serviceId: "company-heartbeat-loop",
      cadenceMinutes: 10,
      notes: "Run heartbeat execution through OpenClaw.",
    },
    officeObjects: [],
    ...overrides,
  };
}

function createUnifiedOfficeModel(overrides: Partial<UnifiedOfficeModel> = {}): UnifiedOfficeModel {
  return {
    company: createCompanyModel(),
    runtimeAgents: [createRuntimeAgent()],
    configuredAgents: [createRuntimeAgent()],
    officeObjects: [],
    memory: [],
    skills: [],
    workload: [],
    warnings: [],
    diagnostics: {
      configAgentCount: 1,
      runtimeAgentCount: 1,
      sidecarAgentCount: 1,
      missingRuntimeAgentIds: [],
      unmappedRuntimeAgentIds: [],
      invalidOfficeObjects: [],
      duplicateOfficeObjectIds: [],
      officeObjectCount: 0,
      clampedClusterCount: 0,
      outOfBoundsClusterObjectIds: [],
      ceoAnchorMode: "fallback",
      source: "localStorage",
    },
    ...overrides,
  };
}

describe("office-data-provider stabilization", () => {
  it("lets Codex adapter status override stale Convex rows for Codex thread agents", () => {
    const merged = mergeAgentLiveStatuses({
      runtimeKind: "codex",
      agentIds: ["codex-thread:thread-running", "codex-main"],
      convexStatuses: {
        "codex-thread:thread-running": {
          agentId: "codex-thread:thread-running",
          state: "idle",
          statusText: "Stale Convex idle.",
          bubbles: [],
        },
      },
      adapterStatuses: {
        "codex-thread:thread-running": {
          agentId: "codex-thread:thread-running",
          state: "running",
          statusText: "Codex turn running.",
          bubbles: [{ id: "codex-thread-running", label: "Running", weight: 100 }],
        },
      },
    });

    expect(merged["codex-thread:thread-running"]).toEqual(
      expect.objectContaining({
        state: "running",
        statusText: "Codex turn running.",
      }),
    );
  });

  it("keeps Convex bubble overlays when Codex adapter status owns the base thread state", () => {
    const merged = mergeAgentLiveStatuses({
      runtimeKind: "codex",
      agentIds: ["codex-thread:thread-running"],
      convexStatuses: {
        "codex-thread:thread-running": {
          agentId: "codex-thread:thread-running",
          state: "running",
          statusText: "Calling openai docs",
          bubbles: [{ id: "hook-bubble", label: "Calling openai docs", weight: 100 }],
          currentSkillId: "openai-docs",
          bubbleMessages: [{ threadId: "thread-running", message: "Calling openai docs", eventAt: 3_000 }],
        },
      },
      adapterStatuses: {
        "codex-thread:thread-running": {
          agentId: "codex-thread:thread-running",
          state: "running",
          statusText: "Codex turn running.",
          bubbles: [{ id: "codex-thread-running", label: "Running", weight: 100 }],
        },
      },
    });

    expect(merged["codex-thread:thread-running"]).toEqual(
      expect.objectContaining({
        state: "running",
        statusText: "Calling openai docs",
        currentSkillId: "openai-docs",
        bubbleMessages: [{ threadId: "thread-running", message: "Calling openai docs", eventAt: 3_000 }],
      }),
    );
  });

  it("treats activity target changes as employee changes", () => {
    const base = [createEmployee()];
    const next = [
      createEmployee({
        activityTargetSkillId: "world-monitor",
        activityTargetPosition: [4, 0, 8.35],
        activityTargetObjectPosition: [4, 0, 7],
        activityEffectVariant: "ghost",
      }),
    ];

    expect(buildEmployeeSignature(base)).not.toBe(buildEmployeeSignature(next));

    const currentValue = createValue({ employees: base });
    const nextValue = createValue({ employees: next });

    const stabilized = stabilizeOfficeData(currentValue, nextValue);
    expect(stabilized.employees).toBe(nextValue.employees);
  });

  it("treats skill binding changes as office object changes", () => {
    const base = [
      createOfficeObject({
        metadata: {
          displayName: "Monitor",
        },
      }),
    ];
    const next = [
      createOfficeObject({
        metadata: {
          displayName: "Monitor",
          skillBinding: {
            skillId: "world-monitor",
            label: "World Monitor",
          },
        },
      }),
    ];

    expect(buildOfficeObjectSignature(base)).not.toBe(buildOfficeObjectSignature(next));

    const currentValue = createValue({ officeObjects: base });
    const nextValue = createValue({ officeObjects: next });

    const stabilized = stabilizeOfficeData(currentValue, nextValue);
    expect(stabilized.officeObjects).toBe(nextValue.officeObjects);
  });

  it("keeps semantically unchanged model payloads stable across polling snapshots", () => {
    const currentValue = {
      ...createValue(),
      companyModel: createCompanyModel(),
      workload: [
        { projectId: "proj-main", openTickets: 1, closedTickets: 2, queuePressure: "low" },
      ],
      warnings: [{ code: "runtime_empty", message: "Runtime has no visible agents." }],
    };
    const nextValue = {
      ...createValue(),
      companyModel: createCompanyModel(),
      workload: [
        { projectId: "proj-main", openTickets: 1, closedTickets: 2, queuePressure: "low" },
      ],
      warnings: [{ code: "runtime_empty", message: "Runtime has no visible agents." }],
    };

    const stabilized = stabilizeOfficeData(currentValue, nextValue);

    expect(stabilized).toBe(currentValue);
    expect(stabilized.companyModel).toBe(currentValue.companyModel);
    expect(stabilized.workload).toBe(currentValue.workload);
    expect(stabilized.warnings).toBe(currentValue.warnings);
  });
});

describe("office-data-provider team synthesis", () => {
  it("keeps Codex project tables visible while limiting employees to visible threads", () => {
    const idleProject = {
      id: "codex-proj-idle",
      departmentId: "dept-farplane",
      name: "Idle Project",
      githubUrl: "",
      status: "active" as const,
      goal: "Keep this project in inventory without rendering an empty table",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const pinnedProject = {
      ...idleProject,
      id: "codex-proj-pinned",
      name: "Pinned Project",
    };
    const activeProject = {
      ...idleProject,
      id: "codex-proj-active",
      name: "Active Project",
    };
    const company = createCompanyModel({
      projects: [idleProject, pinnedProject, activeProject],
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "codex-worker",
          role: "builder",
          projectId: "codex-proj-active",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      officeObjects: [
        {
          id: "team-cluster-team-codex-proj-pinned",
          identifier: "team-cluster-team-codex-proj-pinned",
          meshType: "team-cluster",
          position: [3, 0, 0],
          metadata: { teamId: "team-codex-proj-pinned" },
        },
      ],
      diagnostics: {
        ...createUnifiedOfficeModel().diagnostics,
        source: "codex",
      },
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.teams.map((team) => team._id)).toEqual([
      "team-management",
      "team-codex-proj-idle",
      "team-codex-proj-pinned",
      "team-codex-proj-active",
    ]);
    expect(result.employees.some((employee) => employee.teamId === "team-codex-proj-idle")).toBe(
      false,
    );
    expect(
      result.officeObjects.some((object) => object.metadata?.teamId === "team-codex-proj-idle"),
    ).toBe(true);
  });

  it("places seven-person project teams around one round table", () => {
    const project = {
      id: "proj-round-table",
      departmentId: "dept-farplane",
      name: "Round Table Project",
      githubUrl: "",
      status: "active" as const,
      goal: "Coordinate a larger project team",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const projectAgents = Array.from({ length: 7 }, (_, index) => ({
      agentId: `round-worker-${index}`,
      role: "builder" as const,
      projectId: project.id,
      heartbeatProfileId: "hb-ceo",
      lifecycleState: "active" as const,
    }));
    const runtimeAgents = projectAgents.map((agent) =>
      createRuntimeAgent({ agentId: agent.agentId, displayName: agent.agentId }),
    );
    const company = createCompanyModel({
      projects: [project],
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        ...projectAgents,
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [createRuntimeAgent(), ...runtimeAgents],
      configuredAgents: [createRuntimeAgent(), ...runtimeAgents],
      officeObjects: [
        {
          id: "team-cluster-team-proj-round-table",
          identifier: "team-cluster-team-proj-round-table",
          meshType: "team-cluster",
          position: [0, 0, 0],
          metadata: { teamId: "team-proj-round-table" },
        },
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings());
    const team = result.teams.find((entry) => entry._id === "team-proj-round-table");
    const workers = result.employees.filter((entry) => entry.teamId === "team-proj-round-table");
    const teamCenter = team?.clusterPosition ?? [0, 0, 0];
    const workerDistances = workers.map((worker) =>
      Number(
        Math.hypot(
          worker.initialPosition[0] - teamCenter[0],
          worker.initialPosition[2] - teamCenter[2],
        ).toFixed(2),
      ),
    );

    expect(team?.deskCount).toBe(7);
    expect(workers).toHaveLength(7);
    expect(workers.every((worker) => worker.wantsToWander === false)).toBe(true);
    expect(new Set(workers.map((worker) => worker.initialPosition.join(":"))).size).toBe(7);
    expect(new Set(workerDistances).size).toBe(1);
    expect(
      result.officeObjects.find((object) => object.metadata?.teamId === "team-proj-round-table")
        ?.metadata?.footprintWidth,
    ).toBeLessThan(6);
  });

  it("maps live status onto employee head fields", () => {
    const liveStatus: Record<string, AgentLiveStatus> = {
      "codex-worker": {
        agentId: "codex-worker",
        sessionKey: "codex-thread:thread-running",
        state: "running",
        statusText: "Codex turn running.",
        bubbles: [
          { id: "codex-thread-running", label: "Running", weight: 100 },
          { id: "codex-active-flag-0-planning", label: "Planning", weight: 90 },
        ],
        currentSkillId: "world-monitor",
        bubbleMessages: [{ threadId: "thread-running", message: "Calling world monitor", eventAt: 1770000000000 }],
        updatedAt: 1770000000000,
      },
    };
    const company = createCompanyModel({
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "codex-worker",
          role: "builder",
          projectId: "codex-proj-active",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "codex-worker",
          displayName: "Codex Worker",
          workspacePath: "/tmp/codex-worker",
          agentDir: "/tmp/codex-worker/agent",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "codex-worker",
          displayName: "Codex Worker",
          workspacePath: "/tmp/codex-worker",
          agentDir: "/tmp/codex-worker/agent",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings(), [], liveStatus);
    const employee = result.employees.find((entry) => entry._id === "employee-codex-worker");

    expect(employee).toEqual(
      expect.objectContaining({
        status: "info",
        statusMessage: "Codex turn running.",
        activityState: "running",
        activityLabel: "Running",
        activityDetail: "Codex turn running.",
        bubbleMessages: [{ threadId: "thread-running", message: "Calling world monitor", eventAt: 1770000000000 }],
        heartbeatState: "running",
        heartbeatBubbles: [
          { label: "Running", weight: 100 },
          { label: "Planning", weight: 90 },
        ],
      }),
    );
  });

  it("keeps idle thread detail available for employee hover badges", () => {
    const liveStatus: Record<string, AgentLiveStatus> = {
      "codex-worker": {
        agentId: "codex-worker",
        sessionKey: "codex-thread:thread-idle",
        state: "idle",
        statusText: "Codex thread idle.",
        bubbles: [],
        updatedAt: 1770000000000,
      },
    };
    const company = createCompanyModel({
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "codex-worker",
          role: "builder",
          projectId: "codex-proj-idle",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "codex-worker",
          displayName: "Idle Track Title",
          workspacePath: "/tmp/codex-worker",
          agentDir: "/tmp/codex-worker/agent",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "codex-worker",
          displayName: "Idle Track Title",
          workspacePath: "/tmp/codex-worker",
          agentDir: "/tmp/codex-worker/agent",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings(), [], liveStatus);
    const employee = result.employees.find((entry) => entry._id === "employee-codex-worker");

    expect(employee).toEqual(
      expect.objectContaining({
        name: "Idle Track Title",
        statusMessage: "Codex thread idle.",
        activityState: "idle",
        activityDetail: "Codex thread idle.",
        heartbeatState: "idle",
      }),
    );
  });

  it("labels completed Codex thread employees as ready with the thread title", () => {
    const liveStatus: Record<string, AgentLiveStatus> = {
      "codex-thread:ready-thread": {
        agentId: "codex-thread:ready-thread",
        sessionKey: "codex-thread:ready-thread",
        state: "done",
        statusText: "Codex response ready.",
        bubbles: [{ id: "codex-thread-update-ready", label: "Update ready", weight: 100 }],
        updatedAt: 1770000000000,
      },
    };
    const company = createCompanyModel({
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "codex-thread:ready-thread",
          role: "builder",
          projectId: "codex-proj-ready",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "codex-thread:ready-thread",
          displayName: "Finish character graphics",
          workspacePath: "/tmp/farplane-ui",
          agentDir: "/tmp/farplane-ui/agent",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "codex-thread:ready-thread",
          displayName: "Finish character graphics",
          workspacePath: "/tmp/farplane-ui",
          agentDir: "/tmp/farplane-ui/agent",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings(), [], liveStatus);
    const employee = result.employees.find(
      (entry) => entry._id === "employee-codex-thread:ready-thread",
    );

    expect(employee).toEqual(
      expect.objectContaining({
        name: "Finish character graphics",
        statusMessage: "Codex response ready.",
        activityState: "done",
        activityLabel: "Ready",
        activityDetail: "Codex response ready.",
        heartbeatState: "done",
        heartbeatBubbles: [{ label: "Update ready", weight: 100 }],
      }),
    );
  });

  it("removes the management table when a Codex thread is the CEO", () => {
    const company = createCompanyModel({
      projects: [
        {
          id: "codex-proj-workspace-farplane-ui",
          departmentId: "dept-codex-projects",
          name: "Farplane UI",
          githubUrl: "",
          status: "active",
          goal: "Build Farplane UI",
          kpis: [],
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
          agentId: "codex-thread:strategy-thread",
          role: "ceo",
          projectId: "codex-proj-workspace-farplane-ui",
          heartbeatProfileId: "hb-codex-thread-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
      ],
      heartbeatProfiles: [
        {
          id: "hb-codex-thread-ceo",
          role: "ceo",
          cadenceMinutes: 0,
          teamDescription: "Pinned Codex CEO thread",
          productDetails: "Long-running strategy thread",
          goal: "Keep office direction visible.",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent({
          agentId: "codex-thread:strategy-thread",
          displayName: "Strategy Thread",
          workspacePath: "/workspace/farplane-ui",
          agentDir: "/workspace/farplane-ui",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent({
          agentId: "codex-thread:strategy-thread",
          displayName: "Strategy Thread",
          workspacePath: "/workspace/farplane-ui",
          agentDir: "/workspace/farplane-ui",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.teams.some((team) => team._id === "team-management")).toBe(false);
    expect(
      result.officeObjects.some((object) => object.metadata?.teamId === "team-management"),
    ).toBe(false);
    expect(result.employees).toEqual([
      expect.objectContaining({
        _id: "employee-codex-thread:strategy-thread",
        teamId: "team-codex-proj-workspace-farplane-ui",
        isCEO: true,
        isSupervisor: true,
        presencePersistent: true,
      }),
    ]);
  });

  it("does not crown the first Codex thread unless it is the CEO", () => {
    const company = createCompanyModel({
      projects: [
        {
          id: "codex-proj-workspace-farplane-ui",
          departmentId: "dept-codex-projects",
          name: "Farplane UI",
          githubUrl: "",
          status: "active",
          goal: "Build Farplane UI",
          kpis: [],
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
          agentId: "codex-thread:resume-earlier-thread",
          role: "builder",
          projectId: "codex-proj-workspace-farplane-ui",
          heartbeatProfileId: "hb-codex-thread",
          lifecycleState: "active",
          presenceExpiresAt: 1770010800000,
        },
        {
          agentId: "codex-thread:weekly-strategy",
          role: "ceo",
          projectId: "codex-proj-workspace-farplane-ui",
          heartbeatProfileId: "hb-codex-thread-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent({
          agentId: "codex-thread:resume-earlier-thread",
          displayName: "Resume Earlier Thread",
        }),
        createRuntimeAgent({
          agentId: "codex-thread:weekly-strategy",
          displayName: "Weekly Strategy",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent({
          agentId: "codex-thread:resume-earlier-thread",
          displayName: "Resume Earlier Thread",
        }),
        createRuntimeAgent({
          agentId: "codex-thread:weekly-strategy",
          displayName: "Weekly Strategy",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.employees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "employee-codex-thread:resume-earlier-thread",
          isCEO: false,
          presencePersistent: false,
          presenceExpiresAt: 1770010800000,
        }),
        expect.objectContaining({
          _id: "employee-codex-thread:weekly-strategy",
          isCEO: true,
          presencePersistent: true,
        }),
      ]),
    );
  });

  it("derives office areas and uses project area centers as generated cluster anchors", () => {
    const company = createCompanyModel({
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
      ],
    });
    const settings = {
      ...createOfficeSettings(),
      officeLayout: {
        version: 1 as const,
        tileSize: 1 as const,
        tiles: Array.from({ length: 31 }, (_, xIndex) =>
          Array.from({ length: 25 }, (_z, zIndex) => `${xIndex - 15}:${zIndex - 12}`),
        ).flat(),
      },
    };

    const result = toOfficeData(createUnifiedOfficeModel({ company }), settings);
    expect(result.officeAreas.map((area) => area.label)).toEqual(
      expect.arrayContaining(["Zanarkand Technologies", "Farplane", "Farplane UI"]),
    );
    expect(
      result.officeAreas.find((area) => area.projectId === "proj-farplane-ui")?.parentId,
    ).toContain("farplane");
  });

  it("uses compact generated cluster anchors instead of spreading tables to area centers", () => {
    const company = createCompanyModel({
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
      ],
    });
    const settings = {
      ...createOfficeSettings(),
      officeLayout: {
        version: 1 as const,
        tileSize: 1 as const,
        tiles: Array.from({ length: 31 }, (_, xIndex) =>
          Array.from({ length: 25 }, (_z, zIndex) => `${xIndex - 15}:${zIndex - 12}`),
        ).flat(),
      },
    };
    const result = toOfficeData(createUnifiedOfficeModel({ company }), settings);
    const uiCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-farplane-ui",
    );
    if (!uiCluster) throw new Error("missing_farplane_ui_cluster");

    expect(result.officeSettings.officeLayout.tiles).toContain(
      `${uiCluster.position[0]}:${uiCluster.position[2]}`,
    );
    expect(Math.abs(uiCluster.position[0])).toBeLessThanOrEqual(8);
    expect(Math.abs(uiCluster.position[2])).toBeLessThanOrEqual(8);
  });

  it("preserves locked persisted team cluster positions over area-derived anchors", () => {
    const company = createCompanyModel({
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
      ],
    });
    const persistedPosition: [number, number, number] = [8, 0, 6];
    const result = toOfficeData(
      createUnifiedOfficeModel({
        company,
        officeObjects: [
          {
            id: "team-cluster-team-proj-farplane-ui",
            identifier: "team-cluster-team-proj-farplane-ui",
            meshType: "team-cluster",
            position: persistedPosition,
            metadata: { teamId: "team-proj-farplane-ui", layoutLocked: true },
          },
        ],
      }),
      {
        ...createOfficeSettings(),
        officeLayout: {
          version: 1,
          tileSize: 1,
          tiles: Array.from({ length: 31 }, (_, xIndex) =>
            Array.from({ length: 25 }, (_z, zIndex) => `${xIndex - 15}:${zIndex - 12}`),
          ).flat(),
        },
      },
    );

    const uiCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-farplane-ui",
    );
    expect(uiCluster?.position).toEqual(persistedPosition);
  });

  it("falls back from area anchors when nested project clusters would collide", () => {
    const projectBase = {
      departmentId: "dept-codex-projects",
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
    };
    const company = createCompanyModel({
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
          ...projectBase,
          id: "proj-farplane",
          name: "Farplane",
          trackingContext: "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane",
        },
        {
          ...projectBase,
          id: "proj-farplane-ui",
          name: "Farplane UI",
          trackingContext: "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI",
        },
      ],
    });
    const result = toOfficeData(createUnifiedOfficeModel({ company }), {
      ...createOfficeSettings(),
      officeLayout: {
        version: 1,
        tileSize: 1,
        tiles: Array.from({ length: 31 }, (_, xIndex) =>
          Array.from({ length: 25 }, (_z, zIndex) => `${xIndex - 15}:${zIndex - 12}`),
        ).flat(),
      },
    });
    const farplaneCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-farplane",
    );
    const uiCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-farplane-ui",
    );

    expect(farplaneCluster?.position).toBeDefined();
    expect(uiCluster?.position).toBeDefined();
    expect(uiCluster?.position).not.toEqual(farplaneCluster?.position);
  });

  it("auto-fits the rendered office layout around desks and placed furniture", () => {
    const company = createCompanyModel({
      projects: [
        {
          id: "proj-farplane-ui",
          departmentId: "dept-codex-projects",
          name: "Farplane UI",
          githubUrl: "",
          status: "active",
          goal: "Build the product",
          kpis: [],
          trackingContext: "/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI",
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: [],
          resourceEvents: [],
        },
      ],
    });
    const settings = {
      ...createOfficeSettings(),
      officeLayout: {
        version: 1 as const,
        tileSize: 1 as const,
        tiles: Array.from({ length: 61 }, (_, xIndex) =>
          Array.from({ length: 61 }, (_z, zIndex) => `${xIndex - 30}:${zIndex - 30}`),
        ).flat(),
      },
    };

    const result = toOfficeData(
      createUnifiedOfficeModel({
        company,
        officeObjects: [
          {
            id: "plant-entry",
            identifier: "plant-entry",
            meshType: "plant",
            position: [18, 0, -3],
            rotation: [0, 0, 0],
          },
        ],
      }),
      settings,
    );
    const bounds = getOfficeLayoutBounds(result.officeSettings.officeLayout);
    const objectCells = result.officeObjects
      .filter((object) => object.meshType !== "wall-art")
      .flatMap((object) =>
        getObjectFootprintCells({
          meshType: object.meshType,
          position: object.position,
          metadata: object.metadata,
          rotation: object.rotation,
        }),
      );
    const objectMinX = Math.min(...objectCells.map((cell) => cell.x));
    const objectMaxX = Math.max(...objectCells.map((cell) => cell.x));
    const objectMinZ = Math.min(...objectCells.map((cell) => cell.z));
    const objectMaxZ = Math.max(...objectCells.map((cell) => cell.z));
    const objectWidth = objectMaxX - objectMinX + 1;
    const objectDepth = objectMaxZ - objectMinZ + 1;

    expect(result.officeSettings.officeFootprint.width).toBeLessThan(61);
    expect(result.officeSettings.officeFootprint.depth).toBeLessThan(61);
    expect(result.officeSettings.officeLayout.tiles).toContain("18:-3");
    expect(bounds.width).toBeLessThanOrEqual(24);
    expect(bounds.maxTileX).toBeGreaterThanOrEqual(19);
    expect(
      result.officeSettings.officeLayout.tiles.length / (bounds.width * bounds.depth),
    ).toBe(1);
    expect(bounds.width).toBe(Math.max(8, objectWidth));
    expect(bounds.depth).toBe(Math.max(7, objectDepth));
    expect(bounds.minTileX).toBeLessThanOrEqual(objectMinX);
    expect(bounds.maxTileX).toBeGreaterThanOrEqual(objectMaxX);
    expect(bounds.minTileZ).toBeLessThanOrEqual(objectMinZ);
    expect(bounds.maxTileZ).toBeGreaterThanOrEqual(objectMaxZ);
    expect(
      deriveOfficeSpaceStats({
        employees: result.employees,
        officeObjects: result.officeObjects,
        officeLayout: result.officeSettings.officeLayout,
      }).walkablePercent,
    ).toBeGreaterThan(0.9);
  });

  it("adds office-divider sections around placed project clusters with four or more child projects", () => {
    const createProject = (index: number) => ({
      id: `proj-section-${index}`,
      departmentId: "dept-codex-projects",
      name: `Section ${index}`,
      githubUrl: "",
      status: "active" as const,
      goal: "Build the product",
      kpis: [],
      trackingContext:
        index === 0
          ? "/workspace/section-parent"
          : `/workspace/section-parent/child-${index}`,
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    });
    const compactResult = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: Array.from({ length: 4 }, (_, index) => createProject(index)),
        }),
      }),
      createOfficeSettings(),
    );
    const sectionedResult = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: Array.from({ length: 5 }, (_, index) => createProject(index)),
        }),
      }),
      createOfficeSettings(),
    );
    const generatedSectionWalls = sectionedResult.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" &&
        object.metadata?.sectionType === "project-subprojects",
    );

    expect(
      compactResult.officeObjects.some(
        (object) =>
          object.meshType === "office-divider" &&
          object.metadata?.sectionType === "project-subprojects",
      ),
    ).toBe(false);
    expect(generatedSectionWalls.length).toBeGreaterThan(0);
    expect(generatedSectionWalls.every((object) => object.metadata?.generated === true)).toBe(
      true,
    );
    expect(
      generatedSectionWalls.every((object) => object.metadata?.sectionBasis === "cluster-footprint"),
    ).toBe(true);
    expect(generatedSectionWalls.some((object) => {
      const width = object.metadata?.footprintWidth;
      return typeof width === "number" && width > 4;
    })).toBe(true);
    expect(
      generatedSectionWalls.some((object) => object.rotation[1] === Math.PI / 2),
    ).toBe(true);
  });

  it("adds office-divider sections around placed project teams with six or more workers", () => {
    const project = {
      id: "proj-large-team-section",
      departmentId: "dept-codex-projects",
      name: "Large Team Section",
      githubUrl: "",
      status: "active" as const,
      goal: "Coordinate a larger project team",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const projectAgents = Array.from({ length: 6 }, (_, index) => ({
      agentId: `large-section-worker-${index}`,
      role: "builder" as const,
      projectId: project.id,
      heartbeatProfileId: "hb-ceo",
      lifecycleState: "active" as const,
    }));
    const result = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: [project],
          agents: [createCompanyModel().agents[0], ...projectAgents],
        }),
        runtimeAgents: [
          createRuntimeAgent(),
          ...projectAgents.map((agent) =>
            createRuntimeAgent({ agentId: agent.agentId, displayName: agent.agentId }),
          ),
        ],
        configuredAgents: [
          createRuntimeAgent(),
          ...projectAgents.map((agent) =>
            createRuntimeAgent({ agentId: agent.agentId, displayName: agent.agentId }),
          ),
        ],
      }),
      createOfficeSettings(),
    );
    const generatedSectionWalls = result.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" && object.metadata?.sectionType === "large-team",
    );

    expect(generatedSectionWalls.length).toBeGreaterThan(0);
    expect(
      generatedSectionWalls.every((object) => object.metadata?.sectionId === "team-team-proj-large-team-section"),
    ).toBe(true);
    expect(
      generatedSectionWalls.every((object) => object.metadata?.sectionBasis === "cluster-footprint"),
    ).toBe(true);
    expect(generatedSectionWalls.length).toBeGreaterThanOrEqual(4);
  });

  it("does not synthesize a Farplane fallback cluster when all projects are archived", () => {
    const company = createCompanyModel({
      projects: [
        {
          id: "proj-farplane-dev-team",
          departmentId: "dept-farplane",
          name: "Farplane Dev Team",
          githubUrl: "",
          status: "archived",
          goal: "Internal product loop",
          kpis: [],
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
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "farplane-dev-team-pm",
          role: "pm",
          projectId: "proj-farplane-dev-team",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "retired",
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "farplane-dev-team-pm",
          displayName: "Farplane PM",
          workspacePath: "/tmp/farplane-dev-team-pm",
          agentDir: "/tmp/farplane-dev-team-pm/agent",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: "farplane-dev-team-pm",
          displayName: "Farplane PM",
          workspacePath: "/tmp/farplane-dev-team-pm",
          agentDir: "/tmp/farplane-dev-team-pm/agent",
        }),
      ],
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.teams.map((team) => team._id)).toEqual(["team-management"]);
    expect(
      result.officeObjects.every((object) => object.metadata?.teamId !== "team-farplane"),
    ).toBe(true);
    expect(result.employees.every((employee) => employee.team !== "Farplane")).toBe(true);
  });

  it("keeps the explicit Farplane fallback when no agents are discovered", () => {
    const unified = createUnifiedOfficeModel({
      runtimeAgents: [],
      configuredAgents: [],
    });

    const result = toOfficeData(unified, createOfficeSettings());

    expect(result.teams.map((team) => team._id)).toContain("team-farplane");
    expect(result.officeObjects.some((object) => object.metadata?.teamId === "team-farplane")).toBe(
      true,
    );
  });

  it("repairs grown team clusters into non-overlapping persisted placements with an annex fallback", () => {
    const projectBase = {
      departmentId: "dept-codex-projects",
      githubUrl: "",
      status: "active" as const,
      goal: "Build the product",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const agentRoles = ["pm", "builder", "builder", "builder", "biz_pm", "biz_executor"] as const;
    const company = createCompanyModel({
      projects: [
        {
          ...projectBase,
          id: "proj-farplane",
          name: "Farplane",
        },
        {
          ...projectBase,
          id: "proj-farplane-ui",
          name: "Farplane UI",
        },
      ],
      agents: [
        {
          agentId: "main",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        ...agentRoles.map((role, index) => ({
          agentId: `farplane-agent-${index}`,
          role,
          projectId: "proj-farplane",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active" as const,
        })),
        ...agentRoles.map((role, index) => ({
          agentId: `farplane-ui-agent-${index}`,
          role,
          projectId: "proj-farplane-ui",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active" as const,
        })),
      ],
    });
    const settings = {
      ...createOfficeSettings(),
      officeLayout: {
        version: 1 as const,
        tileSize: 1 as const,
        tiles: Array.from({ length: 11 }, (_, xIndex) =>
          Array.from({ length: 9 }, (_z, zIndex) => `${xIndex - 5}:${zIndex - 4}`),
        ).flat(),
      },
    };
    const unified = createUnifiedOfficeModel({
      company,
      officeObjects: [
        {
          id: "team-cluster-team-proj-farplane",
          identifier: "team-cluster-team-proj-farplane",
          meshType: "team-cluster",
          position: [0, 0, 0],
          metadata: { teamId: "team-proj-farplane", deskCount: 1 },
        },
        {
          id: "team-cluster-team-proj-farplane-ui",
          identifier: "team-cluster-team-proj-farplane-ui",
          meshType: "team-cluster",
          position: [0, 0, 0],
          metadata: { teamId: "team-proj-farplane-ui", deskCount: 1 },
        },
      ],
    });

    const repaired = repairTeamClusterPlacements({ unified, officeSettings: settings });
    const repairedClusters = repaired.unified.officeObjects.filter(
      (object) =>
        object.meshType === "team-cluster" &&
        (object.metadata?.teamId === "team-proj-farplane" ||
          object.metadata?.teamId === "team-proj-farplane-ui"),
    );

    expect(repaired.changed).toBe(true);
    expect(repaired.expandedLayout).toBe(true);
    expect(repairedClusters).toHaveLength(2);
    expect(repaired.repairedTeamIds).toEqual(
      expect.arrayContaining(["team-proj-farplane", "team-proj-farplane-ui"]),
    );
    const [leftCluster, rightCluster] = repairedClusters.map((cluster) => ({
      meshType: cluster.meshType,
      position: cluster.position,
      metadata: cluster.metadata,
      rotation: cluster.rotation,
    }));
    expect(
      canReserveOfficeObject({
        object: leftCluster,
        layout: repaired.officeSettings.officeLayout,
        reservation: createOfficePlacementReservation([rightCluster]),
      }),
    ).toBe(true);
    expect(
      repairedClusters.every((cluster) =>
        canReserveOfficeObject({
          object: {
            meshType: cluster.meshType,
            position: cluster.position,
            metadata: cluster.metadata,
            rotation: cluster.rotation,
          },
          layout: repaired.officeSettings.officeLayout,
          reservation: createOfficePlacementReservation(),
        }),
      ),
    ).toBe(true);
  });
});
