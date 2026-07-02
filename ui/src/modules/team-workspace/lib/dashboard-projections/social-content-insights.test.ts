import { describe, expect, it } from "vitest";
import {
  buildSocialContentInsightsModel,
  isReelContent,
  parseSocialContentItems,
  parseSocialContentFromMetricsSnapshot,
  retentionLabel,
} from "./social-content-insights";

const socialContentItems = parseSocialContentItems([
  {
    platform: "instagram",
    content_id: "17966345906934171",
    url: "https://www.instagram.com/p/DaIvpaOmQhj/",
    published_at: "2026-06-28T16:41:13+0000",
    kind: "carousel_album",
    content_metrics: {
      views: 2180,
      likes: 130,
      engagements: 131,
      comments: 0,
      shares: 1,
      saves: 0,
      profile_clicks: null,
      url_clicks: null,
      retention_score: null,
    },
    gaps: [],
    source_metric_ids: ["instagram_views"],
  },
  {
    platform: "x",
    content_id: "2063623337851691167",
    url: "https://x.com/kenjiphang/status/2063623337851691167",
    published_at: "2026-06-07T14:05:18.000Z",
    kind: "post",
    content_metrics: {
      views: 206,
      likes: 0,
      engagements: null,
      comments: 2,
      shares: 0,
      saves: null,
      profile_clicks: null,
      url_clicks: null,
      retention_score: null,
    },
    gaps: [],
    source_metric_ids: ["x_views", "x_likes"],
  },
]);

describe("social content insights", () => {
  it("labels retention only when a retention value exists", () => {
    const reel = parseSocialContentItems([
      {
        platform: "instagram",
        content_id: "instagram:18000850874933138",
        kind: "reel",
        url: "https://www.instagram.com/reel/DZHiKs4RMeu/",
        kpis: ["instagram_retention_score"],
        content_metrics: { retention_score: 0.42 },
      },
    ])[0];
    expect(retentionLabel(reel)).toBe("0.4 retention");
  });

  it("builds content insights from project-local runtime sources", () => {
    const model = buildSocialContentInsightsModel({
      ok: true,
      projectPath: "/tmp/farplane",
      generatedAtMs: 1,
      files: [],
      runtimeSources: [
        {
          id: "social-x-latest-selected",
          label: "X latest selected content",
          path: "tmp/social-metrics-dry-run/x_latest_selected.json",
          kind: "file",
          absolutePath: "/tmp/farplane/tmp/social-metrics-dry-run/x_latest_selected.json",
          exists: true,
          updatedAtMs: 1,
          childCount: null,
          parsedJson: {
            content_items: [socialContentItems[1]],
          },
        },
      ],
    });
    expect(model.items).toHaveLength(1);
    expect(model.items[0].platform).toBe("x");
    expect(model.windows[0].detail).toBe("1 selected content item");
  });

  it("prefers compiled metrics snapshot contents when available", () => {
    const items = parseSocialContentFromMetricsSnapshot({
      schemaVersion: 2,
      snapshotDate: "2026-07-02",
      generatedAt: "",
      metrics: [],
      sourceGaps: [],
      contents: [
        {
          contentId: "instagram:17966345906934171",
          approval: "approved",
          approvalRef: "temporary-poc:operator-approved-last-3-videos",
          campaign: "temporary_distribution_poc",
          externalId: "17966345906934171",
          id: "instagram:17966345906934171",
          mediaProductType: "REELS",
          mediaType: "VIDEO",
          kpis: ["instagram_likes"],
          platform: "instagram",
          publishedAt: "2026-06-03T08:54:16+0000",
          status: "posted",
          title: "Temporary POC reel",
          url: "https://www.instagram.com/p/DaIvpaOmQhj/",
          metrics: [
            {
              metricId: "instagram_likes",
              label: "Instagram likes",
              unit: "likes",
              product: "distribution",
              current: 133,
              series: [{ date: "2026-07-01", value: 133 }],
            },
          ],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0].platform).toBe("instagram");
    expect(items[0].approval).toBe("approved");
    expect(items[0].campaign).toBe("temporary_distribution_poc");
    expect(items[0].external_id).toBe("17966345906934171");
    expect(items[0].kind).toBe("reels");
    expect(items[0].media_product_type).toBe("REELS");
    expect(items[0].media_type).toBe("VIDEO");
    expect(isReelContent(items[0])).toBe(true);
    expect(items[0].published_at).toBe("2026-06-03T08:54:16+0000");
    expect(items[0].status).toBe("posted");
    expect(items[0].title).toBe("Temporary POC reel");
    expect(items[0].metric_chips[0].current).toBe(133);
    expect(items[0].series_rows[0]).toMatchObject({
      date: "2026-07-01",
      metricId: "instagram_likes",
      value: 133,
    });
  });
});
