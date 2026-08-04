import { describe, expect, it } from "vitest";
import { getOfficeInternalPanelEntry } from "@/modules/office/panels/internal-panel-catalog";
import { buildSkillExperimentSearchParams } from "./self-improvement-runs-panel";

describe("Self-Improvement Runs panel integration", () => {
  it("is registered as an internal office panel", () => {
    expect(getOfficeInternalPanelEntry("self-improvement-runs").label).toBe(
      "Self-Improvement Runs",
    );
  });

  it("builds the Skill OS experiments deep link without discarding unrelated context", () => {
    const params = buildSkillExperimentSearchParams(new URLSearchParams("project=alpha"), "research");
    expect(params.toString()).toContain("project=alpha");
    expect(params.get("skill")).toBe("research");
    expect(params.get("view")).toBe("experiments");
  });
});
