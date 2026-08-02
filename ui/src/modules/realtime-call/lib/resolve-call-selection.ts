/**
 * Ownership: pure mapping from office employee selection to a project-scoped agent call.
 * Inputs: employee ids and the live company model. Output: agent ids plus an absolute project path.
 * Invariant: a valid call never spans projects and never guesses a missing tracking context.
 */
import type { CompanyModel } from "@/modules/runtime";
import { isExecutiveSpecialistAgentId } from "@/lib/executive-specialists";

export interface ResolvedCallSelection {
  agentIds: string[];
  projectId: string;
  projectPath: string;
  scope: "office" | "project";
}

export type CallSelectionResult =
  | { ok: true; value: ResolvedCallSelection }
  | { ok: false; error: string };

export function employeeIdToAgentId(employeeId: string): string {
  return employeeId.startsWith("employee-") ? employeeId.slice("employee-".length) : employeeId;
}

export function resolveCallSelection(
  companyModel: CompanyModel | null,
  selectedEmployeeIds: string[],
): CallSelectionResult {
  const agentIds = [...new Set(selectedEmployeeIds.map(employeeIdToAgentId).filter(Boolean))];
  if (agentIds.length === 0)
    return { ok: false, error: "Select at least one teammate to start a call." };

  const specialistCount = agentIds.filter(isExecutiveSpecialistAgentId).length;
  if (specialistCount === agentIds.length) {
    return {
      ok: true,
      value: {
        agentIds,
        projectId: "farplane-office",
        projectPath: "",
        scope: "office",
      },
    };
  }
  if (specialistCount > 0) {
    return {
      ok: false,
      error: "Office specialists and project teammates cannot share one call yet.",
    };
  }
  if (!companyModel) return { ok: false, error: "Company data is still loading." };

  const agentsById = new Map(companyModel.agents.map((agent) => [agent.agentId, agent]));
  const missingAgentId = agentIds.find((agentId) => !agentsById.has(agentId));
  if (missingAgentId) {
    return { ok: false, error: `No company agent matches ${missingAgentId}.` };
  }

  const unassignedAgentId = agentIds.find((agentId) => !agentsById.get(agentId)?.projectId);
  if (unassignedAgentId) {
    return { ok: false, error: `${unassignedAgentId} is not assigned to a project.` };
  }

  const projectIds = new Set(
    agentIds.map((agentId) => agentsById.get(agentId)?.projectId).filter(Boolean),
  );
  if (projectIds.size !== 1) {
    return {
      ok: false,
      error: "Realtime calls can include teammates from one project at a time.",
    };
  }

  const projectId = [...projectIds][0];
  if (!projectId)
    return { ok: false, error: "The selected teammates are not assigned to a project." };
  const project = companyModel.projects.find((candidate) => candidate.id === projectId);
  const projectPath = project?.trackingContext?.trim();
  if (!projectPath || !projectPath.startsWith("/")) {
    return {
      ok: false,
      error: "This project needs an absolute tracking path before calls can start.",
    };
  }

  return { ok: true, value: { agentIds, projectId, projectPath, scope: "project" } };
}
