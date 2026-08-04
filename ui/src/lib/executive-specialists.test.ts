import { describe, expect, it } from "vitest";
import {
  EXECUTIVE_SPECIALISTS,
  isExecutiveSpecialistEmployeeId,
  resolveExecutiveHostTeamId,
} from "./executive-specialists";

describe("executive specialists", () => {
  it("keeps the eleven room hosts plus the non-spatial Steward identity stable", () => {
    expect(EXECUTIVE_SPECIALISTS.map((specialist) => specialist.agentId)).toEqual([
      "farplane-improvement",
      "farplane-research",
      "farplane-production",
      "farplane-qa",
      "farplane-harness",
      "farplane-skills",
      "farplane-finance",
      "farplane-people",
      "farplane-office-manager",
      "farplane-comms",
      "farplane-usage",
      "farplane-mining",
    ]);
    expect(isExecutiveSpecialistEmployeeId("employee-farplane-finance")).toBe(true);
  });

  it("follows a project-assigned CEO and otherwise uses management", () => {
    const projectTeamIds = new Map([["project-a", "team-project-a"]]);
    expect(
      resolveExecutiveHostTeamId({
        agents: [{ agentId: "ceo", role: "ceo", projectId: "project-a" }],
        projectTeamIds,
        availableTeamIds: new Set(["team-management", "team-project-a"]),
      }),
    ).toBe("team-project-a");
    expect(
      resolveExecutiveHostTeamId({
        agents: [{ agentId: "main", role: "ceo" }],
        projectTeamIds,
        availableTeamIds: new Set(["team-management", "team-project-a"]),
      }),
    ).toBe("team-management");
  });
});
