/**
 * Pure Video Intelligence domain logic: URL identity, conservative story matching,
 * aggregate rebuilding, and relation derivation. It performs no database writes.
 */
import type { Infer } from "convex/values";
import { extractYouTubeVideoId } from "../content/identifiers";
import type {
  extractedStoryValidator,
  reportingClaimValidator,
  videoAnalysisValidator,
} from "./validators";

export { extractYouTubeVideoId } from "../content/identifiers";

export type ExtractedStory = Infer<typeof extractedStoryValidator>;
export type ReportingClaim = Infer<typeof reportingClaimValidator> & { id: string };
export type VideoAnalysis = Infer<typeof videoAnalysisValidator>;

export type StoryShape = {
  id: string;
  title: string;
  summary: string;
  eventDate?: string;
  entities: string[];
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ContributionShape = {
  id: string;
  storyId: string;
  dossierId: string;
  frame: string;
  summary: string;
  claims: ReportingClaim[];
};

export type TagShape = {
  id: string;
  canonicalName: string;
  normalizedKey: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "for",
  "from",
  "how",
  "in",
  "is",
  "of",
  "on",
  "the",
  "this",
  "to",
  "why",
  "with",
]);

const GENERIC_TAG_KEYS = new Set(["analysis", "news", "story", "update", "video"]);

function normalizeToken(token: string): string {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (
    token.length > 5 &&
    ["ches", "shes", "xes", "zes", "ses"].some((ending) => token.endsWith(ending))
  ) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function normalizeTagKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .join(" ");
}

function normalizedTokens(value: string): Set<string> {
  return new Set(
    normalizeTagKey(value)
      .split(" ")
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function similarity(left: string, right: string): number {
  const a = normalizedTokens(left);
  const b = normalizedTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function entitySimilarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const a = new Set(left.map(normalizeTagKey));
  const b = new Set(right.map(normalizeTagKey));
  const intersection = [...a].filter((value) => b.has(value)).length;
  return intersection / new Set([...a, ...b]).size;
}

function datesConflict(left: string | null, right?: string): boolean {
  if (!left || !right) return false;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
  return Math.abs(leftMs - rightMs) > 7 * 86_400_000;
}

export function matchStory<T extends StoryShape>(input: ExtractedStory, stories: T[]): T | null {
  let match: { story: T; score: number } | null = null;
  for (const story of stories) {
    if (datesConflict(input.eventDate, story.eventDate)) continue;
    const score =
      similarity(input.title, story.title) * 0.72 +
      entitySimilarity(input.entities, story.entities) * 0.28;
    if (score >= 0.5 && (!match || score > match.score)) match = { story, score };
  }
  return match?.story ?? null;
}

export function rebuildStoryAggregate(
  storyId: string,
  contributions: ContributionShape[],
  now = new Date().toISOString(),
) {
  const storyContributions = contributions.filter(
    (contribution) => contribution.storyId === storyId,
  );
  const clusters: {
    statement: string;
    members: { dossierId: string; claim: ReportingClaim }[];
  }[] = [];
  for (const contribution of storyContributions) {
    for (const claim of contribution.claims) {
      const cluster = clusters.find(
        (candidate) => similarity(candidate.statement, claim.statement) >= 0.55,
      );
      if (cluster) cluster.members.push({ dossierId: contribution.dossierId, claim });
      else {
        clusters.push({
          statement: claim.statement,
          members: [{ dossierId: contribution.dossierId, claim }],
        });
      }
    }
  }
  const sharedClusters = clusters.filter(
    (cluster) => new Set(cluster.members.map((member) => member.dossierId)).size > 1,
  );
  const sharedClaimIds = new Set(
    sharedClusters.flatMap((cluster) => cluster.members.map((member) => member.claim.id)),
  );
  return {
    storyId,
    perspectiveCount: storyContributions.length,
    sourceCount: new Set(storyContributions.map((item) => item.dossierId)).size,
    sharedClaims: sharedClusters.map((cluster) => ({
      statement: cluster.statement,
      sourceDossierIds: [...new Set(cluster.members.map((member) => member.dossierId))],
      evidence: cluster.members.map((member) => member.claim.evidence),
    })),
    distinctClaims: storyContributions.flatMap((contribution) =>
      contribution.claims
        .filter((claim) => !sharedClaimIds.has(claim.id))
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

export function rebuildStoryRelations(
  stories: StoryShape[],
  tags: TagShape[],
  now = new Date().toISOString(),
) {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const relations = [];
  for (let leftIndex = 0; leftIndex < stories.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < stories.length; rightIndex += 1) {
      const left = stories[leftIndex];
      const right = stories[rightIndex];
      if (!left || !right) continue;
      const supportingTagIds = left.tagIds.filter(
        (tagId) =>
          right.tagIds.includes(tagId) &&
          !GENERIC_TAG_KEYS.has(tagById.get(tagId)?.normalizedKey ?? ""),
      );
      const rightEntities = new Set(right.entities.map(normalizeTagKey));
      const supportingEntityNames = left.entities.filter((entity) =>
        rightEntities.has(normalizeTagKey(entity)),
      );
      if (
        !(
          (supportingTagIds.length >= 1 && supportingEntityNames.length >= 1) ||
          supportingEntityNames.length >= 2
        )
      ) {
        continue;
      }
      const [from, to] = orderStories(left, right);
      relations.push({
        id: `related:${from.id}:${to.id}`,
        fromStoryId: from.id,
        toStoryId: to.id,
        kind: "related" as const,
        provenance: "derived" as const,
        supportingTagIds: [...new Set(supportingTagIds)],
        supportingEntityNames: [...new Set(supportingEntityNames)],
        confidence: Math.min(
          0.9,
          0.5 + supportingTagIds.length * 0.12 + supportingEntityNames.length * 0.1,
        ),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return relations;
}

function orderStories<T extends StoryShape>(left: T, right: T): [T, T] {
  const leftTime = Date.parse(left.eventDate ?? left.createdAt);
  const rightTime = Date.parse(right.eventDate ?? right.createdAt);
  if (leftTime === rightTime)
    return left.id.localeCompare(right.id) <= 0 ? [left, right] : [right, left];
  return leftTime <= rightTime ? [left, right] : [right, left];
}

export function youtubeUrlVariants(videoId: string): string[] {
  return [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://www.youtube.com/shorts/${videoId}`,
  ];
}

export function filterYouTubeAssets<T extends { canonicalUrl?: string; sourceUrl?: string }>(
  assets: T[],
): T[] {
  return assets.filter((asset) =>
    Boolean(extractYouTubeVideoId(asset.canonicalUrl ?? asset.sourceUrl)),
  );
}

export function findYouTubeAssetByVideoId<T extends { canonicalUrl?: string; sourceUrl?: string }>(
  assets: T[],
  videoId: string,
): T | undefined {
  return assets.find(
    (asset) => extractYouTubeVideoId(asset.canonicalUrl ?? asset.sourceUrl) === videoId,
  );
}

export function analysisMarkdown(analysis: VideoAnalysis): string {
  const storySections = (analysis.news?.candidates ?? []).map((story) => {
    const claims = story.claims.map((claim) => `- ${claim.statement}`).join("\n");
    return `## ${story.title}\n\n${story.summary}\n\n${claims}`;
  });
  return [`# Video analysis`, analysis.summary, ...storySections].join("\n\n");
}
