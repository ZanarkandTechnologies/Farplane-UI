import { describe, expect, it, vi } from "vitest";
import { loadLeverageProjection } from "./use-leverage-projection";
import type { LeverageProjection } from "../lib/leverage-types";

describe("loadLeverageProjection", () => {
  it("returns the browser-safe projection", async () => {
    const projection: LeverageProjection = {
      schema: "farplane_leverage_projection",
      generatedAt: "2026-08-12T13:30:00Z",
      capital: {
        status: "available",
        asOf: "2026-08-12",
        balanceCents: 420000,
        currency: "USD",
        observedAt: "2026-08-12T09:00:00Z",
        source: "bank-statement",
      },
      distribution: [],
      edges: [
        {
          projectId: "unavailable-project",
          projectName: "Unavailable project",
          projectRoot: "/work/unavailable-project",
          metricId: null,
          label: "Edge",
          observedAt: null,
          status: "unavailable",
          value: null,
        },
      ],
      sourceGaps: [],
      strengths: [],
      weaknesses: [],
    };
    const reader = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, projection })),
    ) as typeof fetch;

    await expect(loadLeverageProjection(reader)).resolves.toEqual(projection);
    expect(reader).toHaveBeenCalledWith("/farplane/leverage");
  });

  it("surfaces bridge errors", async () => {
    const reader = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, error: "leverage_unavailable" }), { status: 422 }),
    ) as typeof fetch;

    await expect(loadLeverageProjection(reader)).rejects.toThrow("leverage_unavailable");
  });
});
