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

export type VideoDossier = {
  id: string;
  videoId: string;
  canonicalUrl: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  summary: string;
  sourceStatus: "TRANSCRIPT_USED" | "SUMMARY_ONLY" | "RESOURCE_BANK";
  sourceNote: string;
  threadId: string;
  storyIds: string[];
  duplicateIngestCount: number;
  relatedStoryIds: string[];
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
  } | null;
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
  } | null;
  legacy: boolean;
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

export type StoryContribution = {
  id: string;
  storyId: string;
  dossierId: string;
  frame: string;
  summary: string;
  claims: {
    id: string;
    statement: string;
    stance: ClaimStance;
    evidence: EvidenceAnchor;
  }[];
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

export type VideoIntelligenceProjection = {
  schemaVersion: 3;
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

export type VideoIntelligencePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVideoId?: string;
};
