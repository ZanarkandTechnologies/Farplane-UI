import { describe, expect, it } from "vitest";

import type { AgentLiveStatus } from "@/modules/runtime";
import type { DeskLayoutData, EmployeeData, OfficeObject } from "../lib/types";
import { assignRandomStatuses, buildDesksByTeamId } from "./derived-data-utils";
import { applyLiveStatusToSceneEmployees, buildCeoDeskData } from "./use-office-scene-derived-data";
import { getOfficePresentationRotationY } from "./view-profile";

function createEmployeeData(overrides: Partial<EmployeeData> = {}): EmployeeData {
  return {
    _id: "emp-1",
    teamId: "team-a",
    name: "Ada",
    initialPosition: [1, 0, 2],
    isBusy: false,
    team: "Alpha",
    ...overrides,
  };
}

describe("office scene derived data", () => {
  it("keeps deterministic status assignment stable across calls", () => {
    const employees = [
      createEmployeeData({
        heartbeatState: "idle",
        statusMessage: undefined,
      }),
    ];

    const locks = new Map<string, number | undefined>([["team-a", undefined]]);
    const first = assignRandomStatuses([...employees], locks);
    const second = assignRandomStatuses([...employees], locks);

    expect(first).toEqual(second);
  });

  it("forces CEO employees to stay put with info status", () => {
    const employees = [
      createEmployeeData({
        _id: "ceo-1",
        teamId: "team-management",
        name: "CEO",
        builtInRole: "ceo",
        initialPosition: [0, 0, 0],
        team: "Management",
      }),
    ];

    const result = assignRandomStatuses([...employees], new Map());

    expect(result[0]?.status).toBe("info");
    expect(result[0]?.wantsToWander).toBe(false);
    expect(result[0]?.statusMessage).toBe("Managing the team");
  });

  it("preserves explicit desk-bound employees during status assignment", () => {
    const employees = [
      createEmployeeData({
        _id: "emp-round-table",
        teamId: "team-round",
        name: "Round Table Agent",
        team: "Round",
        wantsToWander: false,
      }),
    ];

    const result = assignRandomStatuses([...employees], new Map());

    expect(result[0]?.wantsToWander).toBe(false);
  });

  it("pins active employees to their desks during status assignment", () => {
    const employees = [
      createEmployeeData({
        _id: "emp-running",
        heartbeatState: "running",
        wantsToWander: true,
      }),
    ];

    const result = assignRandomStatuses([...employees], new Map());

    expect(result[0]?.wantsToWander).toBe(false);
  });

  it("indexes desks by team id from persisted desk ids", () => {
    const desks: DeskLayoutData[] = [
      { id: "desk-team-alpha-0", deskIndex: 0, team: "Alpha" },
      { id: "desk-team-alpha-1", deskIndex: 1, team: "Alpha" },
      { id: "desk-team-beta-0", deskIndex: 0, team: "Beta" },
      { id: "ceo-desk", deskIndex: 0, team: "Management" },
    ];

    const desksByTeamId = buildDesksByTeamId([...desks]);

    expect(desksByTeamId.get("team-alpha")?.map((desk) => desk.id)).toEqual([
      "desk-team-alpha-0",
      "desk-team-alpha-1",
    ]);
    expect(desksByTeamId.get("team-beta")?.map((desk) => desk.id)).toEqual(["desk-team-beta-0"]);
  });

  it("resolves deterministic presentation yaw for fixed 2.5D orientations", () => {
    expect(getOfficePresentationRotationY("south_east")).toBeCloseTo(Math.PI / 4);
    expect(getOfficePresentationRotationY("north_west")).toBeCloseTo((-3 * Math.PI) / 4);
  });

  it("keeps CEO desk placement derived from the management anchor", () => {
    const ceoDeskData = buildCeoDeskData({
      teams: [
        {
          _id: "team-management",
          name: "Management",
          description: "Executive team",
          clusterPosition: [12, 0, -6],
          employees: [],
        },
      ],
      desks: [{ id: "desk-team-management-0", deskIndex: 0, team: "Management" }],
      officeViewSettings: {
        viewProfile: "free_orbit_3d",
        orbitControlsEnabled: true,
        cameraOrientation: "south_east",
      },
    });

    expect(ceoDeskData?.anchorPosition).toEqual([12, 0, -6]);
    expect(ceoDeskData?.position).toEqual([12, 0, -6]);
    expect(ceoDeskData?.localPosition).toEqual([0, 0, 0]);
  });

  it("overlays live status presentation without changing structural employee data", () => {
    const employee = createEmployeeData({
      _id: "employee-agent-1",
      statusMessage: "Old status",
      activityState: "idle",
    });
    const monitor: OfficeObject = {
      _id: "monitor-1",
      meshType: "custom-mesh",
      position: [6, 0, 7],
      rotation: [0, 0, 0],
      metadata: {
        skillBinding: {
          skillId: "openai-docs",
          effectVariant: "blink",
        },
      },
    };
    const liveStatus: AgentLiveStatus = {
      agentId: "agent-1",
      state: "running",
      statusText: "Calling openai-docs",
      currentSkillId: "openai-docs",
      sessionKey: "session-1",
      updatedAt: 1770000000000,
      bubbles: [{ id: "bubble-1", label: "Working", weight: 80 }],
      bubbleMessages: [
        {
          threadId: "thread-1",
          message: "Calling openai-docs",
          eventAt: 1770000000000,
        },
      ],
    };

    const [presented] = applyLiveStatusToSceneEmployees({
      employees: [employee],
      liveStatusByAgentId: { "agent-1": liveStatus },
      officeObjects: [monitor],
    });

    expect(presented).not.toBe(employee);
    expect(employee.statusMessage).toBe("Old status");
    expect(presented?.initialPosition).toBe(employee.initialPosition);
    expect(presented?.statusMessage).toBe("Calling openai-docs");
    expect(presented?.activityState).toBe("running");
    expect(presented?.activityTargetSkillId).toBe("openai-docs");
    expect(presented?.activityTargetObjectPosition).toEqual([6, 0, 7]);
    expect(presented?.activityEffectVariant).toBe("blink");
    expect(presented?.wantsToWander).toBe(false);
    expect(presented?.heartbeatBubbles).toEqual([{ label: "Working", weight: 80 }]);
    expect(presented?.bubbleMessages).toEqual(liveStatus.bubbleMessages);
  });

  it("attaches idle interaction targets only when employees have no active thread", () => {
    const employee = createEmployeeData({
      _id: "employee-agent-1",
      wantsToWander: false,
      heartbeatState: "idle",
    });
    const shelf: OfficeObject = {
      _id: "object-shelf",
      meshType: "bookshelf",
      position: [4, 0, 5],
      rotation: [0, 0, 0],
      metadata: {
        displayName: "Research Shelf",
        idleInteraction: {
          phrases: ["Checking docs"],
        },
      },
    };

    const [idlePresented] = applyLiveStatusToSceneEmployees({
      employees: [employee],
      liveStatusByAgentId: {},
      officeObjects: [shelf],
    });
    const [activePresented] = applyLiveStatusToSceneEmployees({
      employees: [employee],
      liveStatusByAgentId: {
        "agent-1": {
          agentId: "agent-1",
          state: "executing",
          statusText: "Working",
          bubbles: [],
          updatedAt: 1770000000000,
        },
      },
      officeObjects: [shelf],
    });

    expect(idlePresented?.idleInteractionTargets).toEqual([
      expect.objectContaining({
        objectId: "object-shelf",
        label: "Research Shelf",
        phrases: ["Checking docs"],
      }),
    ]);
    expect(activePresented?.idleInteractionTargets).toBeUndefined();
  });
});
