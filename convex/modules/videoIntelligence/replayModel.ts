/** Pure stored-data replay classification and trusted metadata normalization. */
import { isTimelineDay } from "../content/timeline";
import { defaultProgressForJobStatus, type VideoProgressStage } from "./progressModel";

type ReplayJobStatus = "queued" | "analyzing" | "ready" | "failed" | "needs_review";

type ReplayJobProgress = {
  stage: VideoProgressStage;
  message: string;
  updatedAtMs: number;
};

export type StoredJobProgressRepair =
  | { kind: "initialize"; progress: ReplayJobProgress }
  | {
      kind: "restore_timestamp";
      progress: ReplayJobProgress;
      jobUpdatedAtMs: number;
    };

/**
 * Backfill lifecycle progress without making an old job look newly updated.
 * The restore branch recognizes only the exact default payload previously
 * written by this replay and only when its timestamp was moved by over a minute.
 */
export function planStoredJobProgressRepair(job: {
  status: ReplayJobStatus;
  createdAtMs: number;
  updatedAtMs: number;
  completedAtMs?: number;
  progress?: ReplayJobProgress;
}): StoredJobProgressRepair | null {
  const fallback = defaultProgressForJobStatus(job.status);
  if (!job.progress) {
    return {
      kind: "initialize",
      progress: {
        ...fallback,
        updatedAtMs: job.completedAtMs ?? job.updatedAtMs,
      },
    };
  }
  if (job.progress.stage !== fallback.stage || job.progress.message !== fallback.message) {
    return null;
  }
  const historicalAtMs = job.completedAtMs ?? job.createdAtMs;
  const replayMovedLifecycle =
    job.progress.updatedAtMs === job.updatedAtMs && job.updatedAtMs - historicalAtMs > 60_000;
  if (!replayMovedLifecycle) return null;
  return {
    kind: "restore_timestamp",
    progress: { ...job.progress, updatedAtMs: historicalAtMs },
    jobUpdatedAtMs: historicalAtMs,
  };
}

export type ReplayReadiness = {
  readyForReplay: boolean;
  needsReanalysis: boolean;
  missingProgress: boolean;
  missingMetadata: boolean;
  missingPublishedAt: boolean;
  missingPublisher: boolean;
  missingTimelineDay: boolean;
};

export function classifyReplayReadiness(input: {
  hasContentSource: boolean;
  hasCurrentRevision: boolean;
  hasContentJob: boolean;
  hasProgress: boolean;
  hasUsablePublicationDate: boolean;
  hasCreatorIdentity: boolean;
  hasPublisher: boolean;
  hasTimelineDay: boolean;
}): ReplayReadiness {
  const missingPublishedAt = !input.hasUsablePublicationDate;
  const missingPublisher = !input.hasPublisher;
  const missingTimelineDay = !input.hasTimelineDay;
  return {
    readyForReplay:
      input.hasContentSource &&
      input.hasCurrentRevision &&
      input.hasUsablePublicationDate &&
      input.hasCreatorIdentity,
    needsReanalysis: !input.hasContentSource || !input.hasCurrentRevision,
    missingProgress: input.hasContentJob && !input.hasProgress,
    missingMetadata: missingPublishedAt || missingPublisher || missingTimelineDay,
    missingPublishedAt,
    missingPublisher,
    missingTimelineDay,
  };
}

export function trustedPublicationDay(value: string): string | null {
  const day = value.trim();
  return isTimelineDay(day) ? day : null;
}

export function cleanTrustedPublisher(value: string): string | null {
  const publisher = value.trim().replace(/\s+/g, " ").slice(0, 300);
  return publisher || null;
}

export function cleanTrustedCreatorAuthorityKey(value: string): string | null {
  const key = value.trim().toLocaleLowerCase();
  return /^youtube:[a-z0-9@._-]{2,180}$/.test(key) ? key : null;
}

/**
 * Advance a canonical source to the observation day of its current dossier.
 * Replay is monotonic: it never rewinds a source or changes a same-day row.
 */
export function planSourceObservationRepair(input: {
  sourceTimelineDay?: string;
  sourceUpdatedAtMs: number;
  dossierTimelineDay?: string;
  dossierUpdatedAtMs: number;
}): { timelineDay: string; updatedAtMs: number } | null {
  const dossierDay = input.dossierTimelineDay;
  if (!dossierDay || !isTimelineDay(dossierDay)) return null;
  if (input.sourceTimelineDay && input.sourceTimelineDay >= dossierDay) return null;
  return {
    timelineDay: dossierDay,
    updatedAtMs: Math.max(input.sourceUpdatedAtMs, input.dossierUpdatedAtMs),
  };
}

export type TrustedMetadataRepairPlan =
  | {
      ok: true;
      patch: { publishedAt?: string; publisher?: string };
      creatorAuthorityKey?: string;
    }
  | {
      ok: false;
      reason:
        | "video_intelligence_replay_metadata_empty"
        | "video_intelligence_replay_published_day_invalid"
        | "video_intelligence_replay_publisher_invalid"
        | "video_intelligence_replay_creator_authority_invalid";
    };

export function planTrustedMetadataRepair(
  existing: { publishedAt?: string; publisher?: string },
  requested: { publishedAt?: string; publisher?: string; creatorAuthorityKey?: string },
): TrustedMetadataRepairPlan {
  if (
    requested.publishedAt === undefined &&
    requested.publisher === undefined &&
    requested.creatorAuthorityKey === undefined
  ) {
    return { ok: false, reason: "video_intelligence_replay_metadata_empty" };
  }
  const patch: { publishedAt?: string; publisher?: string } = {};
  if (requested.publishedAt !== undefined) {
    const day = trustedPublicationDay(requested.publishedAt);
    if (!day) {
      return { ok: false, reason: "video_intelligence_replay_published_day_invalid" };
    }
    if (!existing.publishedAt) patch.publishedAt = day;
  }
  if (requested.publisher !== undefined) {
    const publisher = cleanTrustedPublisher(requested.publisher);
    if (!publisher) {
      return { ok: false, reason: "video_intelligence_replay_publisher_invalid" };
    }
    if (!cleanTrustedPublisher(existing.publisher ?? "")) patch.publisher = publisher;
  }
  let creatorAuthorityKey: string | undefined;
  if (requested.creatorAuthorityKey !== undefined) {
    creatorAuthorityKey =
      cleanTrustedCreatorAuthorityKey(requested.creatorAuthorityKey) ?? undefined;
    if (!creatorAuthorityKey) {
      return { ok: false, reason: "video_intelligence_replay_creator_authority_invalid" };
    }
  }
  return { ok: true, patch, ...(creatorAuthorityKey ? { creatorAuthorityKey } : {}) };
}
