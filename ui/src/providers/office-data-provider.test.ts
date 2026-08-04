import { describe, expect, it } from "vitest";
import {
  getOfficeLayoutBounds,
  type OfficeLayoutModel,
  officeLayoutTileKey,
} from "@/modules/office/lib/office-layout";
import { evaluateOfficePoiGraph } from "@/modules/office/lib/office-layout-quality";
import { deriveOfficeSpaceStats } from "@/modules/office/lib/office-space-stats";
import { getOperatingRoomId } from "@/modules/office/lib/operating-room-catalog";
import type { EmployeeData, OfficeObject } from "@/modules/office/lib/types";
import { getOfficeSkillAnchorPosition } from "@/modules/office/skill-targeting";
import {
  getObjectFootprintAabb,
  getObjectFootprintCells,
} from "@/modules/office/systems/occupancy-system";
import {
  canReserveOfficeObject,
  createOfficePlacementReservation,
} from "@/modules/office/systems/placement-engine";
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
import { hookTelemetryRowsToObservedCodexWorkers } from "../../../convex/modules/hookTelemetry/projections";
import {
  localFarplaneEventsToObservedCodexWorkers,
  type ObservedCodexWorkerRow,
} from "./local-observed-codex-workers";
import { repairTeamClusterPlacements, toOfficeData } from "./office-data-mapper";
import {
  buildAgentLiveStatusSignature,
  buildOfficeStructuralRefreshSignature,
  mergeAgentLiveStatuses,
  mergeObservedCodexWorkerRows,
  mergeObservedCodexWorkersIntoUnifiedOfficeModel,
  OBSERVED_CODEX_PRESENCE_RANGE_MS,
  observedCodexWorkersToLiveStatuses,
} from "./office-data-refresh";
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

