import { describe, expect, it } from "vitest";

import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";
import {
  getOfficeLayoutBounds,
  officeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/modules/office/lib/office-layout";
import { deriveOfficeSpaceStats } from "@/modules/office/lib/office-space-stats";
import { evaluateOfficePoiGraph } from "@/modules/office/lib/office-layout-quality";
import {
  canReserveOfficeObject,
  createOfficePlacementReservation,
} from "@/modules/office/systems/placement-engine";
import { getObjectFootprintCells } from "@/modules/office/systems/occupancy-system";
import {
  getAbsoluteDeskPosition,
  getDeskRotation,
  getEmployeePositionAtDesk,
} from "@/modules/office/utils/layout";
import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyModel,
  OfficeSettingsModel,
  UnifiedOfficeModel,
} from "@/modules/runtime";
import { repairTeamClusterPlacements, toOfficeData } from "./office-data-mapper";
import {
  buildAgentLiveStatusSignature,
  buildOfficeStructuralRefreshSignature,
  mergeAgentLiveStatuses,
  mergeObservedCodexWorkersIntoUnifiedOfficeModel,
  observedCodexWorkersToLiveStatuses,
} from "./office-data-refresh";
import type { ObservedCodexWorkerRow } from "./local-observed-codex-workers";
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

function expectPositionCloseTo(
  received: [number, number, number],
  expected: [number, number, number],
): void {
  expect(received[0]).toBeCloseTo(expected[0], 4);
  expect(received[1]).toBeCloseTo(expected[1], 4);
  expect(received[2]).toBeCloseTo(expected[2], 4);
}

function countInteriorLayoutHoles(layout: OfficeLayoutModel): number {
  const tileSet = new Set(layout.tiles);
  const bounds = getOfficeLayoutBounds(layout);
  const minTileX = bounds.minTileX - 1;
  const maxTileX = bounds.maxTileX + 1;
  const minTileZ = bounds.minTileZ - 1;
  const maxTileZ = bounds.maxTileZ + 1;
  const exteriorVoid = new Set<string>();
  const pending = [{ x: minTileX, z: minTileZ }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (
      current.x < minTileX ||
      current.x > maxTileX ||
      current.z < minTileZ ||
      current.z > maxTileZ
    ) {
      continue;
    }
    const key = officeLayoutTileKey(current.x, current.z);
    if (tileSet.has(key) || exteriorVoid.has(key)) continue;
    exteriorVoid.add(key);
    pending.push(
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
    );
  }

  let interiorHoles = 0;
  for (let x = bounds.minTileX; x <= bounds.maxTileX; x += 1) {
    for (let z = bounds.minTileZ; z <= bounds.maxTileZ; z += 1) {
      const key = officeLayoutTileKey(x, z);
      if (!tileSet.has(key) && !exteriorVoid.has(key)) interiorHoles += 1;
    }
  }
  return interiorHoles;
}

