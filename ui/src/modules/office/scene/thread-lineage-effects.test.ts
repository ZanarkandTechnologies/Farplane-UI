import { describe, expect, it } from "vitest";
import {
  getOfficeLineageEffectOpacity,
  OFFICE_LINEAGE_FRESHNESS_MS,
  resolveOfficeLineageEndpoints,
  selectFreshUnseenLineageEdges,
} from "./thread-lineage-effects";

describe("office thread lineage effects", () => {
  it("selects only unseen events inside the live freshness window", () => {
    const now = 50_000;
    const result = selectFreshUnseenLineageEdges({
      now,
      seen: new Set(["seen"]),
      edges: [
        { id: "seen", source: "a", target: "b", kind: "created", eventAt: now - 20 },
        { id: "fresh", source: "a", target: "c", kind: "forked", eventAt: now - 20 },
        {
          id: "backfill",
          source: "a",
          target: "d",
          kind: "created",
          eventAt: now - OFFICE_LINEAGE_FRESHNESS_MS - 1,
        },
      ],
    });
    expect(result.map((edge) => edge.id)).toEqual(["fresh"]);
  });

  it("holds for 1.7s then fades during the final 0.5s", () => {
    expect(getOfficeLineageEffectOpacity(500)).toBe(1);
    expect(getOfficeLineageEffectOpacity(1_700)).toBe(1);
    expect(getOfficeLineageEffectOpacity(1_950)).toBeCloseTo(0.5);
    expect(getOfficeLineageEffectOpacity(2_200)).toBe(0);
  });

  it("falls back to a project pulse and projects a missing child toward free commons space", () => {
    const pulse = {
      _id: "employee-project-pulse:alpha",
      teamId: "team-alpha",
      name: "Alpha Pulse",
      team: "Alpha",
      initialPosition: [3, 0, 4] as [number, number, number],
      isBusy: false,
      projectPulse: true,
    };
    const resolved = resolveOfficeLineageEndpoints({
      edge: {
        id: "fork-1",
        source: "missing-parent",
        target: "new-child",
        kind: "forked",
        eventAt: 1,
      },
      employees: [pulse],
    });
    expect(resolved?.source._id).toBe(pulse._id);
    expect(resolved?.targetProjected).toBe(true);
    const projected = resolved?.target.initialPosition;
    expect(projected).toBeDefined();
    expect(Math.hypot(projected![0] - 3, projected![2] - 4)).toBeCloseTo(1.25);
    expect(Math.hypot(projected![0], projected![2])).toBeLessThan(5);
  });

  it("chooses another projection when the commons-facing child position is occupied", () => {
    const pulse = {
      _id: "employee-project-pulse:alpha",
      teamId: "team-alpha",
      name: "Alpha Pulse",
      team: "Alpha",
      initialPosition: [4, 0, 0] as [number, number, number],
      isBusy: false,
      projectPulse: true,
    };
    const blocker = {
      ...pulse,
      _id: "employee-blocker",
      projectPulse: false,
      initialPosition: [2.75, 0, 0] as [number, number, number],
    };
    const resolved = resolveOfficeLineageEndpoints({
      edge: { id: "fork-2", source: "missing", target: "new", kind: "created", eventAt: 1 },
      employees: [pulse, blocker],
    });
    expect(resolved?.target.initialPosition).not.toEqual(blocker.initialPosition);
    expect(Math.hypot(
      resolved!.target.initialPosition[0] - blocker.initialPosition[0],
      resolved!.target.initialPosition[2] - blocker.initialPosition[2],
    )).toBeGreaterThanOrEqual(0.9);
  });
});
