import { describe, expect, it } from "vitest";
import { buildLeverageProjection } from "./leverage-projection";

const finance = {
  latestBalance: {
    asOf: "2026-08-12",
    balanceCents: 420000,
    currency: "USD",
    observedAt: "2026-08-12T09:00:00Z",
    source: "bank-statement",
  },
};

function snapshot(): unknown {
  return {
    metrics: {
      series: [
        {
          metric_id: "instagram_followers",
          label: "Instagram followers",
          leverage: "distribution",
          unit: "followers",
          status: "available",
          distribution_account: {
            platform: "instagram",
            account_id: "17841400000000000",
            label: "@kenji",
          },
          current: { value: 843, status: "available", observed_at: "2026-08-12T08:00:00Z" },
        },
        {
          metric_id: "instagram_reach",
          label: "Instagram reach",
          leverage: "distribution",
          unit: "accounts",
          status: "available",
          distribution_account: {
            platform: "instagram",
            account_id: "17841400000000000",
            label: "@kenji",
          },
          current: { value: 1209, status: "available", observed_at: "2026-08-12T08:00:00Z" },
        },
        {
          metric_id: "x_followers",
          label: "X followers",
          leverage: "distribution",
          unit: "followers",
          status: "available",
          distribution_account: {
            platform: "x",
            account_id: "1560000000000000000",
            label: "@kenji",
          },
          current: { value: 215, status: "available", observed_at: "2026-08-12T08:00:00Z" },
        },
        {
          metric_id: "edge",
          label: "Edge",
          leverage: "edge",
          type: "markdown",
          status: "available",
          current: {
            value: "Verified delivery evidence makes the workflow demonstrable.",
            status: "available",
            observed_at: "2026-08-12T08:30:00Z",
          },
        },
      ],
    },
  };
}

