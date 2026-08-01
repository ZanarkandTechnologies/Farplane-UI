import { describe, expect, it } from "vitest";
import type { VideoIntelligenceProjection } from "../types";
import {
  defaultDossier,
  deriveInformationFlow,
  dossierStory,
  evidenceUrl,
  groupStoriesByTimeline,
  groupVideosByTimeline,
  sortedJobs,
  timestampSeconds,
} from "./video-intelligence-model";

const projection: VideoIntelligenceProjection = {
  schemaVersion: 3,
  revision: 1,
  updatedAt: "2026-07-31T00:00:00.000Z",
  jobs: [
    {
      id: "job-old",
      videoId: "aaaaaaaaaaa",
      title: "Older analysis",
      status: "failed",
      error: "Transcript unavailable",
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
    },
    {
      id: "job-new",
      videoId: "bbbbbbbbbbb",
      title: "Device Y launch",
      status: "succeeded",
      dossierId: "youtube-bbbbbbbbbbb",
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
  dossiers: [
    {
      id: "youtube-bbbbbbbbbbb",
      videoId: "bbbbbbbbbbb",
      canonicalUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
      title: "Device Y launch",
      publisher: "Example",
      publishedAt: "2026-07-30",
      summary: "Summary",
      sourceStatus: "TRANSCRIPT_USED",
      sourceNote: "Transcript inspected.",
      threadId: "thread-1",
      storyIds: ["story-launch"],
      duplicateIngestCount: 1,
      relatedStoryIds: [],
      projectRelevance: [],
      clickbait: {
        answer: "Answer",
        verdict: "DELIVERED",
        confidence: 1,
        evidence: [],
      },
      keyPoints: [],
      recommendation: {
        decision: "READ",
        personalRelevance: null,
        contentQuality: 0.8,
        reasonCode: "PROFILE_UNAVAILABLE",
        rationale: "Read it.",
        matchedProfile: [],
      },
      legacy: false,
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
  stories: [
    {
      id: "story-launch",
      title: "Device Y launches",
      summary: "Launch story",
      eventDate: "2026-07-30",
      entities: ["Device Y"],
      tagIds: ["tag-device"],
      status: "provisional",
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
  tags: [
    {
      id: "tag-device",
      canonicalName: "Device Y",
      normalizedKey: "device y",
      aliases: [],
      provenance: [
        {
          source: "analysis",
          dossierId: "youtube-bbbbbbbbbbb",
          firstSeenAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
  relations: [],
  contributions: [],
  aggregates: [],
};

describe("video intelligence model", () => {
  it("sorts jobs newest first and filters by title or status", () => {
    expect(sortedJobs(projection.jobs).map((job) => job.id)).toEqual(["job-new", "job-old"]);
    expect(sortedJobs(projection.jobs, "failed").map((job) => job.id)).toEqual(["job-old"]);
  });

  it("selects the latest completed dossier and its first story", () => {
    const dossier = defaultDossier(projection);
    expect(dossier?.id).toBe("youtube-bbbbbbbbbbb");
    expect(dossierStory(projection, dossier)?.id).toBe("story-launch");
  });

  it("converts evidence timestamps into source links without inventing time", () => {
    expect(timestampSeconds("01:20")).toBe(80);
    expect(timestampSeconds("1:02:03")).toBe(3723);
    expect(timestampSeconds("bad")).toBeNull();
    const source = {
      videoId: "bbbbbbbbbbb",
      sourceUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
      sourceStatus: "TRANSCRIPT_USED" as const,
      sourceKind: "transcript" as const,
      timestamp: "01:20",
      excerpt: "Evidence",
      schemaVersion: 2 as const,
      extractorVersion: "summarize-v2",
    };
    expect(evidenceUrl(source)).toBe("https://www.youtube.com/watch?v=bbbbbbbbbbb&t=80s");
    expect(evidenceUrl({ ...source, timestamp: null })).toBe(source.sourceUrl);
  });

  it("groups the latest video per id and stories by their event timeline", () => {
    const now = new Date("2026-07-30T12:00:00.000Z");
    expect(groupVideosByTimeline(projection, "", now)[0]?.label).toBe("Today");
    const storyGroup = groupStoriesByTimeline(projection, "device", "tag-device", now)[0];
    expect(storyGroup?.label).toBe("Today");
    expect(storyGroup?.items[0]?.story.id).toBe("story-launch");
  });

  it("derives only contribution and persisted related edges for information flow", () => {
    const withFlow: VideoIntelligenceProjection = {
      ...projection,
      contributions: [
        {
          id: "contribution-1",
          storyId: "story-launch",
          dossierId: "youtube-bbbbbbbbbbb",
          frame: "Launch framing",
          summary: "Summary",
          claims: [],
        },
      ],
    };
    const flow = deriveInformationFlow("story-launch", withFlow);
    expect(flow.nodes.map((node) => node.kind)).toEqual(["source", "story"]);
    expect(flow.edges).toEqual([
      {
        id: "source:youtube-bbbbbbbbbbb->story:story-launch",
        fromId: "source:youtube-bbbbbbbbbbb",
        toId: "story:story-launch",
        label: "contributes",
      },
    ]);
  });
});