function getCellBounds(cells: Array<{ x: number; z: number }>): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  return {
    minX: Math.min(...cells.map((cell) => cell.x)),
    maxX: Math.max(...cells.map((cell) => cell.x)),
    minZ: Math.min(...cells.map((cell) => cell.z)),
    maxZ: Math.max(...cells.map((cell) => cell.z)),
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
    upsertFederationPolicy: async () => ({
      ok: false,
      error: "adapter_unavailable",
    }),
    upsertProviderIndexProfile: async () => ({
      ok: false,
      error: "adapter_unavailable",
    }),
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

function createTwoProjectRoomOfficeModel(): {
  model: UnifiedOfficeModel;
  leftProject: CompanyModel["projects"][number];
  rightProject: CompanyModel["projects"][number];
} {
  const leftProject = {
    id: "proj-left-room",
    departmentId: "dept-codex-projects",
    name: "Left Room",
    githubUrl: "",
    status: "active" as const,
    goal: "Own the left area",
    kpis: [],
    accountEvents: [],
    ledger: [],
    experiments: [],
    metricEvents: [],
    resources: [],
    resourceEvents: [],
  };
  const rightProject = {
    id: "proj-right-room",
    departmentId: "dept-codex-projects",
    name: "Right Room",
    githubUrl: "",
    status: "active" as const,
    goal: "Own the right area",
    kpis: [],
    accountEvents: [],
    ledger: [],
    experiments: [],
    metricEvents: [],
    resources: [],
    resourceEvents: [],
  };
  const leftWorker = {
    agentId: "left-worker",
    role: "builder" as const,
    projectId: leftProject.id,
    heartbeatProfileId: "hb-ceo",
    lifecycleState: "active" as const,
  };
  const rightWorker = {
    agentId: "right-worker",
    role: "builder" as const,
    projectId: rightProject.id,
    heartbeatProfileId: "hb-ceo",
    lifecycleState: "active" as const,
  };

  return {
    leftProject,
    rightProject,
    model: createUnifiedOfficeModel({
      company: createCompanyModel({
        departments: [
          {
            id: "dept-codex-projects",
            name: "Codex Projects",
            description: "",
            goal: "",
          },
        ],
        projects: [leftProject, rightProject],
        agents: [createCompanyModel().agents[0], leftWorker, rightWorker],
      }),
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: leftWorker.agentId,
          displayName: "Left Worker",
        }),
        createRuntimeAgent({
          agentId: rightWorker.agentId,
          displayName: "Right Worker",
        }),
      ],
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({
          agentId: leftWorker.agentId,
          displayName: "Left Worker",
        }),
        createRuntimeAgent({
          agentId: rightWorker.agentId,
          displayName: "Right Worker",
        }),
      ],
    }),
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
          bubbleMessages: [
            {
              threadId: "thread-running",
              message: "Calling openai docs",
              eventAt: 3_000,
            },
          ],
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
        currentSkillId: "openai-docs",
        bubbleMessages: [
          {
            threadId: "thread-running",
            message: "Calling openai docs",
            eventAt: 3_000,
          },
        ],
      }),
    );
  });

  it("keeps telemetry-observed Codex workers read-only unless a real thread agent owns the lane", () => {
    const observedWorkers: ObservedCodexWorkerRow[] = [
      {
        workerId: "codex-observed:machine-a:codex-proj-farplane:thread-1",
        sourceInstanceId: "machine-a",
        machineId: "machine-a",
        machineName: "Studio Mac",
        sessionKey: "thread-1",
        threadId: "thread-1",
        projectId: "codex-proj-farplane",
        projectPath: "/work/farplane",
        displayName: "Build presence",
        state: "running",
        statusText: "Calling goal advisor",
        lastSeenAt: 1770000000000,
        controllable: false,
      },
      {
        workerId: "codex-observed:machine-a:codex-proj-farplane:child-thread",
        sourceInstanceId: "machine-a",
        machineId: "machine-a",
        sessionKey: "child-thread",
        threadId: "child-thread",
        parentThreadId: "thread-1",
        projectId: "codex-proj-farplane",
        projectPath: "/work/farplane",
        displayName: "Delegated review",
        state: "done",
        statusText: "Review complete",
        lastSeenAt: 1770000000100,
        controllable: false,
      },
      {
        workerId: "codex-observed:machine-a:codex-proj-farplane:subagent-thread",
        sourceInstanceId: "machine-a",
        machineId: "machine-a",
        sessionKey: "subagent-thread",
        threadId: "subagent-thread",
        parentThreadId: "thread-1",
        projectId: "codex-proj-farplane",
        projectPath: "/work/farplane",
        displayName: "Ephemeral review lane",
        state: "running",
        statusText: "Delegated Codex worker running",
        currentSkillId: "code-review",
        isEphemeral: true,
        lastSeenAt: 1770000000200,
        controllable: false,
      },
    ];
    const unified = mergeObservedCodexWorkersIntoUnifiedOfficeModel(
      createUnifiedOfficeModel({
        company: createCompanyModel({
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
        }),
        runtimeAgents: [createRuntimeAgent()],
        configuredAgents: [createRuntimeAgent()],
        diagnostics: {
          ...createUnifiedOfficeModel().diagnostics,
          source: "codex",
        },
      }),
      observedWorkers,
      1770000000000,
    );
    const liveStatus = observedCodexWorkersToLiveStatuses(observedWorkers);
    const result = toOfficeData(unified, createOfficeSettings(), [], liveStatus);
    const employee = result.employees.find(
      (entry) => entry._id === "employee-codex-observed:machine-a:codex-proj-farplane:thread-1",
    );
    const delegatedEmployee = result.employees.find(
      (entry) => entry._id === "employee-codex-observed:machine-a:codex-proj-farplane:child-thread",
    );
    const ephemeralEmployee = result.employees.find(
      (entry) =>
        entry._id === "employee-codex-observed:machine-a:codex-proj-farplane:subagent-thread",
    );

    expect(unified.company.projects.map((project) => project.id)).toContain("codex-proj-farplane");
    expect(employee).toEqual(
      expect.objectContaining({
        name: "Build presence",
        teamId: "team-codex-proj-farplane",
        statusMessage: "Calling goal advisor",
        presencePersistent: false,
        presenceExpiresAt: 1770000900000,
        observedRuntime: expect.objectContaining({
          kind: "codex",
          sourceInstanceId: "machine-a",
          machineId: "machine-a",
          machineName: "Studio Mac",
          sessionKey: "thread-1",
          threadId: "thread-1",
          controllable: false,
        }),
      }),
    );
    expect(delegatedEmployee).toBeUndefined();
    expect(ephemeralEmployee).toEqual(
      expect.objectContaining({
        name: "Ephemeral review lane",
        presencePersistent: false,
        activityState: "review",
        activityTargetSkillId: "code-review",
        wantsToWander: false,
        observedRuntime: expect.objectContaining({
          parentThreadId: "thread-1",
          threadId: "subagent-thread",
          controllable: false,
        }),
      }),
    );
  });

  it("does not duplicate observed telemetry when an app-server thread agent already owns the same thread", () => {
    const observedWorkers: ObservedCodexWorkerRow[] = [
      {
        workerId: "codex-observed:machine-a:codex-proj-farplane:thread-1",
        sourceInstanceId: "machine-a",
        machineId: "machine-a",
        sessionKey: "thread-1",
        threadId: "thread-1",
        projectId: "codex-proj-farplane",
        displayName: "Observed duplicate",
        state: "running",
        statusText: "Observed duplicate",
        lastSeenAt: 1770000000000,
        controllable: false,
      },
    ];
    const unified = createUnifiedOfficeModel({
      company: createCompanyModel({
        agents: [
          {
            agentId: "codex-thread:thread-1",
            role: "builder",
            projectId: "codex-proj-farplane",
            heartbeatProfileId: "hb-ceo",
            lifecycleState: "active",
          },
        ],
      }),
      runtimeAgents: [createRuntimeAgent({ agentId: "codex-thread:thread-1" })],
      configuredAgents: [createRuntimeAgent({ agentId: "codex-thread:thread-1" })],
    });

    const merged = mergeObservedCodexWorkersIntoUnifiedOfficeModel(unified, observedWorkers);

    expect(merged.runtimeAgents.map((agent) => agent.agentId)).toEqual(["codex-thread:thread-1"]);
  });

  it("does not duplicate observed telemetry when a Codex PM aggregate owns the thread", () => {
    const observedWorkers: ObservedCodexWorkerRow[] = [
      {
        workerId: "codex-observed:machine-a:codex-proj-farplane:pm-thread",
        sourceInstanceId: "machine-a",
        machineId: "machine-a",
        sessionKey: "pm-thread",
        threadId: "pm-thread",
        projectId: "codex-proj-farplane",
        displayName: "PM telemetry duplicate",
        state: "running",
        statusText: "PM heartbeat running",
        lastSeenAt: 1770000000000,
        controllable: false,
      },
    ];
    const pmRuntimeMetadata = {
      codexProjectPm: {
        projectId: "codex-proj-farplane",
        threadIds: ["pm-thread"],
      },
    };
    const unified = createUnifiedOfficeModel({
      company: createCompanyModel({
        agents: [
          {
            agentId: "codex-pm:codex-proj-farplane",
            role: "pm",
            projectId: "codex-proj-farplane",
            heartbeatProfileId: "hb-ceo",
            lifecycleState: "active",
            runtimeMetadata: pmRuntimeMetadata,
          },
        ],
      }),
      runtimeAgents: [
        createRuntimeAgent({
          agentId: "codex-pm:codex-proj-farplane",
          runtimeMetadata: pmRuntimeMetadata,
        }),
      ],
      configuredAgents: [
        createRuntimeAgent({
          agentId: "codex-pm:codex-proj-farplane",
          runtimeMetadata: pmRuntimeMetadata,
        }),
      ],
    });

    const merged = mergeObservedCodexWorkersIntoUnifiedOfficeModel(unified, observedWorkers);

    expect(merged.runtimeAgents.map((agent) => agent.agentId)).toEqual([
      "codex-pm:codex-proj-farplane",
    ]);
  });

  it("keeps structural refresh signatures stable for observed status freshness changes", () => {
    const baseWorker: ObservedCodexWorkerRow = {
      workerId: "codex-observed:machine-a:codex-proj-farplane:thread-1",
      sourceInstanceId: "machine-a",
      machineId: "machine-a",
      machineName: "Studio Mac",
      sessionKey: "thread-1",
      threadId: "thread-1",
      projectId: "codex-proj-farplane",
      projectPath: "/work/farplane",
      displayName: "Build presence",
      state: "running",
      statusText: "Calling goal advisor",
      lastSeenAt: 1770000000000,
      controllable: false,
    };
    const unified = createUnifiedOfficeModel();
    const officeSettings = createOfficeSettings();
    const first = buildOfficeStructuralRefreshSignature({
      unified,
      officeSettings,
      pendingApprovals: [],
      configSnapshot: null,
      observedWorkers: [baseWorker],
    });
    const second = buildOfficeStructuralRefreshSignature({
      unified,
      officeSettings,
      pendingApprovals: [],
      configSnapshot: null,
      observedWorkers: [
        {
          ...baseWorker,
          state: "done",
          statusText: "Response ready",
          lastSeenAt: 1770000030000,
        },
      ],
    });
    const movedProject = buildOfficeStructuralRefreshSignature({
      unified,
      officeSettings,
      pendingApprovals: [],
      configSnapshot: null,
      observedWorkers: [
        {
          ...baseWorker,
          projectId: "codex-proj-other",
          projectPath: "/work/other",
        },
      ],
    });

    expect(second).toBe(first);
    expect(movedProject).not.toBe(first);
  });

  it("ignores volatile config snapshot state versions in structural refresh signatures", () => {
    const unified = createUnifiedOfficeModel();
    const officeSettings = createOfficeSettings();
    const first = buildOfficeStructuralRefreshSignature({
      unified,
      officeSettings,
      pendingApprovals: [],
      configSnapshot: {
        stateVersion: 1770000000000,
        config: {
          runtime: { kind: "codex", label: "Codex" },
          company: {
            version: 1,
            tasks: [{ id: "task-1", updatedAt: 1770000000000 }],
            agents: [{ agentId: "codex-main", lastUpdatedAt: 1770000000000 }],
          },
          agents: { default: "codex-main" },
        },
      },
      observedWorkers: [],
    });
    const second = buildOfficeStructuralRefreshSignature({
      unified,
      officeSettings,
      pendingApprovals: [],
      configSnapshot: {
        stateVersion: 1770000030000,
        config: {
          runtime: { kind: "codex", label: "Codex" },
          company: {
            version: 1,
            tasks: [{ id: "task-1", updatedAt: 1770000030000 }],
            agents: [{ agentId: "codex-main", lastUpdatedAt: 1770000030000 }],
          },
          agents: { default: "codex-main" },
        },
      },
      observedWorkers: [],
    });
    const changedConfig = buildOfficeStructuralRefreshSignature({
      unified,
      officeSettings,
      pendingApprovals: [],
      configSnapshot: {
        stateVersion: 1770000030000,
        config: {
          runtime: { kind: "codex", label: "Codex" },
          company: {
            version: 1,
            tasks: [{ id: "task-1", updatedAt: 1770000030000 }],
            agents: [{ agentId: "codex-main", lastUpdatedAt: 1770000030000 }],
          },
          agents: { default: "codex-thread:123" },
        },
      },
      observedWorkers: [],
    });

    expect(second).toBe(first);
    expect(changedConfig).not.toBe(first);
  });

  it("keeps structural signatures stable for volatile runtime metadata and default settings", () => {
    const officeSettings = createOfficeSettings();
    const explicitDefaultSettings = {
      ...officeSettings,
      layoutStrategy: "team_neighborhoods" as const,
      officeLayout: {
        ...officeSettings.officeLayout,
        tiles: [...officeSettings.officeLayout.tiles].reverse(),
      },
    };
    const first = buildOfficeStructuralRefreshSignature({
      unified: createUnifiedOfficeModel({
        company: createCompanyModel({
          agents: [
            {
              agentId: "main",
              role: "ceo",
              heartbeatProfileId: "hb-ceo",
              isCeo: true,
              lifecycleState: "active",
              runtimeMetadata: {
                projectAnchor: "hq",
                lastSeenAt: 1770000000000,
                statusText: "thinking",
              },
            },
          ],
        }),
        runtimeAgents: [
          createRuntimeAgent({
            runtimeMetadata: {
              projectAnchor: "hq",
              updatedAt: 1770000000000,
              sessionCount: 4,
            },
          }),
        ],
      }),
      officeSettings,
      pendingApprovals: [],
      configSnapshot: null,
      observedWorkers: [],
    });
    const second = buildOfficeStructuralRefreshSignature({
      unified: createUnifiedOfficeModel({
        company: createCompanyModel({
          agents: [
            {
              agentId: "main",
              role: "ceo",
              heartbeatProfileId: "hb-ceo",
              isCeo: true,
              lifecycleState: "active",
              runtimeMetadata: {
                projectAnchor: "hq",
                lastSeenAt: 1770000040000,
                statusText: "ready",
              },
            },
          ],
        }),
        runtimeAgents: [
          createRuntimeAgent({
            runtimeMetadata: {
              projectAnchor: "hq",
              updatedAt: 1770000040000,
              sessionCount: 8,
            },
          }),
        ],
      }),
      officeSettings: explicitDefaultSettings,
      pendingApprovals: [],
      configSnapshot: null,
      observedWorkers: [],
    });
    const changedAnchor = buildOfficeStructuralRefreshSignature({
      unified: createUnifiedOfficeModel({
        runtimeAgents: [
          createRuntimeAgent({
            runtimeMetadata: {
              projectAnchor: "annex",
              updatedAt: 1770000040000,
            },
          }),
        ],
      }),
      officeSettings,
      pendingApprovals: [],
      configSnapshot: null,
      observedWorkers: [],
    });

    expect(second).toBe(first);
    expect(changedAnchor).not.toBe(first);
  });

  it("compares live-status signatures independent of insertion order", () => {
    const alpha: AgentLiveStatus = {
      agentId: "alpha",
      state: "running",
      statusText: "Running",
      bubbles: [],
      updatedAt: 1770000000000,
    };
    const beta: AgentLiveStatus = {
      agentId: "beta",
      state: "done",
      statusText: "Ready",
      bubbles: [],
      updatedAt: 1770000000001,
    };

    expect(buildAgentLiveStatusSignature({ alpha, beta })).toBe(
      buildAgentLiveStatusSignature({ beta, alpha }),
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
        {
          projectId: "proj-main",
          openTickets: 1,
          closedTickets: 2,
          queuePressure: "low",
        },
      ],
      warnings: [{ code: "runtime_empty", message: "Runtime has no visible agents." }],
    };
    const nextValue = {
      ...createValue(),
      companyModel: createCompanyModel(),
      workload: [
        {
          projectId: "proj-main",
          openTickets: 1,
          closedTickets: 2,
          queuePressure: "low",
        },
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

  it("derives employee desk targets from the final procedural desk positions", () => {
    const project = {
      id: "proj-desk-sync",
      departmentId: "dept-farplane",
      name: "Desk Sync Project",
      githubUrl: "",
      status: "active" as const,
      goal: "Keep agents visually anchored to their assigned desks",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const projectAgents = Array.from({ length: 3 }, (_, index) => ({
      agentId: `desk-sync-worker-${index}`,
      role: "builder" as const,
      projectId: project.id,
      heartbeatProfileId: "hb-ceo",
      lifecycleState: "active" as const,
    }));
    const runtimeAgents = projectAgents.map((agent) =>
      createRuntimeAgent({
        agentId: agent.agentId,
        displayName: agent.agentId,
      }),
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
    const result = toOfficeData(
      createUnifiedOfficeModel({
        company,
        runtimeAgents: [createRuntimeAgent(), ...runtimeAgents],
        configuredAgents: [createRuntimeAgent(), ...runtimeAgents],
      }),
      createOfficeSettings(),
    );
    const team = result.teams.find((entry) => entry._id === "team-proj-desk-sync");
    const workers = result.employees.filter((entry) => entry.teamId === team?._id);

    expect(team?.clusterPosition).toBeDefined();
    expect(team?.deskCount).toBe(3);
    expect(workers).toHaveLength(3);

    for (const worker of workers) {
      const deskPrefix = `desk-${team?._id}-`;
      const deskId = String(worker.deskId ?? "");
      expect(deskId.startsWith(deskPrefix)).toBe(true);
      const deskIndex = Number(deskId.slice(deskPrefix.length));
      const deskPosition = getAbsoluteDeskPosition(
        team?.clusterPosition ?? [0, 0, 0],
        deskIndex,
        team?.deskCount ?? 1,
      );
      const deskRotation = getDeskRotation(deskIndex, team?.deskCount ?? 1);

      expectPositionCloseTo(
        worker.initialPosition,
        getEmployeePositionAtDesk(deskPosition, deskRotation),
      );
    }
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
      createRuntimeAgent({
        agentId: agent.agentId,
        displayName: agent.agentId,
      }),
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
    ).toBeGreaterThan(6);
    expect(
      result.officeObjects.find((object) => object.metadata?.teamId === "team-proj-round-table")
        ?.metadata?.footprintWidth,
    ).toBeLessThan(7.5);
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
        bubbleMessages: [
          {
            threadId: "thread-running",
            message: "Calling world monitor",
            eventAt: 1770000000000,
          },
        ],
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
        bubbleMessages: [
          {
            threadId: "thread-running",
            message: "Calling world monitor",
            eventAt: 1770000000000,
          },
        ],
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
        bubbles: [
          {
            id: "codex-thread-update-ready",
            label: "Update ready",
            weight: 100,
          },
        ],
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
      layoutStrategy: "legacy" as const,
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

  it("keeps generated area-anchor clusters inside the final trimmed office", () => {
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
    const plant = result.officeObjects.find((object) => object._id === "plant-entry");
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
    expect(plant?.position).toBeDefined();
    expect(plant?.position).not.toEqual([18, 0, -3]);
    expect(Math.abs(plant?.position[0] ?? 18)).toBeLessThan(18);
    expect(bounds.width).toBeLessThanOrEqual(Math.max(30, objectWidth) + 1);
    expect(
      result.officeSettings.officeLayout.tiles.length / (bounds.width * bounds.depth),
    ).toBeLessThanOrEqual(1);
    expect(bounds.width).toBeGreaterThanOrEqual(objectWidth);
    expect(bounds.width).toBeLessThanOrEqual(Math.max(30, objectWidth) + 1);
    expect(bounds.depth).toBeGreaterThanOrEqual(objectDepth);
    expect(bounds.depth).toBeLessThanOrEqual(Math.max(24, objectDepth) + 1);
    expect(bounds.minTileX).toBeLessThanOrEqual(objectMinX);
    expect(bounds.maxTileX).toBeGreaterThanOrEqual(objectMaxX);
    expect(bounds.minTileZ).toBeLessThanOrEqual(objectMinZ);
    expect(bounds.maxTileZ).toBeGreaterThanOrEqual(objectMaxZ);
    expect(result.officeSettings.officeLayout.tiles.length).toBeLessThanOrEqual(
      bounds.width * bounds.depth,
    );
    const stats = deriveOfficeSpaceStats({
      employees: result.employees,
      officeObjects: result.officeObjects,
      officeLayout: result.officeSettings.officeLayout,
    });
    expect(countInteriorLayoutHoles(result.officeSettings.officeLayout)).toBe(0);
    expect(stats.walkablePercent).toBeGreaterThanOrEqual(0.5);
  });

  it("includes default furniture when auto-fitting the rendered office layout", () => {
    const company = createCompanyModel({
      projects: [
        {
          id: "proj-default-furniture-fit",
          departmentId: "dept-codex-projects",
          name: "Default Furniture Fit",
          githubUrl: "",
          status: "active",
          goal: "Keep default furniture inside the generated room",
          kpis: [],
          trackingContext: "/workspace/default-furniture-fit",
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: [],
          resourceEvents: [],
        },
      ],
    });

    const result = toOfficeData(createUnifiedOfficeModel({ company }), createOfficeSettings());
    const bounds = getOfficeLayoutBounds(result.officeSettings.officeLayout);
    const defaultFurniture = result.officeObjects.filter((object) =>
      ["plant", "bookshelf", "couch", "pantry"].includes(object.meshType),
    );

    expect(defaultFurniture.length).toBeGreaterThan(0);
    for (const object of defaultFurniture) {
      for (const cell of getObjectFootprintCells({
        meshType: object.meshType,
        position: object.position,
        metadata: object.metadata,
        rotation: object.rotation,
      })) {
        expect(cell.x).toBeGreaterThanOrEqual(bounds.minTileX);
        expect(cell.x).toBeLessThanOrEqual(bounds.maxTileX);
        expect(cell.z).toBeGreaterThanOrEqual(bounds.minTileZ);
        expect(cell.z).toBeLessThanOrEqual(bounds.maxTileZ);
      }
    }
  });

  it("treats unlocked divider-like furniture as packable instead of a layout boundary", () => {
    const result = toOfficeData(
      createUnifiedOfficeModel({
        officeObjects: [
          {
            id: "test-wall",
            identifier: "test-wall",
            meshType: "glass-wall",
            position: [20, 0, 0],
            rotation: [0, Math.PI / 2, 0],
            metadata: {
              footprintWidth: 4,
              footprintDepth: 0.35,
              footprintClearance: 0.05,
            },
          },
          {
            id: "test-plant",
            identifier: "test-plant",
            meshType: "plant",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            metadata: { layoutLocked: true },
          },
        ],
      }),
      {
        ...createOfficeSettings(),
        layoutStrategy: "legacy",
      },
    );
    const bounds = getOfficeLayoutBounds(result.officeSettings.officeLayout);
    const wall = result.officeObjects.find((object) => object._id === "test-wall");
    const generatedWalls = result.officeObjects.filter(
      (object) => object.meshType === "office-divider" && object.metadata?.generated === true,
    );

    expect(generatedWalls).toHaveLength(0);
    expect(bounds.maxTileX).toBeLessThan(20);
    if (wall) {
      expect(wall.position).not.toEqual([20, 0, 0]);
      for (const cell of getObjectFootprintCells({
        meshType: wall.meshType,
        position: wall.position,
        metadata: wall.metadata,
        rotation: wall.rotation,
      })) {
        expect(cell.x).toBeGreaterThanOrEqual(bounds.minTileX);
        expect(cell.x).toBeLessThanOrEqual(bounds.maxTileX);
        expect(cell.z).toBeGreaterThanOrEqual(bounds.minTileZ);
        expect(cell.z).toBeLessThanOrEqual(bounds.maxTileZ);
      }
    }
  });

  it("keeps narrow subproject circulation lanes open instead of forcing dividers", () => {
    const createProject = (index: number) => ({
      id: `proj-section-${index}`,
      departmentId: "dept-codex-projects",
      name: `Section ${index}`,
      githubUrl: "",
      status: "active" as const,
      goal: "Build the product",
      kpis: [],
      trackingContext:
        index === 0 ? "/workspace/section-parent" : `/workspace/section-parent/child-${index}`,
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    });
    const neighborProject = {
      id: "proj-section-neighbor",
      departmentId: "dept-codex-projects",
      name: "Section Neighbor",
      githubUrl: "",
      status: "active" as const,
      goal: "Neighboring project region",
      kpis: [],
      trackingContext: "/workspace/section-neighbor",
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const compactResult = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: [
            ...Array.from({ length: 4 }, (_, index) => createProject(index)),
            neighborProject,
          ],
        }),
      }),
      {
        ...createOfficeSettings(),
        layoutStrategy: "legacy",
      },
    );
    const sectionedResult = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: [
            ...Array.from({ length: 5 }, (_, index) => createProject(index)),
            neighborProject,
          ],
        }),
      }),
      {
        ...createOfficeSettings(),
        layoutStrategy: "legacy",
      },
    );
    const compactGeneratedSectionWalls = compactResult.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" &&
        object.metadata?.sectionType === "project-subprojects",
    );
    const sectionedGeneratedSectionWalls = sectionedResult.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" &&
        object.metadata?.sectionType === "project-subprojects",
    );

    expect(compactGeneratedSectionWalls).toHaveLength(0);
    expect(sectionedGeneratedSectionWalls).toHaveLength(0);
    expect(sectionedResult.officeAreas.length).toBeGreaterThan(compactResult.officeAreas.length);
  });

  it("keeps large project tables furniture-first instead of wrapping them in ad hoc rooms", () => {
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
    const neighborProject = {
      id: "proj-large-team-neighbor",
      departmentId: "dept-codex-projects",
      name: "Large Team Neighbor",
      githubUrl: "",
      status: "active" as const,
      goal: "Neighboring project region",
      kpis: [],
      trackingContext: "/workspace/large-team-neighbor",
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const projectAgents = Array.from({ length: 8 }, (_, index) => ({
      agentId: `large-section-worker-${index}`,
      role: "builder" as const,
      projectId: project.id,
      heartbeatProfileId: "hb-ceo",
      lifecycleState: "active" as const,
    }));
    const result = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: [project, neighborProject],
          agents: [createCompanyModel().agents[0], ...projectAgents],
        }),
        runtimeAgents: [
          createRuntimeAgent(),
          ...projectAgents.map((agent) =>
            createRuntimeAgent({
              agentId: agent.agentId,
              displayName: agent.agentId,
            }),
          ),
        ],
        configuredAgents: [
          createRuntimeAgent(),
          ...projectAgents.map((agent) =>
            createRuntimeAgent({
              agentId: agent.agentId,
              displayName: agent.agentId,
            }),
          ),
        ],
      }),
      createOfficeSettings(),
    );
    const generatedRoomWalls = result.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" &&
        object.metadata?.sectionType === "large-team" &&
        object.metadata?.sectionBasis === "large-team-room",
    );
    const defaultFurniture = result.officeObjects.filter((object) =>
      ["plant", "bookshelf", "couch", "pantry"].includes(object.meshType),
    );

    expect(generatedRoomWalls).toHaveLength(0);
    expect(defaultFurniture.length).toBeGreaterThan(0);
  });

  it("can use the activity treemap layout strategy with open project-room lanes", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const result = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "activity_treemap",
    });
    const projectRoomWalls = result.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" && object.metadata?.sectionType === "project-room",
    );

    expect(projectRoomWalls).toHaveLength(0);
    expect(result.officeAreas.map((area) => area.projectId).filter(Boolean)).toEqual(
      expect.arrayContaining(["proj-left-room", "proj-right-room"]),
    );
  });

  it("keeps Classic Auto-Fit from drawing project district room walls", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const result = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "legacy",
    });
    const projectRoomWalls = result.officeObjects.filter(
      (object) =>
        object.meshType === "office-divider" && object.metadata?.sectionType === "project-room",
    );

    expect(projectRoomWalls).toHaveLength(0);
  });

  it("keeps district area overlays while compacting the physical solver footprint", () => {
    const { model, leftProject, rightProject } = createTwoProjectRoomOfficeModel();
    const classic = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "legacy",
    });
    const districts = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "activity_treemap",
    });
    const leftArea = districts.officeAreas.find((area) => area.projectId === leftProject.id);
    const rightArea = districts.officeAreas.find((area) => area.projectId === rightProject.id);
    const classicArea =
      classic.officeSettings.officeFootprint.width * classic.officeSettings.officeFootprint.depth;
    const districtArea =
      districts.officeSettings.officeFootprint.width *
      districts.officeSettings.officeFootprint.depth;

    expect(districtArea).toBeGreaterThan(classicArea);
    expect(districts.officeSettings.officeFootprint.width).toBeGreaterThanOrEqual(16);
    expect(districts.officeSettings.officeFootprint.depth).toBeGreaterThanOrEqual(13);
    expect(leftArea?.rect.width).toBeGreaterThanOrEqual(6);
    expect(leftArea?.rect.depth).toBeGreaterThanOrEqual(5);
    expect(rightArea?.rect.width).toBeGreaterThanOrEqual(6);
    expect(rightArea?.rect.depth).toBeGreaterThanOrEqual(5);
  });

  it("keeps command districts compact while preserving packed objects", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const projectDistricts = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "activity_treemap",
    });
    const commandDistricts = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "command_districts",
    });
    const projectArea =
      projectDistricts.officeSettings.officeFootprint.width *
      projectDistricts.officeSettings.officeFootprint.depth;
    const commandArea =
      commandDistricts.officeSettings.officeFootprint.width *
      commandDistricts.officeSettings.officeFootprint.depth;
    const generatedWalls = commandDistricts.officeObjects.filter(
      (object) => object.meshType === "office-divider" && object.metadata?.generated === true,
    );

    expect(commandArea).toBeLessThanOrEqual(Math.ceil(projectArea * 1.05));
    expect(commandDistricts.officeAreas.length).toBeGreaterThan(0);
    expect(generatedWalls).toHaveLength(0);
  });

  it("uses team neighborhoods as the default no-wall office layout", () => {
    const { model, leftProject, rightProject } = createTwoProjectRoomOfficeModel();
    const result = toOfficeData(model, createOfficeSettings());
    const generatedWalls = result.officeObjects.filter(
      (object) => object.meshType === "office-divider" && object.metadata?.generated === true,
    );

    expect(result.officeSettings.layoutStrategy).toBeUndefined();
    expect(result.officeAreas.length).toBeGreaterThan(0);
    expect(result.officeAreas.map((area) => area.projectId).filter(Boolean)).toEqual(
      expect.arrayContaining([leftProject.id, rightProject.id]),
    );
    expect(generatedWalls).toHaveLength(0);
  });

  it("solves team neighborhoods as a compact connected no-wall layout", () => {
    const { model, leftProject, rightProject } = createTwoProjectRoomOfficeModel();
    const result = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "team_neighborhoods",
    });
    const graph = evaluateOfficePoiGraph({
      layout: result.officeSettings.officeLayout,
      objects: result.officeObjects,
    });
    const generatedWalls = result.officeObjects.filter(
      (object) => object.meshType === "office-divider" && object.metadata?.generated === true,
    );
    const leftCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === `team-${leftProject.id}`,
    );
    const rightCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === `team-${rightProject.id}`,
    );

    expect(graph.disconnectedCount).toBe(0);
    expect(generatedWalls).toHaveLength(0);
    expect(leftCluster).toBeDefined();
    expect(rightCluster).toBeDefined();
    expect(result.officeSettings.officeLayout.tiles.length).toBeLessThan(1_000);
  });

  it("routes every automatic layout strategy through the canonical solver", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const strategies = [
      "legacy",
      "team_neighborhoods",
      "activity_treemap",
      "command_districts",
    ] as const;

    for (const layoutStrategy of strategies) {
      const result = toOfficeData(
        {
          ...model,
          officeObjects: [
            {
              id: `solver-probe-plant-${layoutStrategy}`,
              identifier: `solver-probe-plant-${layoutStrategy}`,
              meshType: "plant",
              position: [18, 0, -3],
              rotation: [0, 0, 0],
              metadata: {},
            },
          ],
        },
        {
          ...createOfficeSettings(),
          layoutStrategy,
        },
      );
      const graph = evaluateOfficePoiGraph({
        layout: result.officeSettings.officeLayout,
        objects: result.officeObjects,
      });
      const probe = result.officeObjects.find(
        (object) => object._id === `solver-probe-plant-${layoutStrategy}`,
      );
      const generatedWalls = result.officeObjects.filter(
        (object) => object.meshType === "office-divider" && object.metadata?.generated === true,
      );

      expect(probe?.position).not.toEqual([18, 0, -3]);
      expect(graph.disconnectedCount).toBe(0);
      expect(generatedWalls).toHaveLength(0);
      expect(countInteriorLayoutHoles(result.officeSettings.officeLayout)).toBe(0);
    }
  });

  it("keeps manual builder layout from auto-fitting or repacking saved objects", () => {
    const { model, leftProject } = createTwoProjectRoomOfficeModel();
    const manualTiles = Array.from({ length: 9 }, (_x, xIndex) =>
      Array.from({ length: 7 }, (_z, zIndex) => officeLayoutTileKey(xIndex - 4, zIndex - 3)),
    ).flat();
    const clusterPosition: [number, number, number] = [2, 0, 1];
    const plantPosition: [number, number, number] = [-3, 0, 2];

    const result = toOfficeData(
      {
        ...model,
        officeObjects: [
          {
            id: `team-cluster-team-${leftProject.id}`,
            identifier: `team-cluster-team-${leftProject.id}`,
            meshType: "team-cluster",
            position: clusterPosition,
            metadata: { teamId: `team-${leftProject.id}` },
          },
          {
            id: "plant-entry-right",
            identifier: "plant-entry-right",
            meshType: "plant",
            position: plantPosition,
            rotation: [0, 0, 0],
            metadata: {},
          },
        ],
      },
      {
        ...createOfficeSettings(),
        layoutStrategy: "manual",
        officeLayout: {
          version: 1,
          tileSize: 1,
          tiles: manualTiles,
        },
      },
    );

    const cluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === `team-${leftProject.id}`,
    );
    const plant = result.officeObjects.find((object) => object._id === "plant-entry-right");
    const generatedWalls = result.officeObjects.filter(
      (object) => object.meshType === "office-divider" && object.metadata?.generated === true,
    );

    expect(result.officeSettings.layoutStrategy).toBe("manual");
    expect(result.officeSettings.officeLayout.tiles).toEqual(manualTiles);
    expect(cluster?.position).toEqual(clusterPosition);
    expect(plant?.position).toEqual(plantPosition);
    expect(generatedWalls).toHaveLength(0);
  });

  it("keeps project district geometry stable when only thread status changes", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const settings = {
      ...createOfficeSettings(),
      layoutStrategy: "activity_treemap" as const,
    };
    const idle = toOfficeData(model, settings, [], {
      "left-worker": {
        agentId: "left-worker",
        state: "idle",
        statusText: "Idle",
        bubbles: [],
        updatedAt: 1_770_000_000_000,
      },
    });
    const running = toOfficeData(model, settings, [], {
      "left-worker": {
        agentId: "left-worker",
        state: "running",
        statusText: "Running tests",
        bubbles: [{ id: "running", label: "Running", weight: 100 }],
        updatedAt: 1_770_000_030_000,
      },
    });

    expect(buildOfficeObjectSignature(running.officeObjects)).toBe(
      buildOfficeObjectSignature(idle.officeObjects),
    );
    expect(running.officeAreas).toEqual(idle.officeAreas);
    expect(running.officeSettings).toEqual(idle.officeSettings);
    expect(buildEmployeeSignature(running.employees)).not.toBe(
      buildEmployeeSignature(idle.employees),
    );
  });

  it("reserves larger project team slots before smaller teams without reordering team data", () => {
    const smallProject = {
      id: "proj-small-team",
      departmentId: "dept-codex-projects",
      name: "Small Team",
      githubUrl: "",
      status: "active" as const,
      goal: "Keep a small project moving",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const largeProject = {
      id: "proj-large-team",
      departmentId: "dept-codex-projects",
      name: "Large Team",
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
    const smallProjectAgent = {
      agentId: "small-team-worker",
      role: "builder" as const,
      projectId: smallProject.id,
      heartbeatProfileId: "hb-ceo",
      lifecycleState: "active" as const,
    };
    const largeProjectAgents = Array.from({ length: 8 }, (_, index) => ({
      agentId: `large-team-worker-${index}`,
      role: "builder" as const,
      projectId: largeProject.id,
      heartbeatProfileId: "hb-ceo",
      lifecycleState: "active" as const,
    }));
    const projectAgents = [smallProjectAgent, ...largeProjectAgents];
    const result = toOfficeData(
      createUnifiedOfficeModel({
        company: createCompanyModel({
          projects: [smallProject, largeProject],
          agents: [createCompanyModel().agents[0], ...projectAgents],
        }),
        runtimeAgents: [
          createRuntimeAgent(),
          ...projectAgents.map((agent) =>
            createRuntimeAgent({
              agentId: agent.agentId,
              displayName: agent.agentId,
            }),
          ),
        ],
        configuredAgents: [
          createRuntimeAgent(),
          ...projectAgents.map((agent) =>
            createRuntimeAgent({
              agentId: agent.agentId,
              displayName: agent.agentId,
            }),
          ),
        ],
      }),
      createOfficeSettings(),
    );

    const smallTeam = result.teams.find((team) => team._id === `team-${smallProject.id}`);
    const largeTeam = result.teams.find((team) => team._id === `team-${largeProject.id}`);

    expect(result.teams.map((team) => team._id)).toEqual([
      "team-management",
      `team-${smallProject.id}`,
      `team-${largeProject.id}`,
    ]);
    expect(smallTeam?.clusterPosition).toBeDefined();
    expect(largeTeam?.clusterPosition).toBeDefined();
    expect(largeTeam!.clusterPosition![0]).toBeLessThan(smallTeam!.clusterPosition![0]);
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

    const repaired = repairTeamClusterPlacements({
      unified,
      officeSettings: settings,
    });
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
