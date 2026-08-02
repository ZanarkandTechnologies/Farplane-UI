/**
 * Stable Farplane-owned executive specialist identities shared by the office and call modules.
 * These seats are presentation/call personas; they do not imply a continuously running worker
 * or grant financial, hiring, or office-mutation authority.
 */
export const EXECUTIVE_SPECIALISTS = [
  {
    agentId: "farplane-finance",
    role: "finance",
    name: "Ledger",
    title: "Finance Director",
    status: "Watching firm cash, project allocations, and reconciliation.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#2c2725",
      skinColor: "#d7a17a",
      shirtColor: "#37c987",
      pantsColor: "#173d32",
    },
  },
  {
    agentId: "farplane-people",
    role: "people_ops",
    name: "Scout",
    title: "People Operations",
    status: "Maintaining the office talent bench and human hiring briefs.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#1e2028",
      skinColor: "#b97856",
      shirtColor: "#55a7ff",
      pantsColor: "#1f3551",
    },
  },
  {
    agentId: "farplane-office-manager",
    role: "office_manager",
    name: "Steward",
    title: "Office Manager",
    status: "Keeping the office layout useful, legible, and well equipped.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#5b3528",
      skinColor: "#e5b18a",
      shirtColor: "#f2a65a",
      pantsColor: "#54331f",
    },
  },
] as const;

export type ExecutiveSpecialist = (typeof EXECUTIVE_SPECIALISTS)[number];
export type ExecutiveSpecialistAgentId = ExecutiveSpecialist["agentId"];

const EXECUTIVE_SPECIALIST_IDS = new Set<string>(
  EXECUTIVE_SPECIALISTS.map((specialist) => specialist.agentId),
);

export function isExecutiveSpecialistAgentId(value: string): value is ExecutiveSpecialistAgentId {
  return EXECUTIVE_SPECIALIST_IDS.has(value);
}

export function isExecutiveSpecialistEmployeeId(value: string): boolean {
  const agentId = value.startsWith("employee-") ? value.slice("employee-".length) : value;
  return isExecutiveSpecialistAgentId(agentId);
}

export function resolveExecutiveHostTeamId(input: {
  agents: Array<{ agentId: string; role?: string; projectId?: string; isCeo?: boolean }>;
  projectTeamIds: ReadonlyMap<string, string>;
  availableTeamIds: ReadonlySet<string>;
}): string | null {
  const ceo = input.agents.find((agent) => agent.isCeo || agent.role === "ceo");
  if (ceo?.projectId) {
    const projectTeamId = input.projectTeamIds.get(ceo.projectId);
    if (projectTeamId && input.availableTeamIds.has(projectTeamId)) return projectTeamId;
  }
  if (input.availableTeamIds.has("team-management")) return "team-management";
  return input.availableTeamIds.values().next().value ?? null;
}
