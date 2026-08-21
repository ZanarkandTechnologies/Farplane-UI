import { describe, expect, it } from "vitest";
import {
  buildFacilityDeveloperInstructions,
  buildFacilityTaskMessage,
  buildFacilityTicketTitle,
} from "./facility-job";
import { resolveTicketSpecialist } from "./specialist-registry";

const leadScout = resolveTicketSpecialist("lead-scout-specialist");

if (!leadScout) throw new Error("lead_scout_fixture_missing");

describe("facility job contract", () => {
  it("turns an operator request into a readable bounded ticket title", () => {
    expect(
      buildFacilityTicketTitle({
        specialist: leadScout,
        request: "Find ten qualified fintech prospects\nfor our outbound test.",
      }),
    ).toBe("Lead Scout: Find ten qualified fintech prospects");
  });

  it("keeps facility instructions tied to the ticket and its one task thread", () => {
    const instructions = buildFacilityDeveloperInstructions({
      specialist: leadScout,
      ticketId: "TASK-0042",
      projectName: "Valefor",
    });

    expect(instructions).toContain("only execution thread for TASK-0042");
    expect(instructions).toContain("lead-scout skill");
    expect(instructions).toContain("Do not create another ticket or task thread");
    expect(
      buildFacilityTaskMessage({
        specialist: leadScout,
        ticketId: "TASK-0042",
        request: "Find ten qualified fintech prospects.",
      }),
    ).toContain("Operator request:");
  });
});
