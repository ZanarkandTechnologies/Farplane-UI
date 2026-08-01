import { describe, expect, it } from "vitest";
import {
  extractYouTubeVideoId,
  filterYouTubeAssets,
  findYouTubeAssetByVideoId,
  matchStory,
  normalizeTagKey,
  rebuildStoryAggregate,
  rebuildStoryRelations,
  youtubeUrlVariants,
} from "./domain";

const evidence = {
  videoId: "dQw4w9WgXcQ",
  sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  sourceStatus: "TRANSCRIPT_USED" as const,
  sourceKind: "transcript" as const,
  timestamp: "01:20",
  excerpt: "The capability ships with one limit.",
  schemaVersion: 2 as const,
  extractorVersion: "summarize-v3",
};

it("extracts canonical and short YouTube ids", () => {
  expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
    "dQw4w9WgXcQ",
  );
  expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  expect(extractYouTubeVideoId("https://example.com/video")).toBeNull();
});

it("keeps historical YouTube assets behind more than 250 newer non-YouTube videos", () => {
  const newerInstagram = Array.from({ length: 300 }, (_, index) => ({
    sourceUrl: `https://www.instagram.com/reel/${index}`,
  }));
  const historicalYouTube = { sourceUrl: "https://youtu.be/dQw4w9WgXcQ" };
  expect(filterYouTubeAssets([...newerInstagram, historicalYouTube])).toEqual([
    historicalYouTube,
  ]);
});

it("includes short URLs when upgrading a legacy Resource Bank asset", () => {
  expect(youtubeUrlVariants("dQw4w9WgXcQ")).toContain(
    "https://youtu.be/dQw4w9WgXcQ",
  );
});

it("finds a sourceUrl-only legacy asset through normalized YouTube identity", () => {
  const legacy = {
    sourceUrl: "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
  };
  expect(findYouTubeAssetByVideoId([legacy], "dQw4w9WgXcQ")).toBe(legacy);
});

it("finds canonicalUrl-only short and Shorts legacy assets", () => {
  const short = { canonicalUrl: "https://youtu.be/dQw4w9WgXcQ" };
  const shorts = {
    canonicalUrl: "https://www.youtube.com/shorts/aaaaaaaaaaa",
  };
  expect(findYouTubeAssetByVideoId([short, shorts], "dQw4w9WgXcQ")).toBe(short);
  expect(findYouTubeAssetByVideoId([short, shorts], "aaaaaaaaaaa")).toBe(shorts);
});

it("normalizes topic aliases conservatively", () => {
  expect(normalizeTagKey(" Product Launches ")).toBe("product launch");
  expect(normalizeTagKey("product-launch")).toBe("product launch");
});

it("matches the same dated event and rejects conflicting dates", () => {
  const story = {
    id: "story-1",
    title: "Example product launches with a constraint",
    summary: "Launch summary",
    eventDate: "2026-07-20",
    entities: ["Example Product"],
    tagIds: ["tag-product"],
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
  };
  const input = {
    title: "Example product launch has one constraint",
    summary: "Same launch",
    eventDate: "2026-07-20",
    entities: ["Example Product"],
    tags: ["Product Launch"],
    frame: "Constraint first",
    claims: [],
  };
  expect(matchStory(input, [story])?.id).toBe("story-1");
  expect(matchStory({ ...input, eventDate: "2026-08-20" }, [story])).toBeNull();
});

describe("reporting projections", () => {
  it("rebuilds shared claims across two dossiers", () => {
    const contribution = (id: string, dossierId: string) => ({
      id,
      storyId: "story-1",
      dossierId,
      frame: "Constraint first",
      summary: "Summary",
      claims: [
        {
          id: `claim-${id}`,
          statement: "The product ships with one important limit.",
          stance: "neutral" as const,
          evidence: { ...evidence, videoId: dossierId },
        },
      ],
    });
    const aggregate = rebuildStoryAggregate("story-1", [
      contribution("one", "video-1"),
      contribution("two", "video-2"),
    ]);
    expect(aggregate.sourceCount).toBe(2);
    expect(aggregate.sharedClaims).toHaveLength(1);
  });

  it("derives related events only from strong tag and entity overlap", () => {
    const makeStory = (id: string, entities: string[], tagIds: string[]) => ({
      id,
      title: id,
      summary: id,
      entities,
      tagIds,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    });
    const tags = [{ id: "tag-1", canonicalName: "Product Launch", normalizedKey: "product launch" }];
    expect(
      rebuildStoryRelations(
        [
          makeStory("one", ["Example"], ["tag-1"]),
          makeStory("two", ["Example"], ["tag-1"]),
        ],
        tags,
      ),
    ).toHaveLength(1);
    expect(
      rebuildStoryRelations(
        [makeStory("one", ["Example"], []), makeStory("two", ["Different"], [])],
        tags,
      ),
    ).toHaveLength(0);
  });
});
