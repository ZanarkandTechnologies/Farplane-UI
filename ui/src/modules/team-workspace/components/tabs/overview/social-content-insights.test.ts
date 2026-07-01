import { describe, expect, it } from "vitest";
import {
  buildSocialContentInsightsModel,
  parseSocialContentItems,
  retentionGapLabel,
  retentionLabel,
  reviewCue,
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
  it("marks non-Reel content as retention not applicable", () => {
    expect(retentionLabel(socialContentItems[0])).toBe("retention n/a");
    expect(retentionGapLabel(socialContentItems[0])).toBe("Retention only applies to Reel review");
  });

  it("derives scan-friendly review cues from content metrics", () => {
    expect(reviewCue(socialContentItems[0])).toBe("Inspect hook + CTA");
    expect(reviewCue(socialContentItems[1])).toBe("Reply thread first");
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
});
