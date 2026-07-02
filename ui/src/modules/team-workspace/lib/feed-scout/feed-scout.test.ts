import { describe, expect, it } from "vitest";
import {
  filterFeedScoutItemsForProject,
  getFeedScoutItemCategory,
  parseFeedScoutConfig,
  parseFeedScoutDailyFeed,
  uniqueFeedScoutValues,
} from "./feed-scout";
import { externalFeedScoutDailyFixture } from "./feed-scout-fixture";

describe("feed scout model", () => {
  it("rejects unrelated or incomplete payloads", () => {
    expect(parseFeedScoutDailyFeed({})).toBeNull();
    expect(
      parseFeedScoutDailyFeed({
        schema: "farplane_feed_scout_daily",
        date: "2026-07-02",
        generated_at: "2026-07-02T03:21:58Z",
        groups: [],
        items: [],
      }),
    ).toBeNull();
  });

  it("parses grouped sources, feed items, source gaps, and latest report metadata", () => {
    const feed = parseFeedScoutDailyFeed(
      {
        schema: "farplane_feed_scout_daily",
        schema_version: "1",
        date: "2026-07-02",
        generated_at: "2026-07-02T03:21:58Z",
        config_ref: "farplane/bindings.yaml#feed_scout",
        review_window: "daily",
        report_ref: ".farplane/reports/feed-scout/2026-07-02T032158Z.md",
        latest_report_ref: ".farplane/reports/feed-scout/latest.json",
        summary: {
          acquisition: "cache_light_no_apify",
          actionable_item_count: 1,
          changed_item_count: 1,
          group_count: 1,
          source_count: 2,
          item_count: 2,
          new_item_count: 1,
          source_gap_count: 1,
        },
        groups: [
          {
            id: "farplane-ecosystem",
            name: "Farplane ecosystem",
            kind: "organization",
            tags: ["farplane", "farplane"],
            item_count: 2,
            sources: [
              {
                id: "farplane-core",
                name: "Farplane",
                kind: "local_project",
                fetch_method: "local_git",
                item_count: 1,
                enabled: true,
              },
            ],
          },
        ],
        items: [
          {
            canonical_key: "older",
            canonical_url: "/workspace/Farplane#commit=older",
            entity_group_id: "farplane-ecosystem",
            entity_group_name: "Farplane ecosystem",
            source_id: "farplane-core",
            source_name: "Farplane",
            platform: "local_git",
            kind: "repo_change",
            rank: 2,
            title: "Older change",
            published_at: "2026-07-01T14:43:08+08:00",
            discovered_at: "2026-07-02T03:21:58Z",
            status: "seen",
            evidence_refs: ["fixture:older"],
            tags: ["farplane"],
          },
          {
            canonical_key: "newer",
            entity_group_id: "farplane-ecosystem",
            entity_group_name: "Farplane ecosystem",
            source_id: "farplane-core",
            source_name: "Farplane",
            platform: "local_git",
            kind: "repo_change",
            rank: 1,
            title: "Newer change",
            published_at: "2026-07-02T02:48:20+08:00",
            status: "new",
            evidence_refs: ["fixture:newer"],
            tags: ["harness"],
          },
        ],
        source_gaps: [
          {
            entity_group_id: "farplane-ecosystem",
            source_id: "valefor",
            reason: "no new rows",
            severity: "info",
          },
        ],
      },
      {
        daily_feed_path: ".farplane/feed-scout/daily/feed-2026-07-02.json",
        report_path: ".farplane/reports/feed-scout/2026-07-02T032158Z.md",
        generated_at: "2026-07-02T03:21:58Z",
      },
    );

    expect(feed?.summary).toMatchObject({
      actionableItemCount: 1,
      acquisition: "cache_light_no_apify",
      changedItemCount: 1,
      itemCount: 2,
      newItemCount: 1,
    });
    expect(feed?.groups[0].sources[0].fetchMethod).toBe("local_git");
    expect(feed?.groups[0].tags).toEqual(["farplane"]);
    expect(feed?.items.map((item) => item.canonicalKey)).toEqual(["newer", "older"]);
    expect(feed?.items[0]).toMatchObject({
      evidenceRefs: ["fixture:newer"],
      rank: 1,
    });
    expect(feed?.sourceGaps[0]).toMatchObject({ sourceId: "valefor", detail: "no new rows" });
    expect(feed?.reportRef.reportPath).toBe(".farplane/reports/feed-scout/2026-07-02T032158Z.md");
    expect(uniqueFeedScoutValues(feed?.items ?? [], (item) => item.status)).toEqual([
      "new",
      "seen",
    ]);
  });

  it("parses schema 0.2.0 daily feed items by rank", () => {
    const feed = parseFeedScoutDailyFeed({
      schema: "farplane_feed_scout_daily",
      schema_version: "0.2.0",
      date: "2026-07-02",
      generated_at: "2026-07-02T05:47:33Z",
      summary: {
        acquisition: "cache_light_no_apify",
        actionable_item_count: 4,
        changed_item_count: 2,
        group_count: 3,
        item_count: 9,
        new_item_count: 9,
        source_count: 7,
        source_gap_count: 6,
      },
      groups: [
        {
          id: "paperclip",
          item_count: 3,
          kind: "competitor",
          name: "Paperclip",
          sources: ["github_repo", "website"],
          tags: ["competitor-intel"],
        },
      ],
      items: [
        {
          canonical_key: "paperclip-low",
          canonical_url: "https://example.com/low",
          entity_group_id: "paperclip",
          entity_group_name: "Paperclip",
          evidence_refs: ["fixture:low"],
          actionability: { label: "ignore", reason: "No material change." },
          rank: 2,
          kind: "org",
          platform: "github",
          published_at: "2026-07-02",
          relationship: "owned_source",
          signal: "low",
          source_id: "github_org",
          source_name: "GitHub org",
          source_snapshot: { stars: 10, forks: 1 },
          status: "new",
          summary: "Low interest metadata row.",
          tags: ["feed-scout"],
          title: "Low interest row",
        },
        {
          canonical_key: "paperclip-high",
          canonical_url: "https://paperclip.ing/",
          actionability: {
            label: "watch",
            reason: "Attention moved today, but feature-level change is unverified.",
          },
          entity_group_id: "paperclip",
          entity_group_name: "Paperclip",
          embed: {
            byline: "72,550 stars, 13,513 forks",
            card_type: "repo",
            provider: "github",
            title: "paperclipai/paperclip",
            url: "https://github.com/paperclipai/paperclip",
          },
          evidence_refs: ["web_search:paperclip.ing result published today"],
          interest_prompt_ref: {
            effective_hash: "3f134d72dc1f",
          },
          rank: 1,
          kind: "website",
          novelty: "changed_today",
          platform: "web",
          published_at: "2026-07-02",
          relationship: "owned_source",
          signal: "high",
          source_id: "website",
          source_name: "website",
          source_snapshot: {
            forks: 13513,
            stars: 72550,
            stars_delta: 28,
          },
          status: "new",
          summary: "Official site fetched through web search.",
          tags: ["feed-scout", "competitor-intel"],
          title: "Paperclip official site",
          today_delta: {
            confidence: "medium",
            delta: { forks: 6, stars: 28 },
            kind: "stars_delta",
            observed_at: "2026-07-02T11:17:45Z",
          },
          why_care_today:
            "Paperclip is still gaining attention today, but feature-level change is unverified.",
        },
      ],
      source_gaps: ["X channel not configured; skipped live X timeline/search fetch."],
    });

    expect(feed?.summary).toMatchObject({
      actionableItemCount: 4,
      acquisition: "cache_light_no_apify",
      changedItemCount: 2,
      itemCount: 9,
      sourceGapCount: 6,
    });
    expect(feed?.items.map((item) => item.canonicalKey)).toEqual([
      "paperclip-high",
      "paperclip-low",
    ]);
    expect(feed?.items[0]).toMatchObject({
      evidenceRefs: ["web_search:paperclip.ing result published today"],
      actionability: {
        label: "watch",
        reason: "Attention moved today, but feature-level change is unverified.",
      },
      embed: {
        byline: "72,550 stars, 13,513 forks",
        cardType: "repo",
        provider: "github",
        title: "paperclipai/paperclip",
        url: "https://github.com/paperclipai/paperclip",
      },
      interestPromptRef: {
        effective_hash: "3f134d72dc1f",
      },
      novelty: "changed_today",
      relationship: "owned_source",
      sourceSnapshot: {
        forks: 13513,
        stars: 72550,
        stars_delta: 28,
      },
      summary: "Official site fetched through web search.",
      todayDelta: {
        confidence: "medium",
        delta: { forks: 6, stars: 28 },
        kind: "stars_delta",
        observedAt: "2026-07-02T11:17:45Z",
      },
      whyCareToday:
        "Paperclip is still gaining attention today, but feature-level change is unverified.",
    });
    expect(feed?.items[0].rank).toBe(1);
    expect(feed?.sourceGaps[0]).toMatchObject({
      title: "Source gap 1",
      detail: "X channel not configured; skipped live X timeline/search fetch.",
    });
  });

  it("parses keyed feed scout entity config from bindings.yaml", () => {
    const config = parseFeedScoutConfig({
      enabled: true,
      cadence: "daily",
      timezone: "Asia/Kuala_Lumpur",
      latest_report: ".farplane/reports/feed-scout/latest.json",
      ui: { latest_feed: ".farplane/feed-scout/daily/latest.json" },
      entities: {
        "farplane-ecosystem": {
          name: "Farplane ecosystem",
          kind: "organization",
          tags: ["farplane", "harness"],
          enabled: true,
          sources: {
            "farplane-core": {
              kind: "local_project",
              name: "Farplane",
              url: "/Users/example/Farplane",
              content_kinds: ["repo_change", "skill_change"],
              watch_paths: ["skills", "docs/features"],
              fetch_method: "local_git",
              min_signal: "medium",
              enabled: true,
            },
            valefor: {
              kind: "local_project",
              name: "Valefor",
              url: "/Users/example/Valefor",
              fetch_method: "local_git",
              enabled: false,
            },
          },
        },
      },
    });

    expect(config?.entities.map((entity) => entity.key)).toEqual(["farplane-ecosystem"]);
    expect(config?.entities[0].sources.map((source) => source.key)).toEqual([
      "farplane-core",
      "valefor",
    ]);
    expect(config?.entities[0].sources[0]).toMatchObject({
      contentKinds: ["repo_change", "skill_change"],
      fetchMethod: "local_git",
      minSignal: "medium",
    });
    expect(config?.entities[0].sources[1].enabled).toBe(false);
  });

  it("treats external intelligence as the default feed category", () => {
    expect(
      externalFeedScoutDailyFixture.items.map((item) => [
        item.kind,
        getFeedScoutItemCategory(item),
      ]),
    ).toEqual([
      ["article", "external"],
      ["video", "external"],
      ["release", "external"],
      ["post", "external"],
    ]);

    const scoped = filterFeedScoutItemsForProject(externalFeedScoutDailyFixture.items, {
      projectId: "farplane-ui",
      projectName: "Farplane UI",
    });

    expect(scoped).toHaveLength(4);
  });

  it("classifies local git repo changes as internal project activity", () => {
    const feed = parseFeedScoutDailyFeed({
      schema: "farplane_feed_scout_daily",
      schema_version: "1",
      date: "2026-07-02",
      generated_at: "2026-07-02T03:21:58Z",
      summary: {},
      groups: [],
      items: [
        {
          canonical_key: "git-farplane-ui-c92dd445214b",
          entity_group_id: "farplane-ecosystem",
          entity_group_name: "Farplane ecosystem",
          source_id: "farplane-ui",
          source_name: "Farplane UI",
          platform: "local_git",
          kind: "repo_change",
          title: "Centralize runtime config",
          published_at: "2026-07-01T14:43:08+08:00",
          status: "seen",
        },
      ],
      source_gaps: [],
    });

    expect(feed?.items.map(getFeedScoutItemCategory)).toEqual(["internal"]);
  });
});
