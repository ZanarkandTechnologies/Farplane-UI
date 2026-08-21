/**
 * Stable Farplane-owned studio-host identities shared by the office and call modules.
 * These are facility presentation anchors, not Project PMs, capability profiles, or
 * continuously running workers. They do not grant financial, hiring, or office-mutation
 * authority.
 */
export const EXECUTIVE_SPECIALISTS = [
  {
    agentId: "farplane-improvement",
    role: "improvement_lead",
    name: "Refine",
    title: "Improvement Lead",
    status: "Tracking self-improvement runs and verified behavior gains.",
    appearance: {
      clothesStyle: "techBro" as const,
      hairColor: "#49372f",
      skinColor: "#d9a27e",
      shirtColor: "#0ea5e9",
      pantsColor: "#21384b",
    },
  },
  {
    agentId: "farplane-research",
    role: "research_lead",
    name: "Research",
    title: "Research Studio",
    status: "Grounding decisions in evidence and maintained sources.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#3d2c25",
      skinColor: "#c98b68",
      shirtColor: "#b58a52",
      pantsColor: "#44382f",
    },
  },
  {
    agentId: "farplane-production",
    role: "creative_producer",
    name: "Frame",
    title: "Creative Producer",
    status: "Turning approved ideas into clear production-ready outputs.",
    appearance: {
      clothesStyle: "dj" as const,
      hairColor: "#25242d",
      skinColor: "#b97856",
      shirtColor: "#a78bfa",
      pantsColor: "#302944",
    },
  },
  {
    agentId: "farplane-qa",
    role: "qa_lead",
    name: "Proof",
    title: "QA Lead",
    status: "Testing critical paths and keeping completion claims honest.",
    appearance: {
      clothesStyle: "techBro" as const,
      hairColor: "#222d32",
      skinColor: "#d7a17a",
      shirtColor: "#22d3ee",
      pantsColor: "#173f46",
    },
  },
  {
    agentId: "farplane-harness",
    role: "harness_advisor",
    name: "Rig",
    title: "Harness Advisor",
    status: "Shaping reliable agent harnesses and measurable operating loops.",
    appearance: {
      clothesStyle: "techBro" as const,
      hairColor: "#50372a",
      skinColor: "#e2ad86",
      shirtColor: "#f59e0b",
      pantsColor: "#4a341b",
    },
  },
  {
    agentId: "farplane-skills",
    role: "skills_architect",
    name: "Glyph",
    title: "Skills Architect",
    status: "Designing reusable skills and keeping their contracts maintainable.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#2b2925",
      skinColor: "#a96e4d",
      shirtColor: "#34d399",
      pantsColor: "#1e493d",
    },
  },
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
  {
    agentId: "farplane-comms",
    role: "communications_lead",
    name: "Relay",
    title: "Communications Lead",
    status: "Keeping operator communications clear, timely, and correctly routed.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#382b28",
      skinColor: "#d19a76",
      shirtColor: "#38bdf8",
      pantsColor: "#21465a",
    },
  },
  {
    agentId: "farplane-usage",
    role: "usage_analyst",
    name: "Gauge",
    title: "Usage Analyst",
    status: "Watching agent-hour usage and operational telemetry signals.",
    appearance: {
      clothesStyle: "techBro" as const,
      hairColor: "#262b2d",
      skinColor: "#bc805d",
      shirtColor: "#4ade80",
      pantsColor: "#214330",
    },
  },
  {
    agentId: "farplane-mining",
    role: "mining_analyst",
    name: "Vein",
    title: "Mining Analyst",
    status: "Extracting structured evidence from task and thread history.",
    appearance: {
      clothesStyle: "professional" as const,
      hairColor: "#342a39",
      skinColor: "#e0aa83",
      shirtColor: "#c084fc",
      pantsColor: "#432d55",
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

export function getExecutiveSpecialist(agentId: string): ExecutiveSpecialist | undefined {
  return EXECUTIVE_SPECIALISTS.find((specialist) => specialist.agentId === agentId);
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
