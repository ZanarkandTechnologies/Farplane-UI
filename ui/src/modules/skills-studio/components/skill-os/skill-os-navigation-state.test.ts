import { describe, expect, it } from "vitest";
import { resolveSkillStudioSurface } from "./skill-os-navigation-state";

describe("Skill OS page-level navigation", () => {
  it("opens capability map by default", () => {
    expect(resolveSkillStudioSurface({ initialFilter: "all", surface: null })).toBe("capabilities");
  });

  it("keeps the maintenance route in Skill Library", () => {
    expect(resolveSkillStudioSurface({ initialFilter: "needs-care", surface: null })).toBe(
      "library",
    );
  });

  it("lets an explicit user choice override an entry-point filter", () => {
    expect(
      resolveSkillStudioSurface({
        initialFilter: "needs-care",
        surface: "capabilities",
      }),
    ).toBe("capabilities");
  });
});