describe("buildLeverageProjection", () => {
  it("deduplicates tracking contexts and projects account-level provenance", async () => {
    const reads: string[] = [];
    const projection = await buildLeverageProjection({
      company: {
        projects: [
          { id: "alpha", name: "Alpha", trackingContext: "/work/alpha" },
          { id: "duplicate", name: "Duplicate", trackingContext: "/work/alpha" },
          { id: "beta", name: "Beta", trackingContext: "/work/beta" },
        ],
      },
      financeProjection: finance,
      generatedAt: "2026-08-12T10:00:00Z",
      readProjectSnapshot: async (projectRoot) => {
        reads.push(projectRoot);
        return projectRoot === "/work/alpha" ? snapshot() : { metrics: { series: [] } };
      },
    });

    expect(reads).toEqual(["/work/alpha", "/work/beta"]);
    expect(projection.distribution).toHaveLength(2);
    expect(projection.distribution.map((account) => account.label)).toEqual([
      "Instagram · @kenji",
      "X · @kenji",
    ]);
    expect(projection.distribution[0]?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricId: "instagram_reach",
          value: 1209,
        }),
      ]),
    );
    expect(projection.distribution[0]?.projects).toEqual([{ id: "alpha", name: "Alpha" }]);
    expect(projection.distribution[0]?.metrics).toHaveLength(2);
    expect(projection.distribution[1]?.metrics[0]).toMatchObject({
      metricId: "x_followers",
      value: 215,
    });
    expect(JSON.stringify(projection)).not.toContain("17841400000000000");
    expect(projection.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: "alpha", projectName: "Alpha", value: expect.any(String) }),
        expect.objectContaining({ projectId: "beta", projectName: "Beta", status: "not_configured" }),
      ]),
    );
    expect(projection.sourceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "beta",
          projectName: "Beta",
          code: "distribution_not_configured",
        }),
      ]),
    );
  });

  it("uses card freshness instead of filesystem metadata and surfaces missing evidence", async () => {
    const projection = await buildLeverageProjection({
      company: { projects: [{ id: "alpha", name: "Alpha", trackingContext: "/work/alpha" }] },
      financeProjection: { latestBalance: null },
      readProjectSnapshot: async () => ({
        metrics: {
          series: [
            {
              metric_id: "followers",
              label: "Followers",
              leverage: "distribution",
              unit: "followers",
              status: "stale",
              current: { value: 40, status: "stale", observed_at: "2026-07-01T00:00:00Z" },
            },
            {
              metric_id: "edge",
              label: "Edge",
              leverage: "edge",
              status: "missing",
              current: { value: null, status: "missing" },
            },
          ],
        },
      }),
    });

    expect(projection.distribution).toEqual([]);
    expect(projection.edges[0]).toMatchObject({ status: "missing", value: null });
    expect(projection.sourceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "capital_not_recorded", scope: "capital" }),
        expect.objectContaining({ code: "distribution_stale", projectId: "alpha" }),
        expect.objectContaining({ code: "distribution_account_identity_missing", projectId: "alpha" }),
        expect.objectContaining({ code: "edge_missing", projectId: "alpha" }),
      ]),
    );
  });

  it("keeps unreadable and malformed project snapshots as project-scoped gaps", async () => {
    const projection = await buildLeverageProjection({
      company: {
        projects: [
          { id: "readable", name: "Readable", trackingContext: "/work/readable" },
          { id: "broken", name: "Broken", trackingContext: "/work/broken" },
          { id: "no-context", name: "No Context" },
        ],
      },
      financeProjection: finance,
      readProjectSnapshot: async (projectRoot) => {
        if (projectRoot === "/work/broken") throw new Error("unreadable");
        return snapshot();
      },
    });

    expect(projection.edges).toHaveLength(3);
    expect(projection.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: "readable", value: expect.any(String) }),
        expect.objectContaining({ projectId: "broken", status: "unavailable" }),
        expect.objectContaining({ projectId: "no-context", status: "unavailable" }),
      ]),
    );
    expect(projection.sourceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: "broken", code: "project_snapshot_unavailable" }),
        expect.objectContaining({ projectId: "no-context", code: "tracking_context_missing" }),
      ]),
    );
  });

  it("groups one owned account across projects and chooses the newest metric", async () => {
    const instagramAccount = {
      platform: "instagram",
      account_id: "17841400000000000",
      label: "@kenji",
    };
    const projection = await buildLeverageProjection({
      company: {
        projects: [
          { id: "alpha", name: "Alpha", trackingContext: "/work/alpha" },
          { id: "beta", name: "Beta", trackingContext: "/work/beta" },
        ],
      },
      financeProjection: finance,
      readProjectSnapshot: async (projectRoot) => ({
        metrics: {
          series: [
            {
              metric_id: "instagram_followers",
              label: "Instagram followers",
              leverage: "distribution",
              unit: "followers",
              status: "available",
              distribution_account: instagramAccount,
              current: {
                value: projectRoot === "/work/alpha" ? 843 : 900,
                status: "available",
                observed_at:
                  projectRoot === "/work/alpha" ? "2026-08-12T08:00:00Z" : "2026-08-12T09:00:00Z",
              },
            },
          ],
        },
      }),
    });

    expect(projection.distribution).toHaveLength(1);
    expect(projection.distribution[0]).toMatchObject({
      label: "Instagram · @kenji",
      projects: [
        { id: "alpha", name: "Alpha" },
        { id: "beta", name: "Beta" },
      ],
      metrics: [
        expect.objectContaining({
          metricId: "instagram_followers",
          value: 900,
          observedAt: "2026-08-12T09:00:00Z",
        }),
      ],
    });
  });

  it("keeps one deterministic reading and reports a conflict for tied shared-account metrics", async () => {
    const instagramAccount = {
      platform: "instagram",
      account_id: "17841400000000000",
      label: "@kenji",
    };
    const projection = await buildLeverageProjection({
      company: {
        projects: [
          { id: "alpha", name: "Alpha", trackingContext: "/work/alpha" },
          { id: "beta", name: "Beta", trackingContext: "/work/beta" },
        ],
      },
      financeProjection: finance,
      readProjectSnapshot: async (projectRoot) => ({
        metrics: {
          series: [
            {
              metric_id: "instagram_followers",
              label: "Instagram followers",
              leverage: "distribution",
              unit: "followers",
              status: "available",
              distribution_account: instagramAccount,
              current: {
                value: projectRoot === "/work/alpha" ? 843 : 900,
                status: "available",
                observed_at: "2026-08-12T08:00:00Z",
              },
            },
          ],
        },
      }),
    });

    expect(projection.distribution[0]?.metrics[0]).toMatchObject({ value: 843 });
    expect(projection.sourceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "distribution_account_metric_conflict",
          projectId: "alpha",
        }),
      ]),
    );
  });
});
