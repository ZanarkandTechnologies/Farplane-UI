import { describe, expect, it } from "vitest";
import { resolveProjectCouncilPresences } from "./project-council-presence";

describe("project council presence", () => {
  it("uses a project-scoped CEO without allowing the company CEO into a sector", () => {
    expect(
      resolveProjectCouncilPresences({
        projects: [{ id: "acme", name: "Acme" }],
        employees: [
          { _id: "employee-company-ceo", teamId: "team-management", builtInRole: "ceo" },
          { _id: "employee-acme-ceo", teamId: "team-acme", builtInRole: "ceo" },
          { _id: "employee-project-pulse:acme", teamId: "team-acme", projectPulse: true },
        ],
      }),
    ).toEqual([
      {
        projectId: "acme",
        projectName: "Acme",
        employeeId: "employee-acme-ceo",
        source: "project_ceo",
      },
    ]);
  });

  it("falls back deterministically to the existing Project Pulse", () => {
    expect(
      resolveProjectCouncilPresences({
        projects: [{ id: "nova", name: "Nova" }],
        employees: [
          { _id: "employee-project-pulse:nova", teamId: "team-nova", projectPulse: true },
        ],
      }),
    ).toEqual([
      {
        projectId: "nova",
        projectName: "Nova",
        employeeId: "employee-project-pulse:nova",
        source: "project_pulse",
      },
    ]);
  });
});
