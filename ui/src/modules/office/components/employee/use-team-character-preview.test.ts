import { describe, expect, it } from "vitest";
import {
  getTeamCharacterPreviewForEmployee,
  type TeamCharacterPreviewDetail,
} from "./use-team-character-preview";

const preview: TeamCharacterPreviewDetail = {
  eventId: "preview-1",
  startedAt: 1,
  teamId: "team-a",
  targetEmployeeId: "employee-a",
  skillId: "research",
};

describe("getTeamCharacterPreviewForEmployee", () => {
  it("selects only the targeted persistent employee on the matching team", () => {
    expect(
      getTeamCharacterPreviewForEmployee(preview, {
        employeeId: "employee-a",
        teamId: "team-a",
        presencePersistent: true,
      }),
    ).toBe(preview);
    expect(
      getTeamCharacterPreviewForEmployee(preview, {
        employeeId: "employee-b",
        teamId: "team-a",
        presencePersistent: true,
      }),
    ).toBeUndefined();
    expect(
      getTeamCharacterPreviewForEmployee(preview, {
        employeeId: "employee-a",
        teamId: "team-a",
        presencePersistent: false,
      }),
    ).toBeUndefined();
  });
});
