/**
 * Synthetic team skill activity projection used by the Team Panel demo action.
 *
 * Inputs: one transient demo event, scene employees, and skill-bound office objects.
 * Outputs: an employee projection that uses the normal traversal/activity fields.
 * Side effects: none; the event never enters runtime telemetry or persisted agent state.
 */

import { resolveActivityScenePresentation } from "./activity-scenes";
import type { TeamCharacterPreviewDetail } from "./components/employee/use-team-character-preview";
import type { EmployeeData, OfficeObject } from "./lib/types";
import { buildSkillTargetObjectMap, getOfficeSkillAnchorPosition } from "./skill-targeting";

export function applySyntheticSkillDemo(input: {
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  demo?: TeamCharacterPreviewDetail;
}): EmployeeData[] {
  const { demo } = input;
  if (!demo?.targetEmployeeId) return input.employees;
  const destinationSkillId = demo.destinationSkillId?.trim() || demo.skillId.trim();
  const targetObject = buildSkillTargetObjectMap(input.officeObjects).get(destinationSkillId);
  return input.employees.map((employee) => {
    if (String(employee._id) !== demo.targetEmployeeId) return employee;
    return {
      ...employee,
      activityTargetPosition: targetObject
        ? getOfficeSkillAnchorPosition(targetObject)
        : employee.initialPosition,
      activityTargetObjectPosition: targetObject?.position,
      activityTargetSkillId: demo.skillId.trim(),
      activityEffectVariant: demo.activityEffectVariant,
      activityScenePresentation:
        targetObject?.meshType === "activity-landmark"
          ? resolveActivityScenePresentation(targetObject.metadata)
          : undefined,
      activityState: "running",
      activityLabel: `Demo · ${demo.skillId.trim()}`,
      activityDetail:
        destinationSkillId === demo.skillId.trim()
          ? "Synthetic skill invocation"
          : `Synthetic skill invocation · destination ${destinationSkillId}`,
      activityUpdatedAt: demo.startedAt,
      wantsToWander: false,
    };
  });
}
