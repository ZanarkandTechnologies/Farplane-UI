/**
 * OFFICE SCENE DERIVED DATA
 * =========================
 * Pure scene data shaping for desks, teams, CEO placement, and employee status overlays.
 *
 * KEY CONCEPTS:
 * - Deterministic helpers keep scene behavior stable across re-renders.
 * - Scene bootstrap and rendering consume pre-shaped data instead of repeating lookups inline.
 *
 * USAGE:
 * - Call `useOfficeSceneDerivedData` from scene composition components.
 * - Use exported pure helpers in focused unit tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import { useMemo } from "react";
import type { AgentLiveStatus } from "@/modules/runtime";
import { deriveEmployeeActivity } from "@/providers/office-employee-activity";
import { buildIdleInteractionTargets } from "../idle-interactions";
import type { DeskLayoutData, EmployeeData, OfficeObject, TeamData } from "../lib/types";
import { parseOfficeObjectInteractionConfig } from "../office-object-ui";
import { buildSkillEffectSeed, resolveSkillEffectVariant } from "../skill-effects";
import {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPositionForOccupant,
} from "../skill-targeting";
import { getAbsoluteDeskPosition, getDeskPosition, getDeskRotation } from "../utils/layout";
import {
  assignRandomStatuses,
  buildDesksByTeamId,
  buildTeamWanderLocks,
  hasEmployeeActiveThread,
} from "./derived-data-utils";
import type { OfficeSceneViewSettings } from "./view-profile";
import { getOfficePresentationRotationY } from "./view-profile";

export type OfficeSceneDerivedData = {
  ceoDeskData:
    | (DeskLayoutData & {
        anchorPosition: [number, number, number];
        localPosition: [number, number, number];
        position: [number, number, number];
        rotationY: number;
      })
    | null;
  employeesForScene: Array<EmployeeData & { position: [number, number, number] }>;
  teamById: Map<string, TeamData>;
  desksByTeamId: Map<string, DeskLayoutData[]>;
  teamWanderLocks: Map<string, number | undefined>;
};

export { assignRandomStatuses, buildDesksByTeamId, buildTeamWanderLocks, hasEmployeeActiveThread };

function agentIdFromEmployeeId(employeeId: string): string {
  return employeeId.startsWith("employee-") ? employeeId.slice("employee-".length) : employeeId;
}

export function applyLiveStatusToSceneEmployees(input: {
  employees: Array<EmployeeData & { position?: [number, number, number] }>;
  liveStatusByAgentId: Record<string, AgentLiveStatus>;
  officeObjects: OfficeObject[];
}): Array<EmployeeData & { position?: [number, number, number] }> {
  const skillTargetObjects = buildSkillTargetObjectMap(input.officeObjects);
  const idleInteractionTargets = buildIdleInteractionTargets(input.officeObjects);
  const skillOccupants = new Map<string, string[]>();
  for (const employee of input.employees) {
    const agentId = agentIdFromEmployeeId(employee._id);
    const skillId = input.liveStatusByAgentId[agentId]?.currentSkillId?.trim();
    if (!skillId) continue;
    const occupants = skillOccupants.get(skillId) ?? [];
    occupants.push(agentId);
    skillOccupants.set(skillId, occupants);
  }

  return input.employees.map((employee) => {
    const agentId = agentIdFromEmployeeId(employee._id);
    const liveStatus = input.liveStatusByAgentId[agentId];
    const canUseIdleInteractions =
      !employee.isCEO &&
      !hasEmployeeActiveThread({
        heartbeatState: liveStatus?.state ?? employee.heartbeatState,
        isBusy: employee.isBusy,
      });
    const nextIdleInteractionTargets =
      canUseIdleInteractions && idleInteractionTargets.length > 0
        ? idleInteractionTargets
        : undefined;
    if (!liveStatus) {
      return {
        ...employee,
        idleInteractionTargets: nextIdleInteractionTargets,
      };
    }
    const activeSkillId = liveStatus.currentSkillId?.trim();
    const skillOccupantIds = activeSkillId ? (skillOccupants.get(activeSkillId) ?? []) : [];
    const skillOccupantIndex =
      activeSkillId && skillOccupantIds.length > 0 ? skillOccupantIds.indexOf(agentId) : -1;
    const skillTargetObject = activeSkillId ? skillTargetObjects.get(activeSkillId) : undefined;
    const activity = deriveEmployeeActivity(liveStatus);
    const hasActiveThread = hasEmployeeActiveThread({
      heartbeatState: liveStatus.state,
      isBusy: employee.isBusy,
    });
    const activityEffectVariant =
      activeSkillId && skillTargetObject
        ? resolveSkillEffectVariant(
            parseOfficeObjectInteractionConfig(skillTargetObject.metadata).skillBinding ??
              undefined,
            buildSkillEffectSeed({
              agentId,
              skillId: activeSkillId,
              sessionKey: liveStatus.sessionKey,
            }),
          )
        : undefined;

    return {
      ...employee,
      activityTargetPosition:
        skillTargetObject && skillOccupantIndex >= 0
          ? getOfficeSkillAnchorPositionForOccupant(
              skillTargetObject,
              skillOccupantIndex,
              skillOccupantIds.length,
            )
          : undefined,
      activityTargetObjectPosition: skillTargetObject?.position,
      activityTargetSkillId: activeSkillId,
      activityEffectVariant,
      statusMessage: liveStatus.statusText ?? employee.statusMessage,
      wantsToWander: hasActiveThread ? false : employee.wantsToWander,
      activityState: activity.state,
      activityLabel: activity.label,
      activityDetail: activity.detail,
      activityUpdatedAt: liveStatus.updatedAt,
      bubbleMessages: liveStatus.bubbleMessages,
      heartbeatState: liveStatus.state,
      heartbeatBubbles:
        liveStatus.bubbles?.map((bubble) => ({
          label: bubble.label,
          weight: bubble.weight,
        })) ?? [],
      idleInteractionTargets: nextIdleInteractionTargets,
    };
  });
}

export function buildCeoDeskData(params: {
  teams: TeamData[];
  desks: DeskLayoutData[];
  officeViewSettings: OfficeSceneViewSettings;
}): OfficeSceneDerivedData["ceoDeskData"] {
  const { teams, desks, officeViewSettings } = params;
  const ceoDesk = desks.find(
    (desk) => desk.id.startsWith("desk-team-management-") || desk.id === "ceo-desk",
  );
  if (!ceoDesk) return null;

  const managementTeam = teams.find((team) => team.name === "Management");
  if (!managementTeam?.clusterPosition) return null;

  const managementDesks = desks.filter((desk) => desk.id.startsWith("desk-team-management-"));
  const clusterPosition = managementTeam.clusterPosition;
  const localPosition = getDeskPosition([0, 0, 0], ceoDesk.deskIndex, managementDesks.length);

  return {
    ...ceoDesk,
    anchorPosition: clusterPosition,
    localPosition,
    position: getAbsoluteDeskPosition(clusterPosition, ceoDesk.deskIndex, managementDesks.length),
    rotationY:
      officeViewSettings.viewProfile === "fixed_2_5d"
        ? getOfficePresentationRotationY(officeViewSettings.cameraOrientation)
        : getDeskRotation(ceoDesk.deskIndex, managementDesks.length),
  };
}

export function useOfficeSceneDerivedData(params: {
  teams: TeamData[];
  employees: EmployeeData[];
  desks: DeskLayoutData[];
  officeViewSettings: OfficeSceneViewSettings;
}): OfficeSceneDerivedData {
  const { teams, employees, desks, officeViewSettings } = params;

  const ceoDeskData = useMemo(
    () => buildCeoDeskData({ teams, desks, officeViewSettings }),
    [desks, officeViewSettings, teams],
  );

  const teamById = useMemo(() => new Map(teams.map((team) => [team._id, team])), [teams]);
  const desksByTeamId = useMemo(() => buildDesksByTeamId(desks), [desks]);
  const teamWanderLocks = useMemo(() => buildTeamWanderLocks(teams), [teams]);

  const employeesForScene = useMemo(() => {
    return assignRandomStatuses(employees, teamWanderLocks).map((employee) => ({
      ...employee,
      position: employee.initialPosition,
    }));
  }, [employees, teamWanderLocks]);

  return {
    ceoDeskData,
    employeesForScene,
    teamById,
    desksByTeamId,
    teamWanderLocks,
  };
}
