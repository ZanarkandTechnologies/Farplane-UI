/**
 * Durable local owner for Farplane video dossiers and story projections.
 * Browser code receives a read-only projection; all writes happen in the loopback bridge.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  addTag,
  cloneEmptyState,
  hash,
  normalizedTokens,
  rebuildStoryRelations,
  resolveVideoIntelligenceStatePath,
  type ExtractedStory,
  type ReportingClaim,
  type Story,
  type StoryAggregate,
  type StoryContribution,
  type VideoDossier,
  type VideoIngestJob,
  type VideoIntelligenceAnalysis,
  type VideoIntelligenceState,
} from "./video-intelligence-model.js";

export * from "./video-intelligence-model.js";

function similarity(left: string, right: string): number {
  const a = normalizedTokens(left);
  const b = normalizedTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function entitySimilarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const a = new Set(left.map((value) => value.trim().toLocaleLowerCase()));
  const b = new Set(right.map((value) => value.trim().toLocaleLowerCase()));
  const intersection = [...a].filter((value) => b.has(value)).length;
  return intersection / new Set([...a, ...b]).size;
}

function datesConflict(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
  return Math.abs(leftMs - rightMs) > 7 * 24 * 60 * 60 * 1000;
}

export function matchStory(
  input: ExtractedStory,
  stories: Story[],
): Story | null {
  let match: { story: Story; score: number } | null = null;
  for (const story of stories) {
    if (datesConflict(input.eventDate, story.eventDate)) continue;
    const score =
      similarity(input.title, story.title) * 0.72 +
      entitySimilarity(input.entities, story.entities) * 0.28;
    if (score >= 0.5 && (!match || score > match.score)) {
      match = { story, score };
    }
  }
  return match?.story ?? null;
}

function claimClusters(contributions: StoryContribution[]) {
  const clusters: {
    statement: string;
    members: { dossierId: string; claim: ReportingClaim }[];
  }[] = [];
  for (const contribution of contributions) {
    for (const claim of contribution.claims) {
      const cluster = clusters.find(
        (candidate) => similarity(candidate.statement, claim.statement) >= 0.55,
      );
      if (cluster) {
        cluster.members.push({ dossierId: contribution.dossierId, claim });
      } else {
        clusters.push({
          statement: claim.statement,
          members: [{ dossierId: contribution.dossierId, claim }],
        });
      }
    }
  }
  return clusters;
}

export function rebuildStoryAggregate(
  storyId: string,
  contributions: StoryContribution[],
  now = new Date().toISOString(),
): StoryAggregate {
  const storyContributions = contributions.filter(
    (contribution) => contribution.storyId === storyId,
  );
  const clusters = claimClusters(storyContributions);
  const sharedClaims = clusters
    .filter(
      (cluster) =>
        new Set(cluster.members.map((member) => member.dossierId)).size > 1,
    )
    .map((cluster) => ({
      statement: cluster.statement,
      sourceDossierIds: [
        ...new Set(cluster.members.map((member) => member.dossierId)),
      ],
      evidence: cluster.members.map((member) => member.claim.evidence),
    }));
  const sharedIds = new Set(
    clusters
      .filter(
        (cluster) =>
          new Set(cluster.members.map((member) => member.dossierId)).size > 1,
      )
      .flatMap((cluster) => cluster.members.map((member) => member.claim.id)),
  );
  return {
    storyId,
    perspectiveCount: storyContributions.length,
    sourceCount: new Set(
      storyContributions.map((contribution) => contribution.dossierId),
    ).size,
    sharedClaims,
    distinctClaims: storyContributions.flatMap((contribution) =>
      contribution.claims
        .filter((claim) => !sharedIds.has(claim.id))
        .map((claim) => ({
          dossierId: contribution.dossierId,
          statement: claim.statement,
          stance: claim.stance,
          evidence: claim.evidence,
        })),
    ),
    frames: storyContributions.map((contribution) => ({
      dossierId: contribution.dossierId,
      frame: contribution.frame,
    })),
    updatedAt: now,
  };
}

type LegacyVideoIntelligenceState = Omit<
  VideoIntelligenceState,
  "schemaVersion" | "stories" | "tags" | "relations"
> & {
  schemaVersion: 1;
  stories: Omit<Story, "tagIds">[];
};

type StateCandidate = {
  schemaVersion?: unknown;
  jobs?: unknown;
  dossiers?: unknown;
  stories?: unknown;
  contributions?: unknown;
  aggregates?: unknown;
  tags?: unknown;
  relations?: unknown;
};

function hasCoreCollections(state: StateCandidate): boolean {
  return (
    Array.isArray(state.jobs) &&
    Array.isArray(state.dossiers) &&
    Array.isArray(state.stories) &&
    Array.isArray(state.contributions) &&
    Array.isArray(state.aggregates)
  );
}

export function migrateVideoIntelligenceState(
  legacy: LegacyVideoIntelligenceState,
): VideoIntelligenceState {
  const now = new Date().toISOString();
  const state: VideoIntelligenceState = {
    ...JSON.parse(JSON.stringify(legacy)),
    schemaVersion: 2,
    stories: legacy.stories.map((story) => ({ ...story, tagIds: [] })),
    tags: [],
    relations: [],
  };
  for (const story of state.stories) {
    story.tagIds = story.entities
      .map((entity) => addTag(state, entity, "migration", now)?.id)
      .filter((tagId): tagId is string => Boolean(tagId));
  }
  state.relations = rebuildStoryRelations(state.stories, state.tags, now);
  return state;
}

function assertState(value: unknown): VideoIntelligenceState {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error("Unsupported video intelligence state");
  }
  const candidate = value as StateCandidate;
  if (!hasCoreCollections(candidate)) {
    throw new Error("Malformed video intelligence state");
  }
  if (candidate.schemaVersion === 1) {
    return migrateVideoIntelligenceState(
      candidate as unknown as LegacyVideoIntelligenceState,
    );
  }
  if (
    candidate.schemaVersion === 2 &&
    Array.isArray(candidate.tags) &&
    Array.isArray(candidate.relations)
  ) {
    return candidate as unknown as VideoIntelligenceState;
  }
  throw new Error("Unsupported video intelligence state");
}

export function createVideoIntelligenceStore(
  statePath = resolveVideoIntelligenceStatePath(),
) {
  let writeChain = Promise.resolve();

  async function readState(): Promise<VideoIntelligenceState> {
    try {
      return assertState(JSON.parse(await readFile(statePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return cloneEmptyState();
      }
      throw error;
    }
  }

  async function persist(state: VideoIntelligenceState): Promise<void> {
    state.revision += 1;
    state.updatedAt = new Date().toISOString();
    await mkdir(dirname(statePath), { recursive: true });
    const temporaryPath = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, statePath);
  }

  function mutate<T>(
    operation: (state: VideoIntelligenceState) => T | Promise<T>,
  ): Promise<T> {
    const result = writeChain.then(async () => {
      const state = await readState();
      const value = await operation(state);
      await persist(state);
      return value;
    });
    writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    statePath,
    readState,
    async readProjection(): Promise<VideoIntelligenceState> {
      return readState();
    },
    enqueue(input: { videoId: string; title: string }): Promise<VideoIngestJob> {
      return mutate((state) => {
        const now = new Date().toISOString();
        const job: VideoIngestJob = {
          id: `job-${randomUUID()}`,
          videoId: input.videoId,
          title: input.title,
          status: "queued",
          createdAt: now,
          updatedAt: now,
        };
        state.jobs.unshift(job);
        state.jobs = state.jobs.slice(0, 250);
        return job;
      });
    },
    updateJob(
      jobId: string,
      update: Partial<
        Pick<
          VideoIngestJob,
          "status" | "threadId" | "dossierId" | "error"
        >
      >,
    ): Promise<VideoIngestJob> {
      return mutate((state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId);
        if (!job) throw new Error(`Unknown video intelligence job: ${jobId}`);
        Object.assign(job, update, { updatedAt: new Date().toISOString() });
        return job;
      });
    },
    complete(
      jobId: string,
      analysis: VideoIntelligenceAnalysis,
      threadId: string,
    ): Promise<VideoDossier> {
      return mutate((state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId);
        if (!job) throw new Error(`Unknown video intelligence job: ${jobId}`);
        const now = new Date().toISOString();
        const dossierId = `youtube-${job.videoId}`;
        const previous = state.dossiers.find(
          (candidate) => candidate.id === dossierId,
        );
        const previousStoryIds = state.contributions
          .filter((contribution) => contribution.dossierId === dossierId)
          .map((contribution) => contribution.storyId);
        const storyIds: string[] = [];

        state.contributions = state.contributions.filter(
          (contribution) => contribution.dossierId !== dossierId,
        );

        for (const extractedStory of analysis.stories) {
          const tagIds = extractedStory.tags
            .map(
              (tagName) =>
                addTag(
                  state,
                  tagName,
                  "analysis",
                  now,
                  dossierId,
                )?.id,
            )
            .filter((tagId): tagId is string => Boolean(tagId));
          let story = matchStory(extractedStory, state.stories);
          if (!story) {
            story = {
              id: `story-${hash(
                `${extractedStory.title}|${extractedStory.eventDate ?? ""}`,
              )}`,
              title: extractedStory.title,
              summary: extractedStory.summary,
              eventDate: extractedStory.eventDate,
              entities: extractedStory.entities,
              tagIds: [...new Set(tagIds)],
              status: "provisional",
              createdAt: now,
              updatedAt: now,
            };
            state.stories.push(story);
          } else {
            story.updatedAt = now;
            story.entities = [
              ...new Set([...story.entities, ...extractedStory.entities]),
            ];
            story.tagIds = [...new Set([...story.tagIds, ...tagIds])];
          }
          storyIds.push(story.id);
          const contributionId = `contribution-${hash(
            `${dossierId}|${story.id}`,
          )}`;
          state.contributions.push({
            id: contributionId,
            storyId: story.id,
            dossierId,
            frame: extractedStory.frame,
            summary: extractedStory.summary,
            claims: extractedStory.claims.map((claim) => {
              const sourceUrl = `https://www.youtube.com/watch?v=${job.videoId}`;
              return {
                ...claim,
                evidence: {
                  ...claim.evidence,
                  videoId: job.videoId,
                  sourceUrl,
                  sourceStatus: analysis.sourceStatus,
                  sourceKind:
                    analysis.sourceStatus === "TRANSCRIPT_USED"
                      ? ("transcript" as const)
                      : ("page-owned" as const),
                },
                id: `claim-${hash(
                  `${contributionId}|${claim.statement}|${claim.evidence.timestamp ?? ""}`,
                )}`,
              };
            }),
          });
        }

        const relatedStoryIds = state.dossiers
          .filter(
            (candidate) =>
              candidate.id !== dossierId &&
              candidate.storyIds.some((storyId) => storyIds.includes(storyId)),
          )
          .flatMap((candidate) =>
            candidate.storyIds.filter((storyId) => storyIds.includes(storyId)),
          );
        const dossier: VideoDossier = {
          id: dossierId,
          videoId: job.videoId,
          canonicalUrl: `https://www.youtube.com/watch?v=${job.videoId}`,
          title: job.title,
          publisher: analysis.publisher,
          publishedAt: analysis.publishedAt,
          summary: analysis.summary,
          sourceStatus: analysis.sourceStatus,
          sourceNote: analysis.sourceNote,
          threadId,
          storyIds,
          duplicateIngestCount: (previous?.duplicateIngestCount ?? 0) + 1,
          relatedStoryIds: [...new Set(relatedStoryIds)],
          projectRelevance: analysis.projectRelevance,
          clickbait: analysis.clickbait,
          keyPoints: analysis.keyPoints,
          recommendation: analysis.recommendation,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        };
        state.dossiers = [
          dossier,
          ...state.dossiers.filter((candidate) => candidate.id !== dossierId),
        ];
        for (const storyId of new Set([...previousStoryIds, ...storyIds])) {
          const hasContributions = state.contributions.some(
            (contribution) => contribution.storyId === storyId,
          );
          state.aggregates = state.aggregates.filter(
            (candidate) => candidate.storyId !== storyId,
          );
          if (!hasContributions) {
            state.stories = state.stories.filter(
              (candidate) => candidate.id !== storyId,
            );
            continue;
          }
          state.aggregates.unshift(
            rebuildStoryAggregate(storyId, state.contributions, now),
          );
        }
        const usedTagIds = new Set(
          state.stories.flatMap((story) => story.tagIds),
        );
        state.tags = state.tags.filter((tag) => usedTagIds.has(tag.id));
        state.relations = rebuildStoryRelations(
          state.stories,
          state.tags,
          now,
        );
        Object.assign(job, {
          status: "succeeded" as const,
          threadId,
          dossierId,
          error: undefined,
          updatedAt: now,
        });
        return dossier;
      });
    },
    fail(
      jobId: string,
      error: string,
      threadId?: string,
    ): Promise<VideoIngestJob> {
      return mutate((state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId);
        if (!job) throw new Error(`Unknown video intelligence job: ${jobId}`);
        Object.assign(job, {
          status: "failed" as const,
          error,
          threadId,
          updatedAt: new Date().toISOString(),
        });
        return job;
      });
    },
  };
}
