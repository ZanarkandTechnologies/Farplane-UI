import { describe, expect, it } from "vitest";
import type { EmployeeData, OfficeObject } from "./lib/types";
import { applySyntheticSkillDemo } from "./synthetic-skill-demo";

describe("applySyntheticSkillDemo", () => {
  it("projects a synthetic skill event onto only the selected team lead at its chosen destination", () => {
    const employees = [
      {
        _id: "employee-lead",
        teamId: "team-a",
        name: "Lead",
        team: "A",
        initialPosition: [0, 0, 0],
        isBusy: false,
      },
      {
        _id: "employee-worker",
        teamId: "team-a",
        name: "Worker",
        team: "A",
        initialPosition: [1, 0, 0],
        isBusy: false,
      },
    ] as EmployeeData[];
    const officeObjects = [
      {
        _id: "library",
        meshType: "activity-landmark",
        position: [8, 0, 4],
        rotation: [0, 0, 0],
        metadata: { landmarkKind: "library", skillBinding: { skillId: "research" } },
      },
      {
        _id: "qa-arcade",
        meshType: "activity-landmark",
        position: [3, 0, -4],
        rotation: [0, 0, 0],
        metadata: { landmarkKind: "qa-arcade", skillBinding: { skillId: "qa" } },
      },
    ] as OfficeObject[];

    const result = applySyntheticSkillDemo({
      employees,
      officeObjects,
      demo: {
        eventId: "demo-1",
        startedAt: 100,
        teamId: "team-a",
        targetEmployeeId: "employee-lead",
        skillId: "research",
        destinationSkillId: "qa",
      },
    });

    expect(result[0]).toMatchObject({
      activityTargetPosition: [3, 0, -2.85],
      activityTargetSkillId: "research",
      activityState: "running",
      activityScenePresentation: expect.objectContaining({ sceneKey: "operate-arcade" }),
      activityLabel: "Demo · research",
      activityDetail: "Synthetic skill invocation · destination qa",
    });
    expect(result[0]?.activityEffectVariant).toBeUndefined();
    expect(result[1]).toBe(employees[1]);
  });
});
