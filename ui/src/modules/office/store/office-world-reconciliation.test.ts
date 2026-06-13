import { beforeEach, describe, expect, it } from "vitest";

import type { OfficeAreaNode } from "@/modules/office/lib/office-area-layout";
import type {
  DeskLayoutData,
  EmployeeData,
  OfficeId,
  OfficeObject,
  TeamData,
} from "@/modules/office/lib/types";
import type { AgentLiveStatus, OfficeSettingsModel } from "@/modules/runtime";
import {
  createInitialOfficeWorldData,
  reconcileOfficeWorldSnapshot,
  type OfficeWorldSnapshot,
} from "./office-world-reconciliation";
import { useOfficeWorldStore } from "./office-world-store";

function createOfficeSettings(): OfficeSettingsModel {
  return {
    meshAssetDir: "",
    officeFootprint: { width: 30, depth: 24 },
    officeLayout: {
      version: 1,
      tileSize: 1,
      tiles: ["0:0", "1:0"],
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

function createTeam(): TeamData {
  return {
    _id: "team-main" as OfficeId<"teams">,
    name: "Main",
    description: "Main team",
    employees: ["employee-main" as OfficeId<"employees">],
  };
}

function createEmployee(overrides: Partial<EmployeeData> = {}): EmployeeData {
  return {
    _id: "employee-main" as OfficeId<"employees">,
    teamId: "team-main" as OfficeId<"teams">,
    name: "Main Agent",
    initialPosition: [0, 0, 0],
    isBusy: false,
    team: "Main",
    ...overrides,
  };
}

function createObject(): OfficeObject {
  return {
    _id: "object-main" as OfficeId<"officeObjects">,
    meshType: "desk",
    position: [1, 0, 1],
    rotation: [0, 0, 0],
    metadata: {},
  };
}

function createArea(): OfficeAreaNode {
  return {
    id: "area-main",
    label: "Main Area",
    depth: 0,
    weight: 1,
    color: "#ffffff",
    rect: {
      minX: 0,
      maxX: 4,
      minZ: 0,
      maxZ: 4,
      centerX: 2,
      centerZ: 2,
      width: 4,
      depth: 4,
    },
  };
}

function createDesk(): DeskLayoutData {
  return { id: "desk-main-0", deskIndex: 0, team: "team-main" };
}

function createLiveStatus(overrides: Partial<AgentLiveStatus> = {}): AgentLiveStatus {
  return {
    agentId: "main",
    state: "idle",
    statusText: "Idle",
    bubbles: [],
    ...overrides,
  };
}

function createSnapshot(): OfficeWorldSnapshot {
  return {
    company: { _id: "company-main" as OfficeId<"companies">, name: "Farplane" },
    teams: [createTeam()],
    employees: [createEmployee()],
    desks: [createDesk()],
    officeObjects: [createObject()],
    officeAreas: [createArea()],
    officeSettings: createOfficeSettings(),
    companyModel: {
      version: 1,
      departments: [],
      projects: [],
      agents: [],
      roleSlots: [],
      tasks: [],
      federationPolicies: [],
      providerIndexProfiles: [],
      heartbeatProfiles: [],
      channelBindings: [],
      heartbeatRuntime: {
        enabled: true,
        pluginId: "farplane-heartbeat",
        serviceId: "company-heartbeat-loop",
        cadenceMinutes: 10,
      },
    },
    workload: [],
    warnings: [],
    liveStatusByAgentId: { main: createLiveStatus() },
    isLoading: false,
  };
}

describe("office world reconciliation", () => {
  beforeEach(() => {
    useOfficeWorldStore.getState().reset();
  });

  it("reports changed keys for the first adapter snapshot", () => {
    const current = createInitialOfficeWorldData();
    const { next, changedKeys } = reconcileOfficeWorldSnapshot(current, createSnapshot(), "initial");

    expect(changedKeys).toEqual(
      expect.arrayContaining([
        "company",
        "teams",
        "employees",
        "desks",
        "officeObjects",
        "officeAreas",
        "officeSettings",
        "companyModel",
        "liveStatus",
        "loading",
      ]),
    );
    expect(next.teamIds).toEqual(["team-main"]);
    expect(next.employeesById["employee-main"]?.name).toBe("Main Agent");
  });

  it("returns the current state for semantically equal polling snapshots", () => {
    const first = reconcileOfficeWorldSnapshot(
      createInitialOfficeWorldData(),
      createSnapshot(),
      "initial",
    ).next;
    const second = reconcileOfficeWorldSnapshot(first, createSnapshot(), "poll");

    expect(second.changedKeys).toEqual([]);
    expect(second.next).toBe(first);
  });

  it("lets the store skip updates for unchanged poll snapshots", () => {
    const store = useOfficeWorldStore.getState();
    expect(store.applySnapshot(createSnapshot(), "initial")).not.toEqual([]);
    const before = useOfficeWorldStore.getState();

    expect(useOfficeWorldStore.getState().applySnapshot(createSnapshot(), "poll")).toEqual([]);
    expect(useOfficeWorldStore.getState().employees).toBe(before.employees);
    expect(useOfficeWorldStore.getState().officeObjects).toBe(before.officeObjects);
  });

  it("reports live status changes independently from structural world data", () => {
    const first = reconcileOfficeWorldSnapshot(
      createInitialOfficeWorldData(),
      createSnapshot(),
      "initial",
    ).next;
    const second = reconcileOfficeWorldSnapshot(
      first,
      {
        ...createSnapshot(),
        liveStatusByAgentId: {
          main: createLiveStatus({ state: "running", statusText: "Running" }),
        },
      },
      "live-status",
    );

    expect(second.changedKeys).toEqual(["liveStatus"]);
    expect(second.next.employees).toBe(first.employees);
  });
});
