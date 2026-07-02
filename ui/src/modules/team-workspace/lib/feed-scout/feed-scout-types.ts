/**
 * Feed Scout projection types.
 * Kept separate from parser logic so the model file stays under source-size guardrails.
 */

export type FeedScoutSummary = {
  acquisition?: string;
  actionableItemCount: number;
  changedItemCount: number;
  groupCount: number;
  sourceCount: number;
  itemCount: number;
  newItemCount: number;
  sourceGapCount: number;
};

export type FeedScoutSource = {
  id: string;
  name: string;
  kind: string;
  fetchMethod: string;
  itemCount: number;
  enabled: boolean;
};

export type FeedScoutGroup = {
  id: string;
  name: string;
  kind: string;
  tags: string[];
  itemCount: number;
  sources: FeedScoutSource[];
};

export type FeedScoutItem = {
  actionability?: FeedScoutActionability;
  canonicalKey: string;
  canonicalUrl?: string;
  author?: string;
  contentHash?: string;
  embed?: FeedScoutEmbed;
  entityGroupId: string;
  entityGroupName: string;
  sourceId: string;
  sourceName: string;
  platform: string;
  nativeId?: string;
  kind: string;
  relationship?: string;
  rank?: number;
  signal?: string;
  interestPromptRef?: Record<string, string>;
  novelty?: string;
  profileId?: string;
  title: string;
  summary?: string;
  sourceSnapshot?: Record<string, unknown>;
  todayDelta?: FeedScoutTodayDelta;
  whyCareToday?: string;
  publishedAt?: string;
  discoveredAt?: string;
  status: string;
  evidenceRefs: string[];
  tags: string[];
};

export type FeedScoutActionability = {
  label: string;
  reason?: string;
};

export type FeedScoutTodayDelta = {
  kind: string;
  observedAt?: string;
  previousObservedAt?: string;
  before?: unknown;
  after?: unknown;
  delta?: unknown;
  confidence?: string;
};

export type FeedScoutEmbed = {
  provider: string;
  cardType: string;
  url: string;
  imageUrl?: string;
  title?: string;
  byline?: string;
};

export type FeedScoutItemCategory = "external" | "internal";

export type FeedScoutSourceGap = {
  id: string;
  entityGroupId?: string;
  sourceId?: string;
  title: string;
  detail: string;
  severity?: string;
};

export type FeedScoutReportRef = {
  dailyFeedPath?: string;
  reportPath?: string;
  latestReportPath?: string;
  generatedAt?: string;
};

export type FeedScoutSourceConfig = {
  key: string;
  name: string;
  kind: string;
  url?: string;
  fetchMethod: string;
  contentKinds: string[];
  watchPaths: string[];
  minSignal?: string;
  enabled: boolean;
};

export type FeedScoutEntityConfig = {
  key: string;
  name: string;
  kind: string;
  tags: string[];
  enabled: boolean;
  sources: FeedScoutSourceConfig[];
};

export type FeedScoutConfig = {
  enabled: boolean;
  cadence?: string;
  timezone?: string;
  latestFeed?: string;
  latestReport?: string;
  entities: FeedScoutEntityConfig[];
};

export type FeedScoutDailyFeed = {
  schema: string;
  schemaVersion: string;
  date: string;
  generatedAt: string;
  configRef?: string;
  reviewWindow?: string;
  summary: FeedScoutSummary;
  groups: FeedScoutGroup[];
  items: FeedScoutItem[];
  sourceGaps: FeedScoutSourceGap[];
  reportRef: FeedScoutReportRef;
};
