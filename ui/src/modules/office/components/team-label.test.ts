import { describe, expect, it } from "vitest";
import { shouldShowTeamLabel } from "./team-label";

describe("team table signage", () => {
  it("keeps project labels visible in command-office neighborhoods", () => {
    expect(shouldShowTeamLabel("Farplane UI")).toBe(true);
  });

  it("keeps non-project executive clusters out of the project label layer", () => {
    expect(shouldShowTeamLabel("Management")).toBe(false);
    expect(shouldShowTeamLabel("CEO")).toBe(false);
  });
});
