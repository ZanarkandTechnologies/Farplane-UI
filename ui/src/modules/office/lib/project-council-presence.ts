/** Resolves exactly one project-scoped Council Lead without creating a new employee identity. */

export type ProjectCouncilProject = { id: string; name: string };

export type ProjectCouncilEmployeeCandidate = {
  _id: string;
  teamId?: string;
  builtInRole?: string | null;
  projectPulse?: boolean;
};

export type ProjectCouncilPresence = {
  projectId: string;
  projectName: string;
  employeeId: string;
  source: "project_ceo" | "project_pulse";
};

function compareEmployeeId(
  left: ProjectCouncilEmployeeCandidate,
  right: ProjectCouncilEmployeeCandidate,
): number {
  return left._id.localeCompare(right._id);
}

/**
 * Prefers an existing CEO scoped to the project team. The company CEO is never
 * a sector candidate; Project Pulse is the stable, derived fallback.
 */
export function resolveProjectCouncilPresences(input: {
  projects: readonly ProjectCouncilProject[];
  employees: readonly ProjectCouncilEmployeeCandidate[];
}): ProjectCouncilPresence[] {
  return [...input.projects]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((project) => {
      const projectTeamId = `team-${project.id}`;
      const projectCeo = input.employees
        .filter(
          (employee) =>
            employee.builtInRole === "ceo" && String(employee.teamId ?? "") === projectTeamId,
        )
        .sort(compareEmployeeId)[0];
      if (projectCeo) {
        return [
          {
            projectId: project.id,
            projectName: project.name,
            employeeId: projectCeo._id,
            source: "project_ceo" as const,
          },
        ];
      }
      const projectPulse = input.employees.find(
        (employee) =>
          employee._id === `employee-project-pulse:${project.id}` ||
          (employee.projectPulse === true && String(employee.teamId ?? "") === projectTeamId),
      );
      return projectPulse
        ? [
            {
              projectId: project.id,
              projectName: project.name,
              employeeId: projectPulse._id,
              source: "project_pulse" as const,
            },
          ]
        : [];
    });
}
