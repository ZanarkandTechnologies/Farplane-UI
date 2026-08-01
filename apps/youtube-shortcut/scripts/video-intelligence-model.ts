/**
 * Durable local owner for Farplane video dossiers and story projections.
 * Browser code receives a read-only projection; all writes happen in the loopback bridge.
 */
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";

export type VideoJobStatus = "queued" | "running" | "succeeded" | "failed";
export type ClaimStance = "supports" | "opposes" | "neutral" | "unclear";

export type EvidenceAnchor = {
  videoId: string;
  sourceUrl: string;
  sourceStatus: "TRANSCRIPT_USED" | "SUMMARY_ONLY";
  sourceKind: "transcript" | "page-owned";
  timestamp: string | null;
  excerpt: string;
  schemaVersion: 2;
  extractorVersion: string;
};

export type ExtractedEvidence = {
  timestamp: string | null;
  excerpt: string;
  schemaVersion: 2;
  extractorVersion: string;
};

export type ExtractedClaim = {
  statement: string;
  stance: ClaimStance;
  evidence: ExtractedEvidence;
};

export type ExtractedStory = {
  title: string;
  summary: string;
  eventDate: string | null;
  entities: string[];
  tags: string[];
  frame: string;
  claims: ExtractedClaim[];
};

export type VideoIntelligenceAnalysis = {
  schemaVersion: 3;
  sourceStatus: "TRANSCRIPT_USED" | "SUMMARY_ONLY";
  sourceNote: string;
  summary: string;
  publisher: string | null;
  publishedAt: string | null;
  stories: ExtractedStory[];
  projectRelevance: {
    project: string;
    reason: string;
    confidence: number;
  }[];
  clickbait: {
    answer: string;
    verdict: "DELIVERED" | "PARTIAL" | "BAIT" | "UNVERIFIABLE";
    confidence: number;
    evidence: string[];
  };
  keyPoints: {
    finding: string;
    detail: string | null;
    timestamp: string | null;
  }[];
  recommendation: {
    decision: "WATCH" | "READ" | "SKIP";
    personalRelevance: number | null;
    contentQuality: number;
    reasonCode: string;
    rationale: string;
    matchedProfile: string[];
  };
};

