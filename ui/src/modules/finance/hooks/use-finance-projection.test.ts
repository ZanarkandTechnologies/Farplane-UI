import { describe, expect, it, vi } from "vitest";
import { loadFinanceProjection } from "./use-finance-projection";

describe("loadFinanceProjection", () => {
  it("returns the browser-safe projection", async () => {
    const projection = { schema: "farplane_finance_projection", currency: "USD" };
    const reader = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, projection })),
    ) as typeof fetch;
    await expect(loadFinanceProjection(reader)).resolves.toEqual({
      ...projection,
      latestBalance: null,
      balanceHistory: [],
      balanceSnapshotCount: 0,
    });
    expect(reader).toHaveBeenCalledWith("/farplane/finance");
  });

  it("normalizes projections persisted before balance snapshots existed", async () => {
    const reader = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            projection: {
              schema: "farplane_finance_projection",
              currency: "USD",
              balanceHistory: null,
            },
          }),
        ),
    ) as typeof fetch;

    await expect(loadFinanceProjection(reader)).resolves.toMatchObject({
      latestBalance: null,
      balanceHistory: [],
      balanceSnapshotCount: 0,
    });
  });

  it("surfaces bridge errors", async () => {
    const reader = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, error: "finance_broken" }), { status: 422 }),
    ) as typeof fetch;
    await expect(loadFinanceProjection(reader)).rejects.toThrow("finance_broken");
  });
});
