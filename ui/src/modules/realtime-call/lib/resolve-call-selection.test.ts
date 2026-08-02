import { describe, expect, it } from "vitest";
import type { CompanyModel } from "@/modules/runtime";
import { employeeIdToAgentId, resolveCallSelection } from "./resolve-call-selection";

const company = {
  agents: [
    { agentId: "alpha", projectId: "project-a" },
    { agentId: "beta", projectId: "project-a" },
    { agentId: "gamma", projectId: "project-b" },
  ],
  projects: [
    { id: "project-a", trackingContext: "/workspace/a" },
    { id: "project-b", trackingContext: "/workspace/b" },
  ],
} as CompanyModel;

describe("resolveCallSelection", () => {
  it("strips only the employee prefix and resolves one project path", () => {
    expect(employeeIdToAgentId("employee-alpha")).toBe("alpha");
    expect(resolveCallSelection(company, ["employee-alpha", "employee-beta"])).toEqual({
      ok: true,
      value: {
        agentIds: ["alpha", "beta"],
        projectId: "project-a",
        projectPath: "/workspace/a",
        scope: "project",
      },
    });
  });

  it("rejects mixed-project calls", () => {
    expect(resolveCallSelection(company, ["employee-alpha", "employee-gamma"])).toEqual({
      ok: false,
      error: "Realtime calls can include teammates from one project at a time.",
    });
  });

  it("rejects missing agents and non-absolute tracking paths", () => {
    expect(resolveCallSelection(company, ["employee-missing"])).toEqual({
      ok: false,
      error: "No company agent matches missing.",
    });
    const relative = {
      ...company,
      projects: [
        { ...(company.projects[0] as object), id: "project-a", trackingContext: "relative/a" },
      ],
    } as CompanyModel;
    expect(resolveCallSelection(relative, ["employee-alpha"])).toEqual({
      ok: false,
      error: "This project needs an absolute tracking path before calls can start.",
    });
  });

  it("rejects an unassigned teammate even when another selection has a project", () => {
    const withUnassigned = {
      ...company,
      agents: [...company.agents, { agentId: "delta", projectId: undefined }],
    } as CompanyModel;
    expect(resolveCallSelection(withUnassigned, ["employee-alpha", "employee-delta"])).toEqual({
      ok: false,
      error: "delta is not assigned to a project.",
    });
  });

  it("resolves the persistent executive specialists without a company model", () => {
    expect(
      resolveCallSelection(null, ["employee-farplane-finance", "employee-farplane-people"]),
    ).toEqual({
      ok: true,
      value: {
        agentIds: ["farplane-finance", "farplane-people"],
        projectId: "farplane-office",
        projectPath: "",
        scope: "office",
      },
    });
  });

  it("rejects mixing an office specialist with a project teammate", () => {
    expect(resolveCallSelection(company, ["employee-farplane-finance", "employee-alpha"])).toEqual({
      ok: false,
      error: "Office specialists and project teammates cannot share one call yet.",
    });
  });
});