export type VideoIngestJob = {
  id: string;
  videoId: string;
  title: string;
  status: VideoJobStatus;
  threadId?: string;
  dossierId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReportingClaim = ExtractedClaim & {
  id: string;
  evidence: EvidenceAnchor;
};

export type StoryContribution = {
  id: string;
  storyId: string;
  dossierId: string;
  frame: string;
  summary: string;
  claims: ReportingClaim[];
};

export type VideoDossier = {
  id: string;
  videoId: string;
  canonicalUrl: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  summary: string;
  sourceStatus: VideoIntelligenceAnalysis["sourceStatus"];
  sourceNote: string;
  threadId: string;
  storyIds: string[];
  duplicateIngestCount: number;
  relatedStoryIds: string[];
  projectRelevance: VideoIntelligenceAnalysis["projectRelevance"];
  clickbait: VideoIntelligenceAnalysis["clickbait"];
  keyPoints: VideoIntelligenceAnalysis["keyPoints"];
  recommendation: VideoIntelligenceAnalysis["recommendation"];
  createdAt: string;
  updatedAt: string;
};

export type Story = {
  id: string;
  title: string;
  summary: string;
  eventDate: string | null;
  entities: string[];
  tagIds: string[];
  status: "provisional";
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  canonicalName: string;
  normalizedKey: string;
  aliases: string[];
  provenance: {
    source: "analysis" | "migration";
    dossierId?: string;
    firstSeenAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

export type StoryRelation = {
  id: string;
  fromStoryId: string;
  toStoryId: string;
  kind: "related";
  provenance: "derived";
  supportingTagIds: string[];
  supportingEntityNames: string[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
};

export type StoryAggregate = {
  storyId: string;
  perspectiveCount: number;
  sourceCount: number;
  sharedClaims: {
    statement: string;
    sourceDossierIds: string[];
    evidence: EvidenceAnchor[];
  }[];
  distinctClaims: {
    dossierId: string;
    statement: string;
    stance: ClaimStance;
    evidence: EvidenceAnchor;
  }[];
  frames: { dossierId: string; frame: string }[];
  updatedAt: string;
};

export type VideoIntelligenceState = {
  schemaVersion: 2;
  revision: number;
  jobs: VideoIngestJob[];
  dossiers: VideoDossier[];
  stories: Story[];
  tags: Tag[];
  relations: StoryRelation[];
  contributions: StoryContribution[];
  aggregates: StoryAggregate[];
  updatedAt: string;
};

const EMPTY_STATE: VideoIntelligenceState = {
  schemaVersion: 2,
  revision: 0,
  jobs: [],
  dossiers: [],
  stories: [],
  tags: [],
  relations: [],
  contributions: [],
  aggregates: [],
  updatedAt: new Date(0).toISOString(),
};

const GENERIC_TAG_KEYS = new Set([
  "analysis",
  "news",
  "story",
  "update",
  "video",
]);

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

export function resolveVideoIntelligenceStatePath(
  stateRoot =
    process.env.FARPLANE_STATE_DIR?.trim() ||
    process.env.FARPLANE_HOME?.trim() ||
    resolve(homedir(), ".farplane"),
): string {
  return resolve(stateRoot, "video-intelligence", "state.json");
}

export function cloneEmptyState(): VideoIntelligenceState {
  return JSON.parse(JSON.stringify(EMPTY_STATE)) as VideoIntelligenceState;
}

export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function normalizedTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
      .map((token) => normalizeToken(token)),
  );
}

function normalizeToken(token: string): string {
  if (token.length > 5 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (
    token.length > 5 &&
    ["ches", "shes", "xes", "zes", "ses"].some((ending) =>
      token.endsWith(ending),
    )
  ) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizeTagKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => normalizeToken(token))
    .join(" ");
}

export function addTag(
  state: VideoIntelligenceState,
  name: string,
  source: "analysis" | "migration",
  now: string,
  dossierId?: string,
): Tag | null {
  const canonicalName = name.trim().replace(/\s+/g, " ");
  const normalizedKey = normalizeTagKey(canonicalName);
  if (!normalizedKey) return null;
  const existing = state.tags.find(
    (candidate) => candidate.normalizedKey === normalizedKey,
  );
  const provenance = { source, dossierId, firstSeenAt: now };
  if (existing) {
    if (
      existing.canonicalName !== canonicalName &&
      !existing.aliases.includes(canonicalName)
    ) {
      existing.aliases.push(canonicalName);
    }
    if (
      !existing.provenance.some(
        (item) => item.source === source && item.dossierId === dossierId,
      )
    ) {
      existing.provenance.push(provenance);
    }
    existing.updatedAt = now;
    return existing;
  }
  const tag: Tag = {
    id: `tag-${hash(normalizedKey)}`,
    canonicalName,
    normalizedKey,
    aliases: [],
    provenance: [provenance],
    createdAt: now,
    updatedAt: now,
  };
  state.tags.push(tag);
  return tag;
}

function orderedStoryPair(
  left: Story,
  right: Story,
): [Story, Story] {
  const leftTime = Date.parse(left.eventDate ?? left.createdAt);
  const rightTime = Date.parse(right.eventDate ?? right.createdAt);
  if (leftTime === rightTime) {
    return left.id.localeCompare(right.id) <= 0
      ? [left, right]
      : [right, left];
  }
  return leftTime <= rightTime ? [left, right] : [right, left];
}

export function rebuildStoryRelations(
  stories: Story[],
  tags: Tag[],
  now = new Date().toISOString(),
): StoryRelation[] {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const relations: StoryRelation[] = [];
  for (let leftIndex = 0; leftIndex < stories.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < stories.length;
      rightIndex += 1
    ) {
      const left = stories[leftIndex];
      const right = stories[rightIndex];
      if (!left || !right) continue;
      const supportingTagIds = left.tagIds.filter(
        (tagId) =>
          right.tagIds.includes(tagId) &&
          !GENERIC_TAG_KEYS.has(tagById.get(tagId)?.normalizedKey ?? ""),
      );
      const rightEntities = new Set(
        right.entities.map((entity) => normalizeTagKey(entity)),
      );
      const supportingEntityNames = left.entities.filter((entity) =>
        rightEntities.has(normalizeTagKey(entity)),
      );
      const qualifies =
        (supportingTagIds.length >= 1 &&
          supportingEntityNames.length >= 1) ||
        supportingEntityNames.length >= 2;
      if (!qualifies) continue;
      const [from, to] = orderedStoryPair(left, right);
      relations.push({
        id: `relation-${hash(`${from.id}|${to.id}|related`)}`,
        fromStoryId: from.id,
        toStoryId: to.id,
        kind: "related",
        provenance: "derived",
        supportingTagIds: [...new Set(supportingTagIds)],
        supportingEntityNames: [...new Set(supportingEntityNames)],
        confidence: Math.min(
          0.9,
          0.5 +
            supportingTagIds.length * 0.12 +
            supportingEntityNames.length * 0.1,
        ),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return relations;
}
