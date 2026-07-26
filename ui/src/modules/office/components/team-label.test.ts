import { describe, expect, it } from "vitest";
import {
  COMMAND_TEAM_LABEL_DISTANCE_FACTOR,
  TEAM_LABEL_DISTANCE_FACTOR,
  getTeamLabelDistanceFactor,
  shouldShowTeamLabel,
} from "./team-label";

describe("team table signage", () => {
  it("keeps project labels visible in command-office neighborhoods", () => {
    expect(shouldShowTeamLabel("Farplane UI")).toBe(true);
  });

  it("keeps non-project executive clusters out of the project label layer", () => {
    expect(shouldShowTeamLabel("Management")).toBe(false);
    expect(shouldShowTeamLabel("CEO")).toBe(false);
  });

  it("uses explicit scene-space size factors for team signage", () => {
    expect(getTeamLabelDistanceFactor(false)).toBe(TEAM_LABEL_DISTANCE_FACTOR);
    expect(getTeamLabelDistanceFactor(true)).toBe(COMMAND_TEAM_LABEL_DISTANCE_FACTOR);
    expect(COMMAND_TEAM_LABEL_DISTANCE_FACTOR).toBeGreaterThan(0);
    expect(TEAM_LABEL_DISTANCE_FACTOR).toBeGreaterThan(0);
  });
});
