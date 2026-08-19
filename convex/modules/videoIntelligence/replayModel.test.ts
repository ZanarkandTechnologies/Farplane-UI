import { expect, it } from "vitest";
import {
  classifyReplayReadiness,
  cleanTrustedCreatorAuthorityKey,
  cleanTrustedPublisher,
  planStoredJobProgressRepair,
  planSourceObservationRepair,
  planTrustedMetadataRepair,
  trustedPublicationDay,
} from "./replayModel";

it("advances source observation chronology without rewinding or churning same-day rows", () => {
  expect(
    planSourceObservationRepair({
      sourceTimelineDay: "2026-08-04",
      sourceUpdatedAtMs: 3_000,
      dossierTimelineDay: "2026-08-19",
      dossierUpdatedAtMs: 2_000,
    }),
  ).toEqual({ timelineDay: "2026-08-19", updatedAtMs: 3_000 });
  expect(
    planSourceObservationRepair({
      sourceTimelineDay: "2026-08-19",
      sourceUpdatedAtMs: 3_000,
      dossierTimelineDay: "2026-08-19",
      dossierUpdatedAtMs: 4_000,
    }),
  ).toBeNull();
  expect(
    planSourceObservationRepair({
      sourceTimelineDay: "2026-08-20",
      sourceUpdatedAtMs: 3_000,
      dossierTimelineDay: "2026-08-19",
      dossierUpdatedAtMs: 4_000,
    }),
  ).toBeNull();
});

it("backfills progress without refreshing lifecycle chronology and repairs the old replay shape", () => {
  expect(
    planStoredJobProgressRepair({
      status: "failed",
      createdAtMs: 1_000,
      updatedAtMs: 2_000,
      completedAtMs: 1_900,
    }),
  ).toEqual({
    kind: "initialize",
    progress: { stage: "failed", message: "Analysis failed.", updatedAtMs: 1_900 },
  });
  expect(
    planStoredJobProgressRepair({
      status: "ready",
      createdAtMs: 1_000,
      completedAtMs: 2_000,
      updatedAtMs: 200_000,
      progress: { stage: "complete", message: "Analysis is ready.", updatedAtMs: 200_000 },
    }),
  ).toEqual({
    kind: "restore_timestamp",
    jobUpdatedAtMs: 2_000,
    progress: { stage: "complete", message: "Analysis is ready.", updatedAtMs: 2_000 },
  });
  expect(
    planStoredJobProgressRepair({
      status: "ready",
      createdAtMs: 1_000,
      completedAtMs: 2_000,
      updatedAtMs: 2_000,
      progress: { stage: "complete", message: "Analysis is ready.", updatedAtMs: 2_000 },
    }),
  ).toBeNull();
});

it("separates stored comparison readiness from repair and reanalysis needs", () => {
  expect(
    classifyReplayReadiness({
      hasContentSource: true,
      hasCurrentRevision: true,
      hasContentJob: true,
      hasProgress: false,
      hasUsablePublicationDate: false,
      hasCreatorIdentity: false,
      hasPublisher: false,
      hasTimelineDay: true,
    }),
  ).toEqual({
    readyForReplay: false,
    needsReanalysis: false,
    missingProgress: true,
    missingMetadata: true,
    missingPublishedAt: true,
    missingPublisher: true,
    missingTimelineDay: false,
  });
  expect(
    classifyReplayReadiness({
      hasContentSource: true,
      hasCurrentRevision: false,
      hasContentJob: true,
      hasProgress: true,
      hasUsablePublicationDate: true,
      hasCreatorIdentity: true,
      hasPublisher: true,
      hasTimelineDay: true,
    }).needsReanalysis,
  ).toBe(true);
  expect(
    classifyReplayReadiness({
      hasContentSource: true,
      hasCurrentRevision: true,
      hasContentJob: true,
      hasProgress: true,
      hasUsablePublicationDate: true,
      hasCreatorIdentity: false,
      hasPublisher: false,
      hasTimelineDay: true,
    }).readyForReplay,
  ).toBe(false);
  expect(
    classifyReplayReadiness({
      hasContentSource: true,
      hasCurrentRevision: true,
      hasContentJob: true,
      hasProgress: true,
      hasUsablePublicationDate: true,
      hasCreatorIdentity: true,
      hasPublisher: false,
      hasTimelineDay: true,
    }).readyForReplay,
  ).toBe(true);
});

it("plans only validated missing-field metadata repairs", () => {
  expect(
    planTrustedMetadataRepair(
      {},
      {
        publishedAt: "2026-08-19",
        publisher: "  Example   Creator ",
        creatorAuthorityKey: "youtube:@example",
      },
    ),
  ).toEqual({
    ok: true,
    patch: { publishedAt: "2026-08-19", publisher: "Example Creator" },
    creatorAuthorityKey: "youtube:@example",
  });
  expect(
    planTrustedMetadataRepair(
      { publishedAt: "2026-08-18", publisher: "Existing Creator" },
      { publishedAt: "2026-08-19", publisher: "Replacement Creator" },
    ),
  ).toEqual({ ok: true, patch: {} });
  expect(planTrustedMetadataRepair({}, { publishedAt: "yesterday" })).toMatchObject({
    ok: false,
    reason: "video_intelligence_replay_published_day_invalid",
  });
  expect(planTrustedMetadataRepair({}, {})).toMatchObject({
    ok: false,
    reason: "video_intelligence_replay_metadata_empty",
  });
  expect(planTrustedMetadataRepair({}, { creatorAuthorityKey: "internal:example" })).toMatchObject({
    ok: false,
    reason: "video_intelligence_replay_creator_authority_invalid",
  });
});

it("accepts exact trusted days and cleans publisher metadata", () => {
  expect(trustedPublicationDay(" 2026-08-19 ")).toBe("2026-08-19");
  expect(trustedPublicationDay("2026-08-19T12:00:00Z")).toBeNull();
  expect(trustedPublicationDay("2026-02-30")).toBeNull();
  expect(cleanTrustedPublisher("  Example   Creator  ")).toBe("Example Creator");
  expect(cleanTrustedPublisher("   ")).toBeNull();
  expect(cleanTrustedCreatorAuthorityKey(" YouTube:@Example.Channel ")).toBe(
    "youtube:@example.channel",
  );
  expect(cleanTrustedCreatorAuthorityKey("creator:example")).toBeNull();
});