function objectOverlapsArea(
  object: OfficeObject,
  area: { rect: { minX: number; maxX: number; minZ: number; maxZ: number } },
): boolean {
  const bounds = getObjectFootprintAabb(object);
  return (
    bounds.minX < area.rect.maxX &&
    bounds.maxX > area.rect.minX &&
    bounds.minZ < area.rect.maxZ &&
    bounds.maxZ > area.rect.minZ
  );
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
        titleSource: "hook",
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
        titleSource: "hook",
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
        titleSource: "hook",
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
        presenceExpiresAt: 1770000300000,
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
    expect(ephemeralEmployee).toBeUndefined();
  });

  it("merges newest observed state with the strongest available title", () => {
    const workerId = "codex-observed:machine-a:codex-proj-farplane:thread-1";
    const merged = mergeObservedCodexWorkerRows([
      {
        workerId,
        sourceInstanceId: "machine-a",
        sessionKey: "thread-1",
        threadId: "thread-1",
        projectId: "codex-proj-farplane",
        displayName: "Native conversation name",
        titleSource: "native",
        state: "running",
        statusText: "Working",
        lastSeenAt: 1_000,
        controllable: false,
      },
      {
        workerId,
        sourceInstanceId: "machine-a",
        sessionKey: "thread-1",
        threadId: "thread-1",
        projectId: "codex-proj-farplane",
        displayName: "Codex thread-1",
        titleSource: "fallback",
        state: "done",
        statusText: "Complete",
        lastSeenAt: 2_000,
        controllable: false,
      },
    ]);

    expect(merged).toEqual([
      expect.objectContaining({
        displayName: "Native conversation name",
        titleSource: "native",
        state: "done",
        statusText: "Complete",
        lastSeenAt: 2_000,
      }),
    ]);
  });

  it("merges production-shaped Core and local rows into one canonically identified worker", () => {
    const projectPath = "/Users/kenji/Zanarkand Technologies/projects/Farplane-UI";
    const convexWorkers = hookTelemetryRowsToObservedCodexWorkers([
      {
        hookName: "farplane-console-ping",
        hookType: "UserPromptSubmit",
        projectId: "codex-proj-users-kenji-zanarkand-technologies-projects-farplane-ui",
        sessionId: "thread-1",
        eventAt: 1_000,
        payload: {
          machineId: "studio.local",
          machineName: "Studio Mac",
          projectDirectory: projectPath,
          threadId: "thread-1",
          nativeThreadTitle: "Native conversation name",
        },
      },
    ]);
    const localWorkers = localFarplaneEventsToObservedCodexWorkers(
      [
        {
          event_id: "evt-stop",
          hook_name: "Stop",
          metadata: { cwd: projectPath, hostname: "studio.local" },
          project_name: "Farplane-UI",
          project_root: projectPath,
          session_id: "thread-1",
          timestamp: "2026-07-15T15:30:00.000Z",
          turn_id: "turn-1",
        },
      ],
      { now: Date.parse("2026-07-15T15:30:01.000Z"), rangeMs: 5 * 60 * 1000 },
    );

    const merged = mergeObservedCodexWorkerRows([...convexWorkers, ...localWorkers]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        workerId:
          "codex-observed:studio.local:codex-proj-users-kenji-zanarkand-technologies-projects-farplane-ui:thread-1",
        sourceInstanceId: "studio.local",
        machineName: "studio.local",
        displayName: "Native conversation name",
        titleSource: "native",
        state: "done",
      }),
    );
  });

  it("replaces an app-server thread roster row with hook-canonical observed presence", () => {
    const observedWorkers: ObservedCodexWorkerRow[] = [
      {
        workerId: "codex-observed:machine-a:codex-proj-farplane:thread-1",
        sourceInstanceId: "machine-a",
        machineId: "machine-a",
        sessionKey: "thread-1",
        threadId: "thread-1",
        projectId: "codex-proj-farplane",
        displayName: "Observed duplicate",
        titleSource: "hook",
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

    const merged = mergeObservedCodexWorkersIntoUnifiedOfficeModel(
      unified,
      observedWorkers,
      1770000000000,
    );

    expect(merged.runtimeAgents.map((agent) => agent.agentId)).toEqual([
      "codex-observed:machine-a:codex-proj-farplane:thread-1",
    ]);
  });

  it("preserves pinned Codex CEO and manager rows without hook observations", () => {
    const company = createCompanyModel({
      agents: [
        {
          agentId: "codex-thread:strategy",
          role: "ceo",
          heartbeatProfileId: "hb-ceo",
          isCeo: true,
          lifecycleState: "active",
        },
        {
          agentId: "codex-thread:manager",
          role: "pm",
          projectId: "codex-proj-farplane",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active",
        },
        {
          agentId: "codex-thread:ordinary",
          role: "builder",
          projectId: "codex-proj-farplane",
          heartbeatProfileId: "hb-ceo",
          lifecycleState: "active",
        },
      ],
    });
    const threadAgents = ["strategy", "manager", "ordinary"].map((threadId) =>
      createRuntimeAgent({ agentId: `codex-thread:${threadId}` }),
    );
    const merged = mergeObservedCodexWorkersIntoUnifiedOfficeModel(
      createUnifiedOfficeModel({
        company,
        runtimeAgents: threadAgents,
        configuredAgents: threadAgents,
      }),
      [],
    );

    expect(merged.company.agents.map((agent) => agent.agentId)).toEqual([
      "codex-thread:strategy",
      "codex-thread:manager",
    ]);
    expect(merged.runtimeAgents.map((agent) => agent.agentId)).toEqual([
      "codex-thread:strategy",
      "codex-thread:manager",
    ]);
    expect(merged.configuredAgents.map((agent) => agent.agentId)).toEqual([
      "codex-thread:strategy",
      "codex-thread:manager",
    ]);
  });

  it("expires observed root presence exactly five minutes after lastSeenAt", () => {
    const lastSeenAt = 1_770_000_000_000;
    const worker: ObservedCodexWorkerRow = {
      workerId: "codex-observed:machine-a:codex-proj-farplane:thread-1",
      sourceInstanceId: "machine-a",
      sessionKey: "thread-1",
      threadId: "thread-1",
      projectId: "codex-proj-farplane",
      displayName: "Five minute root",
      titleSource: "hook",
      state: "running",
      statusText: "Working",
      lastSeenAt,
      controllable: false,
    };

    const visible = mergeObservedCodexWorkersIntoUnifiedOfficeModel(
      createUnifiedOfficeModel(),
      [worker],
      lastSeenAt + OBSERVED_CODEX_PRESENCE_RANGE_MS - 1,
    );
    const expired = mergeObservedCodexWorkersIntoUnifiedOfficeModel(
      createUnifiedOfficeModel(),
      [worker],
      lastSeenAt + OBSERVED_CODEX_PRESENCE_RANGE_MS,
    );

    expect(visible.runtimeAgents.map((agent) => agent.agentId)).toContain(worker.workerId);
    expect(expired.runtimeAgents.map((agent) => agent.agentId)).not.toContain(worker.workerId);
  });

  it("keeps a goal-backed Codex thread instead of replacing it with observed telemetry", () => {
    const goal = {
      threadId: "goal-thread",
      objective: "Keep the approved rollout moving.",
      status: "active" as const,
      tokenBudget: 200_000,
      tokensUsed: 12_500,
      timeUsedSeconds: 3_900,
      createdAt: 1_770_000_000,
      updatedAt: 1_770_000_100,
    };
    const runtimeMetadata = { codexThreadGoal: goal };
    const threadAgentId = "codex-thread:goal-thread";
    const unified = createUnifiedOfficeModel({
      company: createCompanyModel({
        agents: [
          {
            agentId: threadAgentId,
            role: "builder",
            projectId: "codex-proj-farplane",
            heartbeatProfileId: "hb-codex-goal-thread",
            lifecycleState: "active",
            runtimeMetadata,
          },
        ],
      }),
      runtimeAgents: [createRuntimeAgent({ agentId: threadAgentId, runtimeMetadata })],
      configuredAgents: [createRuntimeAgent({ agentId: threadAgentId, runtimeMetadata })],
    });
    const observedWorker: ObservedCodexWorkerRow = {
      workerId: "codex-observed:machine-a:codex-proj-farplane:goal-thread",
      sourceInstanceId: "machine-a",
      sessionKey: "goal-thread",
      threadId: "goal-thread",
      projectId: "codex-proj-farplane",
      displayName: "Observed duplicate",
      titleSource: "hook",
      state: "running",
      statusText: "Working",
      lastSeenAt: Date.now(),
      controllable: false,
    };

    const merged = mergeObservedCodexWorkersIntoUnifiedOfficeModel(unified, [observedWorker]);

    expect(merged.company.agents).toHaveLength(1);
    expect(merged.company.agents[0]?.agentId).toBe(threadAgentId);
    expect(merged.company.agents[0]?.runtimeMetadata?.codexThreadGoal).toEqual(goal);
    expect(merged.runtimeAgents.map((agent) => agent.agentId)).toEqual([threadAgentId]);
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
        titleSource: "hook",
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
      titleSource: "hook",
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

  it("treats persistence reason tags as employee changes", () => {
    const heartbeat = [createEmployee({ presencePersistent: true, persistenceTag: "heartbeat" })];
    const goal = [createEmployee({ presencePersistent: true, persistenceTag: "goal" })];

    expect(buildEmployeeSignature(heartbeat)).not.toBe(buildEmployeeSignature(goal));

    const currentValue = createValue({ employees: heartbeat });
    const nextValue = createValue({ employees: goal });
    expect(stabilizeOfficeData(currentValue, nextValue).employees).toBe(nextValue.employees);
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

describe("Office3D project visibility projection", () => {
  it("removes hidden project geometry and people without deleting company data", () => {
    const visibleProject = {
      id: "project-visible",
      name: "Visible",
      goal: "Ship visible work",
      status: "active" as const,
    };
    const hiddenProject = {
      id: "project-hidden",
      name: "Hidden",
      goal: "Keep durable history",
      status: "active" as const,
    };
    const company = createCompanyModel({
      projects: [visibleProject, hiddenProject],
      agents: [
        ...createCompanyModel().agents,
        {
          agentId: "visible-worker",
          role: "worker" as const,
          projectId: visibleProject.id,
          lifecycleState: "active" as const,
        },
        {
          agentId: "hidden-worker",
          role: "worker" as const,
          projectId: hiddenProject.id,
          lifecycleState: "active" as const,
        },
      ],
    });
    const unified = createUnifiedOfficeModel({
      company,
      configuredAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({ agentId: "visible-worker" }),
        createRuntimeAgent({ agentId: "hidden-worker" }),
      ],
      runtimeAgents: [
        createRuntimeAgent(),
        createRuntimeAgent({ agentId: "visible-worker" }),
        createRuntimeAgent({ agentId: "hidden-worker" }),
      ],
    });
    const visibleProjectIds = new Set([visibleProject.id]);
    const repaired = repairTeamClusterPlacements({
      unified,
      officeSettings: createOfficeSettings(),
      visibleProjectIds,
    });
    const result = toOfficeData(repaired.unified, repaired.officeSettings, [], {}, undefined, {
      visibleProjectIds,
    });

    expect(result.companyModel?.projects.map((project) => project.id)).toEqual([
      visibleProject.id,
      hiddenProject.id,
    ]);
    expect(result.teams.some((team) => team._id === `team-${visibleProject.id}`)).toBe(true);
    expect(result.teams.some((team) => team._id === `team-${hiddenProject.id}`)).toBe(false);
    expect(result.employees.some((employee) => employee._id === "employee-hidden-worker")).toBe(
      false,
    );
    expect(
      result.officeObjects.some((object) => object.metadata?.teamId === `team-${hiddenProject.id}`),
    ).toBe(false);
  });
});

describe("office-data-provider team synthesis", () => {
  it("hydrates eleven placed operating rooms and projects their hosts without desk demand", () => {
    const model = createUnifiedOfficeModel({
      officeObjects: [
        {
          id: "activity-workshop",
          identifier: "activity-workshop",
          meshType: "activity-landmark",
          position: [18, 0, 0],
          rotation: [0, 0, 0],
          metadata: { canonicalActivityRoomId: "activity-workshop" },
        },
        {
          id: "activity-planning-room",
          identifier: "activity-planning-room",
          meshType: "activity-landmark",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
        {
          id: "user-planning-landmark",
          identifier: "user-planning-landmark",
          meshType: "activity-landmark",
          position: [4, 0, 4],
          rotation: [0, 0, 0],
          metadata: { landmarkKind: "planning", displayName: "Private planning nook" },
        },
      ],
    });
    const result = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "team_neighborhoods",
    });
    const operatingRooms = result.officeObjects.filter(
      (object) => getOperatingRoomId(object) !== null,
    );
    const roomHosts = result.employees.filter((employee) =>
      String(employee._id).startsWith("employee-farplane-"),
    );

    expect(operatingRooms).toHaveLength(11);
    expect(roomHosts).toHaveLength(11);
    expect(roomHosts.every((employee) => employee.deskId === undefined)).toBe(true);
    expect(result.employees.some((employee) => employee.name === "Steward")).toBe(false);
    expect(result.employees.filter((employee) => employee.name === "Ledger")).toHaveLength(1);
    expect(result.teams.flatMap((team) => team.employees)).not.toEqual(
      expect.arrayContaining(roomHosts.map((employee) => employee._id)),
    );
    expect(result.desks).toHaveLength(
      result.teams.reduce((total, team) => total + Math.max(team.deskCount ?? 0, 0), 0),
    );
    expect(result.officeObjects.some((object) => object._id === "activity-planning-room")).toBe(
      false,
    );
    expect(result.officeObjects.some((object) => object._id === "user-planning-landmark")).toBe(
      true,
    );
  });

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
    expect(
      result.employees.filter((employee) => employee.teamId === "team-codex-proj-idle"),
    ).toEqual([
      expect.objectContaining({
        _id: "employee-project-pulse:codex-proj-idle",
        projectPulse: true,
      }),
    ]);
    expect(
      result.officeObjects.some((object) => object.metadata?.teamId === "team-codex-proj-idle"),
    ).toBe(true);
  });

  it("keeps one durable project station while overflow agents remain deskless", () => {
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
    const churned = toOfficeData(
      createUnifiedOfficeModel({
        company,
        runtimeAgents: [createRuntimeAgent(), ...[...runtimeAgents].reverse()],
        configuredAgents: [createRuntimeAgent(), ...[...runtimeAgents].reverse()],
      }),
      createOfficeSettings(),
    );
    const team = result.teams.find((entry) => entry._id === "team-proj-desk-sync");
    const workers = result.employees.filter((entry) => entry.teamId === team?._id);

    expect(team?.clusterPosition).toBeDefined();
    expect(team?.deskCount).toBe(1);
    expect(workers).toHaveLength(4);
    expect(workers.filter((worker) => worker.deskId)).toHaveLength(1);
    expect(workers.filter((worker) => worker.projectPulse)).toHaveLength(1);
    expect(workers.find((worker) => worker.projectPulse)?._id).toBe(
      "employee-project-pulse:proj-desk-sync",
    );
    expect(churned.employees.find((worker) => worker.projectPulse)).toEqual(
      expect.objectContaining({
        _id: "employee-project-pulse:proj-desk-sync",
        deskId: "desk-team-proj-desk-sync-0",
      }),
    );
    expect(new Set(workers.map((worker) => worker.initialPosition.join(":"))).size).toBe(4);
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

    const result = toOfficeData(unified, {
      ...createOfficeSettings(),
      layoutStrategy: "legacy",
    });
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
    expect(result.employees).toHaveLength(1);
    expect(result.employees).toEqual([
      expect.objectContaining({
        _id: "employee-codex-thread:strategy-thread",
        teamId: "team-codex-proj-workspace-farplane-ui",
        isCEO: true,
        isSupervisor: true,
        presencePersistent: true,
        persistenceTag: "heartbeat",
      }),
    ]);
    expect(
      result.officeObjects.find(
        (object) => object.metadata?.teamId === "team-codex-proj-workspace-farplane-ui",
      )?.metadata?.executivePod,
    ).toBe(true);
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

  it("maps a Codex thread goal into persistent employee details", () => {
    const goal = {
      threadId: "goal-thread",
      objective: "Ship and prove the persistent goal worker.",
      status: "active" as const,
      tokenBudget: 50_000,
      tokensUsed: 8_000,
      timeUsedSeconds: 1_800,
      createdAt: 1770000000,
      updatedAt: 1770001800,
    };
    const runtimeMetadata = { codexThreadGoal: goal };
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
          agentId: "codex-thread:goal-thread",
          role: "builder",
          projectId: "codex-proj-workspace-farplane-ui",
          heartbeatProfileId: "hb-codex-goal-thread",
          lifecycleState: "active",
          runtimeMetadata,
        },
      ],
    });
    const runtimeAgent = createRuntimeAgent({
      agentId: "codex-thread:goal-thread",
      displayName: "Goal Thread",
      runtimeMetadata,
    });

    const result = toOfficeData(
      createUnifiedOfficeModel({
        company,
        runtimeAgents: [runtimeAgent],
        configuredAgents: [runtimeAgent],
      }),
      createOfficeSettings(),
    );

    expect(result.employees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "employee-codex-thread:goal-thread",
          presencePersistent: true,
          persistenceTag: "goal",
          statusMessage: goal.objective,
          codexThreadGoal: goal,
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
    const result = toOfficeData(createUnifiedOfficeModel({ company }), {
      ...settings,
      layoutStrategy: "area_sorted_pack",
    });
    const uiCluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-farplane-ui",
    );
    const uiArea = result.officeAreas.find((area) => area.projectId === "proj-farplane-ui");
    if (!uiCluster) throw new Error("missing_farplane_ui_cluster");
    if (!uiArea) throw new Error("missing_farplane_ui_area");

    expect(result.officeSettings.officeLayout.tiles).toContain(
      `${uiCluster.position[0]}:${uiCluster.position[2]}`,
    );
    expect(uiCluster.position[0]).toBeGreaterThanOrEqual(uiArea.rect.minX - 1);
    expect(uiCluster.position[0]).toBeLessThanOrEqual(uiArea.rect.maxX + 1);
    expect(uiCluster.position[2]).toBeGreaterThanOrEqual(uiArea.rect.minZ - 1);
    expect(uiCluster.position[2]).toBeLessThanOrEqual(uiArea.rect.maxZ + 1);
    expect(uiCluster.position[0]).toBe(Math.round(uiArea.rect.centerX));
    expect(uiCluster.position[2]).toBe(Math.round(uiArea.rect.centerZ));
    expect(Math.abs(uiCluster.position[0])).toBeLessThanOrEqual(8);
    expect(Math.abs(uiCluster.position[2])).toBeLessThanOrEqual(8);
  });

  it("keeps generated project tables out of locked large furniture inside project areas", () => {
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
          id: "proj-furniture-aware",
          departmentId: "dept-codex-projects",
          name: "Furniture Aware",
          githubUrl: "",
          status: "active",
          goal: "",
          kpis: [],
          trackingContext: "/Users/kenjipcx/furniture-aware",
          accountEvents: [],
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: [],
          resourceEvents: [],
        },
      ],
    });
    const result = toOfficeData(
      createUnifiedOfficeModel({
        company,
        officeObjects: [
          {
            id: "bookshelf-project-center",
            identifier: "bookshelf-project-center",
            meshType: "bookshelf",
            position: [0, 0, 0],
            metadata: { layoutLocked: true },
          },
        ],
      }),
      {
        ...createOfficeSettings(),
        layoutStrategy: "hierarchical_treemap",
        officeLayout: {
          version: 1 as const,
          tileSize: 1 as const,
          tiles: Array.from({ length: 31 }, (_, xIndex) =>
            Array.from({ length: 25 }, (_z, zIndex) => `${xIndex - 15}:${zIndex - 12}`),
          ).flat(),
        },
      },
    );
    const cluster = result.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-furniture-aware",
    );
    const bookshelf = result.officeObjects.find(
      (object) => object._id === "bookshelf-project-center",
    );
    if (!cluster) throw new Error("missing_furniture_aware_cluster");
    if (!bookshelf) throw new Error("missing_locked_bookshelf");
    const bookshelfCells = new Set(getObjectFootprintCells(bookshelf).map((cell) => cell.key));
    const clusterCells = getObjectFootprintCells(cluster).map((cell) => cell.key);

    expect(clusterCells.some((cell) => bookshelfCells.has(cell))).toBe(false);
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
      { ...settings, layoutStrategy: "legacy" },
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

    const result = toOfficeData(createUnifiedOfficeModel({ company }), {
      ...createOfficeSettings(),
      layoutStrategy: "legacy",
    });
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
      { ...createOfficeSettings(), layoutStrategy: "legacy" },
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
    expect(districts.officeSettings.officeFootprint.width).toBeGreaterThanOrEqual(15);
    expect(districts.officeSettings.officeFootprint.depth).toBeGreaterThanOrEqual(13);
    expect(leftArea?.rect.width).toBeGreaterThanOrEqual(5);
    expect(leftArea?.rect.depth).toBeGreaterThanOrEqual(5);
    expect(rightArea?.rect.width).toBeGreaterThanOrEqual(5);
    expect(rightArea?.rect.depth).toBeGreaterThanOrEqual(5);
  });

  it("places large default furniture into project-district slack instead of project cores", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const result = toOfficeData(model, {
      ...createOfficeSettings(),
      layoutStrategy: "hierarchical_treemap",
    });
    const largeFurniture = result.officeObjects.filter((object) =>
      ["bookshelf", "couch", "pantry"].includes(object.meshType),
    );
    const projectCoreAreas = result.officeAreas.filter((area) => area.projectId);
    const bounds = getOfficeLayoutBounds(result.officeSettings.officeLayout);
    const layoutRadius = Math.hypot(bounds.width, bounds.depth) / 2;
    const averageCenterDistance =
      largeFurniture.reduce(
        (sum, object) =>
          sum +
          Math.hypot(object.position[0] - bounds.centerX, object.position[2] - bounds.centerZ),
        0,
      ) / Math.max(1, largeFurniture.length);

    expect(largeFurniture.length).toBeGreaterThan(0);
    expect(averageCenterDistance).toBeLessThanOrEqual(layoutRadius * 0.62);
    for (const object of largeFurniture) {
      expect(projectCoreAreas.some((area) => objectOverlapsArea(object, area))).toBe(false);
    }
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
    expect(
      result.officeObjects.filter((object) => object.meshType === "command-commons"),
    ).toHaveLength(1);
    expect(result.officeSettings.decor).toEqual({
      floorPatternId: "graphite_grid",
      wallColorId: "command_charcoal",
      backgroundId: "midnight_tide",
    });
  });

  it("reloads an equipped manual command office with one persisted commons", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const generated = toOfficeData(model, createOfficeSettings());
    const persistedKitObjects = generated.officeObjects
      .filter(
        (object) => object.meshType === "command-commons" || object.meshType === "team-cluster",
      )
      .map((object) => ({
        id: object._id,
        identifier: object._id,
        meshType: object.meshType,
        position: object.position,
        rotation: object.rotation,
        scale: object.scale,
        metadata: object.metadata,
      }));
    const reloaded = toOfficeData(
      { ...model, officeObjects: persistedKitObjects },
      {
        ...generated.officeSettings,
        layoutStrategy: "manual",
        officeKit: {
          kitId: "command-office",
          kitVersion: 1,
          seed: "test",
          status: "equipped",
          projectCapacity: 7,
          revision: 1,
        },
      },
    );

    expect(
      reloaded.officeObjects.filter((object) => object.meshType === "command-commons"),
    ).toHaveLength(1);
    expect(
      reloaded.teams
        .filter((team) => team.name !== "Management")
        .every((team) => team.deskCount === 1),
    ).toBe(true);
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
      "hierarchical_treemap",
      "area_sorted_pack",
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

  it("lets automatic layouts move locked activity destinations to an inward-facing edge", () => {
    const { model } = createTwoProjectRoomOfficeModel();
    const savedPosition: [number, number, number] = [120, 0, -90];
    const landmark = {
      id: "library-destination",
      identifier: "library-destination",
      meshType: "activity-landmark" as const,
      position: savedPosition,
      rotation: [0, 0, 0] as [number, number, number],
      metadata: {
        landmarkKind: "library",
        placementLocked: true,
        footprintWidth: 2,
        footprintDepth: 2,
        footprintClearance: 0,
      },
    };
    const automatic = toOfficeData(
      { ...model, officeObjects: [landmark] },
      { ...createOfficeSettings(), layoutStrategy: "area_sorted_pack" },
    );
    const automaticNearOrigin = toOfficeData(
      { ...model, officeObjects: [{ ...landmark, position: [0, 0, 0] }] },
      { ...createOfficeSettings(), layoutStrategy: "area_sorted_pack" },
    );
    const manual = toOfficeData(
      { ...model, officeObjects: [landmark] },
      { ...createOfficeSettings(), layoutStrategy: "manual" },
    );
    const automaticLandmark = automatic.officeObjects.find((object) => object._id === landmark.id);
    const manualLandmark = manual.officeObjects.find((object) => object._id === landmark.id);
    const bounds = getOfficeLayoutBounds(automatic.officeSettings.officeLayout);
    const nearOriginBounds = getOfficeLayoutBounds(automaticNearOrigin.officeSettings.officeLayout);
    const automaticFootprintEdgeDistance = automaticLandmark
      ? Math.min(
          ...getObjectFootprintCells(automaticLandmark).map((cell) =>
            Math.min(
              cell.x - bounds.minTileX,
              bounds.maxTileX - cell.x,
              cell.z - bounds.minTileZ,
              bounds.maxTileZ - cell.z,
            ),
          ),
        )
      : Number.POSITIVE_INFINITY;

    expect(automaticLandmark).toBeDefined();
    expect(automaticLandmark?.position).not.toEqual(savedPosition);
    expect({ width: bounds.width, depth: bounds.depth }).toEqual({
      width: nearOriginBounds.width,
      depth: nearOriginBounds.depth,
    });
    expect(automaticFootprintEdgeDistance).toBe(0);
    expect([0, Math.PI / 2, Math.PI, -Math.PI / 2]).toContain(automaticLandmark?.rotation[1]);
    if (!automaticLandmark) throw new Error("Expected automatic landmark");
    const anchor = getOfficeSkillAnchorPosition(automaticLandmark);
    const inwardDotProduct =
      (anchor[0] - automaticLandmark.position[0]) *
        (bounds.centerX - automaticLandmark.position[0]) +
      (anchor[2] - automaticLandmark.position[2]) *
        (bounds.centerZ - automaticLandmark.position[2]);
    expect(inwardDotProduct).toBeGreaterThan(0);
    expect(manualLandmark?.position).toEqual(savedPosition);
    expect(manualLandmark?.rotation).toEqual([0, 0, 0]);
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

  it("keeps uniform command-office slots in project source order", () => {
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
    expect(smallTeam!.clusterPosition![0]).toBeLessThan(largeTeam!.clusterPosition![0]);
  });

  it("keeps projects beyond command-office capacity visibly unseated without furniture", () => {
    const projects = Array.from({ length: 9 }, (_, index) => ({
      id: `capacity-project-${index}`,
      departmentId: "dept-codex-projects",
      name: `Capacity Project ${index}`,
      githubUrl: "",
      status: "active" as const,
      goal: `Own capacity slot ${index}`,
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    }));
    const result = toOfficeData(
      createUnifiedOfficeModel({ company: createCompanyModel({ projects }) }),
      createOfficeSettings(),
    );
    const projectClusters = result.officeObjects.filter(
      (object) =>
        object.meshType === "team-cluster" && object.metadata?.teamId !== "team-management",
    );
    const pulses = result.employees.filter((employee) => employee.projectPulse);

    expect(projectClusters).toHaveLength(7);
    expect(pulses).toHaveLength(9);
    expect(pulses.filter((pulse) => pulse.deskId)).toHaveLength(7);
    expect(pulses.slice(7).every((pulse) => pulse.deskId == null)).toBe(true);
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

  it("prunes persisted team clusters that no longer belong to an active project", () => {
    const project = {
      id: "proj-farplane-ui",
      departmentId: "dept-codex-projects",
      name: "Farplane UI",
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
    const repaired = repairTeamClusterPlacements({
      unified: createUnifiedOfficeModel({
        company: createCompanyModel({ projects: [project] }),
        officeObjects: [
          {
            id: "team-cluster-team-proj-farplane-ui",
            identifier: "team-cluster-team-proj-farplane-ui",
            meshType: "team-cluster",
            position: [0, 0, 0],
            metadata: { teamId: "team-proj-farplane-ui", name: "Farplane UI", deskCount: 1 },
          },
          {
            id: "team-cluster-team-codex-proj-local-deadbeef",
            identifier: "team-cluster-team-codex-proj-local-deadbeef",
            meshType: "team-cluster",
            position: [6, 0, 6],
            metadata: {
              teamId: "team-codex-proj-local-deadbeef",
              name: "local-deadbeef",
              deskCount: 1,
            },
          },
          {
            id: "plant-kept",
            identifier: "plant-kept",
            meshType: "plant",
            position: [3, 0, 3],
            metadata: {},
          },
        ],
      }),
      officeSettings: createOfficeSettings(),
    });

    expect(repaired.changed).toBe(true);
    expect(
      repaired.unified.officeObjects.some(
        (object) => object.metadata?.teamId === "team-codex-proj-local-deadbeef",
      ),
    ).toBe(false);
    expect(repaired.unified.officeObjects.some((object) => object.id === "plant-kept")).toBe(true);
  });

  it("persists project table label changes when placement is otherwise stable", () => {
    const project = {
      id: "proj-farplane-ui",
      departmentId: "dept-codex-projects",
      name: "Old Project Name",
      githubUrl: "",
      status: "active" as const,
      goal: "Old project goal",
      kpis: [],
      accountEvents: [],
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const initial = repairTeamClusterPlacements({
      unified: createUnifiedOfficeModel({
        company: createCompanyModel({ projects: [project] }),
      }),
      officeSettings: createOfficeSettings(),
    });
    const renamedCompany = createCompanyModel({
      projects: [{ ...project, name: "Farplane UI", goal: "Current project goal" }],
    });

    const renamed = repairTeamClusterPlacements({
      unified: { ...initial.unified, company: renamedCompany },
      officeSettings: initial.officeSettings,
    });
    const projectCluster = renamed.unified.officeObjects.find(
      (object) => object.metadata?.teamId === "team-proj-farplane-ui",
    );

    expect(renamed.changed).toBe(true);
    expect(renamed.repairedTeamIds).toContain("team-proj-farplane-ui");
    expect(projectCluster?.metadata?.name).toBe("Farplane UI");
    expect(projectCluster?.metadata?.description).toBe("Current project goal");
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
