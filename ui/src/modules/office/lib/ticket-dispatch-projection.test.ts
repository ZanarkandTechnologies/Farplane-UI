import { describe, expect, it } from "vitest";
import { TICKET_SPECIALIST_REGISTRY } from "@/lib/ticket-routing/specialist-registry";
import { buildProjectCouncilLayout } from "./project-council-layout";
import { projectTicketDispatches } from "./ticket-dispatch-projection";

const layout = buildProjectCouncilLayout(["acme", "nova"], TICKET_SPECIALIST_REGISTRY);
const councilLeads = [
  {
    projectId: "acme",
    employeeId: "employee-project-pulse:acme",
    position: [0, 0, 1] as [number, number, number],
  },
  {
    projectId: "nova",
    employeeId: "employee-project-pulse:nova",
    position: [0, 0, -1] as [number, number, number],
  },
];

describe("ticket dispatch projection", () => {
  it("creates one bounded clone/link effect for every qualifying specialist ticket", () => {
    const dispatches = projectTicketDispatches({
      layout,
      councilLeads,
      activities: [
        {
          id: "production:acme:TASK-1",
          roomId: "production",
          projectId: "acme",
          projectLabel: "Acme",
          skillId: "landing-page",
          state: "active",
          startedAt: 1,
          updatedAt: 1,
          source: "ticket",
          ticketId: "TASK-1",
          ticketTitle: "Launch page",
          specialistId: "landing-page-specialist",
        },
      ],
    });

    expect(dispatches).toEqual([
      expect.objectContaining({
        projectId: "acme",
        employeeId: "employee-project-pulse:acme",
        specialistId: "landing-page-specialist",
        sourceHead: [0, 1.28, 1],
        label: "Launch page",
        callerTarget: { kind: "project", projectId: "acme" },
      }),
    ]);
  });

  it("fans concurrent projects around one fixed specialist station", () => {
    const activities = ["acme", "nova"].map((projectId, index) => ({
      id: `production:${projectId}:TASK-${index}`,
      roomId: "production",
      projectId,
      projectLabel: projectId,
      skillId: "landing-page",
      state: "active" as const,
      startedAt: 1,
      updatedAt: 1,
      source: "ticket" as const,
      specialistId: "landing-page-specialist",
    }));
    const dispatches = projectTicketDispatches({ activities, councilLeads, layout });

    expect(dispatches).toHaveLength(2);
    expect(dispatches[0]?.destination).not.toEqual(dispatches[1]?.destination);
  });

  it("does not invent work from telemetry, unknown specialists, or missing Council Leads", () => {
    expect(
      projectTicketDispatches({
        layout,
        councilLeads: councilLeads.slice(0, 1),
        activities: [
          {
            id: "telemetry:acme",
            roomId: "production",
            projectId: "acme",
            projectLabel: "Acme",
            skillId: "landing-page",
            state: "active",
            startedAt: 1,
            updatedAt: 1,
            source: "telemetry",
          },
          {
            id: "unknown:nova",
            roomId: "production",
            projectId: "nova",
            projectLabel: "Nova",
            skillId: "landing-page",
            state: "active",
            startedAt: 1,
            updatedAt: 1,
            source: "ticket",
            specialistId: "unknown-specialist",
          },
        ],
      }),
    ).toEqual([]);
  });
});
