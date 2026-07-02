/**
 * Feed Scout projection model.
 * Inputs are local `.farplane/feed-scout/daily/latest.json` payloads; outputs
 * are render-safe summary, group, source, item, gap, and report references.
 */

import type {
  FeedScoutActionability,
  FeedScoutConfig,
  FeedScoutDailyFeed,
  FeedScoutEmbed,
  FeedScoutEntityConfig,
  FeedScoutGroup,
  FeedScoutItem,
  FeedScoutItemCategory,
  FeedScoutReportRef,
  FeedScoutSource,
  FeedScoutSourceConfig,
  FeedScoutSourceGap,
  FeedScoutSummary,
  FeedScoutTodayDelta,
} from "./feed-scout-types";

export type {
  FeedScoutActionability,
  FeedScoutConfig,
  FeedScoutDailyFeed,
  FeedScoutEmbed,
  FeedScoutEntityConfig,
  FeedScoutGroup,
  FeedScoutItem,
  FeedScoutItemCategory,
  FeedScoutReportRef,
  FeedScoutSource,
  FeedScoutSourceConfig,
  FeedScoutSourceGap,
  FeedScoutSummary,
  FeedScoutTodayDelta,
} from "./feed-scout-types";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  const normalized = stringValue(value).trim();
  return normalized ? normalized : undefined;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return record(value) ?? undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  const source = record(value);
  if (!source) return undefined;
  const entries = Object.entries(source)
    .map(([key, entry]) => [key, stringValue(entry).trim()] as const)
    .filter(([, entry]) => entry.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => stringValue(entry).trim()).filter(Boolean))];
}

function parseSummary(value: unknown): FeedScoutSummary {
  const summary = record(value) ?? {};
  return {
    acquisition: optionalString(summary.acquisition),
    actionableItemCount: numberValue(summary.actionable_item_count ?? summary.actionableItemCount),
    changedItemCount: numberValue(summary.changed_item_count ?? summary.changedItemCount),
    groupCount: numberValue(summary.group_count ?? summary.groupCount),
    sourceCount: numberValue(summary.source_count ?? summary.sourceCount),
    itemCount: numberValue(summary.item_count ?? summary.itemCount),
    newItemCount: numberValue(summary.new_item_count ?? summary.newItemCount),
    sourceGapCount: numberValue(summary.source_gap_count ?? summary.sourceGapCount),
  };
}

function parseActionability(value: unknown): FeedScoutActionability | undefined {
  const actionability = record(value);
  if (!actionability) return undefined;
  const label = optionalString(actionability.label);
  if (!label) return undefined;
  return {
    label,
    reason: optionalString(actionability.reason),
  };
}

function parseTodayDelta(value: unknown): FeedScoutTodayDelta | undefined {
  const delta = record(value);
  if (!delta) return undefined;
  const kind = optionalString(delta.kind);
  if (!kind) return undefined;
  return {
    kind,
    observedAt: optionalString(delta.observed_at ?? delta.observedAt),
    previousObservedAt: optionalString(delta.previous_observed_at ?? delta.previousObservedAt),
    before: delta.before,
    after: delta.after,
    delta: delta.delta,
    confidence: optionalString(delta.confidence),
  };
}

function parseEmbed(value: unknown): FeedScoutEmbed | undefined {
  const embed = record(value);
  if (!embed) return undefined;
  const url = optionalString(embed.url);
  if (!url) return undefined;
  return {
    provider: optionalString(embed.provider) ?? "web",
    cardType: optionalString(embed.card_type ?? embed.cardType) ?? "bookmark",
    url,
    imageUrl: optionalString(embed.image_url ?? embed.imageUrl),
    title: optionalString(embed.title),
    byline: optionalString(embed.byline),
  };
}

function parseSources(value: unknown): FeedScoutSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): FeedScoutSource | null => {
      const source = record(entry);
      if (!source) return null;
      const id = stringValue(source.id).trim();
      if (!id) return null;
      return {
        id,
        name: stringValue(source.name).trim() || id,
        kind: stringValue(source.kind).trim() || "source",
        fetchMethod: stringValue(source.fetch_method ?? source.fetchMethod).trim() || "unknown",
        itemCount: numberValue(source.item_count ?? source.itemCount),
        enabled: booleanValue(source.enabled, true),
      };
    })
    .filter((source): source is FeedScoutSource => Boolean(source));
}

function parseGroups(value: unknown): FeedScoutGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): FeedScoutGroup | null => {
      const group = record(entry);
      if (!group) return null;
      const id = stringValue(group.id).trim();
      if (!id) return null;
      return {
        id,
        name: stringValue(group.name).trim() || id,
        kind: stringValue(group.kind).trim() || "entity",
        tags: stringList(group.tags),
        itemCount: numberValue(group.item_count ?? group.itemCount),
        sources: parseSources(group.sources),
      };
    })
    .filter((group): group is FeedScoutGroup => Boolean(group));
}

function parseItems(value: unknown): FeedScoutItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): FeedScoutItem | null => {
      const item = record(entry);
      if (!item) return null;
      const canonicalKey = stringValue(item.canonical_key ?? item.canonicalKey).trim();
      const title = stringValue(item.title).trim();
      if (!canonicalKey || !title) return null;
      return {
        actionability: parseActionability(item.actionability),
        canonicalKey,
        canonicalUrl: optionalString(item.canonical_url ?? item.canonicalUrl),
        author: optionalString(item.author),
        contentHash: optionalString(item.content_hash ?? item.contentHash),
        embed: parseEmbed(item.embed),
        entityGroupId: stringValue(item.entity_group_id ?? item.entityGroupId).trim(),
        entityGroupName: stringValue(item.entity_group_name ?? item.entityGroupName).trim(),
        sourceId: stringValue(item.source_id ?? item.sourceId).trim(),
        sourceName: stringValue(item.source_name ?? item.sourceName).trim(),
        platform: stringValue(item.platform).trim() || "unknown",
        nativeId: optionalString(item.native_id ?? item.nativeId),
        kind: stringValue(item.kind).trim() || "item",
        relationship: optionalString(item.relationship),
        rank: optionalNumber(item.rank),
        signal: optionalString(item.signal),
        interestPromptRef: stringRecord(item.interest_prompt_ref ?? item.interestPromptRef),
        novelty: optionalString(item.novelty),
        profileId: optionalString(item.profile_id ?? item.profileId),
        title,
        summary: optionalString(item.summary),
        sourceSnapshot: optionalRecord(item.source_snapshot ?? item.sourceSnapshot),
        todayDelta: parseTodayDelta(item.today_delta ?? item.todayDelta),
        whyCareToday: optionalString(item.why_care_today ?? item.whyCareToday),
        publishedAt: optionalString(item.published_at ?? item.publishedAt),
        discoveredAt: optionalString(item.discovered_at ?? item.discoveredAt),
        status: stringValue(item.status).trim() || "unknown",
        evidenceRefs: stringList(item.evidence_refs ?? item.evidenceRefs),
        tags: stringList(item.tags),
      };
    })
    .filter((item): item is FeedScoutItem => Boolean(item))
    .sort(
      (left, right) =>
        (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY) ||
        dateMs(right.publishedAt) - dateMs(left.publishedAt),
    );
}

function parseSourceGaps(value: unknown): FeedScoutSourceGap[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index): FeedScoutSourceGap | null => {
      if (typeof entry === "string" && entry.trim()) {
        return {
          id: `source-gap:${index + 1}`,
          title: `Source gap ${index + 1}`,
          detail: entry.trim(),
        };
      }
      const gap = record(entry);
      if (!gap) return null;
      const sourceId = optionalString(gap.source_id ?? gap.sourceId);
      const entityGroupId = optionalString(gap.entity_group_id ?? gap.entityGroupId);
      const title =
        optionalString(gap.title) ??
        optionalString(gap.name) ??
        sourceId ??
        entityGroupId ??
        `source gap ${index + 1}`;
      return {
        id: optionalString(gap.id) ?? `${entityGroupId ?? "group"}:${sourceId ?? index}`,
        entityGroupId,
        sourceId,
        title,
        detail: optionalString(gap.detail ?? gap.reason ?? gap.message) ?? "Needs source review.",
        severity: optionalString(gap.severity ?? gap.status),
      };
    })
    .filter((gap): gap is FeedScoutSourceGap => Boolean(gap));
}

function parseReportRef(feed: Record<string, unknown>, latestReport: unknown): FeedScoutReportRef {
  const latest = record(latestReport) ?? {};
  return {
    dailyFeedPath: optionalString(latest.daily_feed_path ?? latest.dailyFeedPath),
    reportPath:
      optionalString(latest.report_path ?? latest.reportPath) ??
      optionalString(feed.report_ref ?? feed.reportRef),
    latestReportPath: optionalString(feed.latest_report_ref ?? feed.latestReportRef),
    generatedAt:
      optionalString(latest.generated_at ?? latest.generatedAt) ??
      optionalString(feed.generated_at ?? feed.generatedAt),
  };
}

function parseSourceConfig(key: string, value: unknown): FeedScoutSourceConfig | null {
  const source = record(value);
  if (!source || !key.trim()) return null;
  return {
    key: key.trim(),
    name: stringValue(source.name).trim() || key.trim(),
    kind: stringValue(source.kind).trim() || "source",
    url: optionalString(source.url),
    fetchMethod: stringValue(source.fetch_method ?? source.fetchMethod).trim() || "unknown",
    contentKinds: stringList(source.content_kinds ?? source.contentKinds),
    watchPaths: stringList(source.watch_paths ?? source.watchPaths),
    minSignal: optionalString(source.min_signal ?? source.minSignal),
    enabled: booleanValue(source.enabled, true),
  };
}

function parseSourceConfigMap(value: unknown): FeedScoutSourceConfig[] {
  const sources = record(value);
  if (!sources) return [];
  return Object.entries(sources)
    .map(([key, source]) => parseSourceConfig(key, source))
    .filter((source): source is FeedScoutSourceConfig => Boolean(source));
}

function parseEntityConfig(key: string, value: unknown): FeedScoutEntityConfig | null {
  const entity = record(value);
  if (!entity || !key.trim()) return null;
  return {
    key: key.trim(),
    name: stringValue(entity.name).trim() || key.trim(),
    kind: stringValue(entity.kind).trim() || "entity",
    tags: stringList(entity.tags),
    enabled: booleanValue(entity.enabled, true),
    sources: parseSourceConfigMap(entity.sources),
  };
}

function dateMs(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseFeedScoutConfig(value: unknown): FeedScoutConfig | null {
  const config = record(value);
  if (!config) return null;
  const entities = record(config.entities);
  if (!entities) return null;
  return {
    enabled: booleanValue(config.enabled, true),
    cadence: optionalString(config.cadence),
    timezone: optionalString(config.timezone),
    latestFeed: optionalString(record(config.ui)?.latest_feed ?? record(config.ui)?.latestFeed),
    latestReport: optionalString(config.latest_report ?? config.latestReport),
    entities: Object.entries(entities)
      .map(([key, entity]) => parseEntityConfig(key, entity))
      .filter((entity): entity is FeedScoutEntityConfig => Boolean(entity)),
  };
}

export function parseFeedScoutDailyFeed(
  value: unknown,
  latestReport?: unknown,
): FeedScoutDailyFeed | null {
  const feed = record(value);
  if (!feed) return null;
  const schema = stringValue(feed.schema).trim();
  const generatedAt = stringValue(feed.generated_at ?? feed.generatedAt).trim();
  const date = stringValue(feed.date).trim();
  const sourceGaps = feed.source_gaps ?? feed.sourceGaps;
  if (!schema || !generatedAt || !date) return null;
  if (!Array.isArray(feed.groups) || !Array.isArray(feed.items) || !Array.isArray(sourceGaps)) {
    return null;
  }
  return {
    schema,
    schemaVersion: stringValue(feed.schema_version ?? feed.schemaVersion).trim(),
    date,
    generatedAt,
    configRef: optionalString(feed.config_ref ?? feed.configRef),
    reviewWindow: optionalString(feed.review_window ?? feed.reviewWindow),
    summary: parseSummary(feed.summary),
    groups: parseGroups(feed.groups),
    items: parseItems(feed.items),
    sourceGaps: parseSourceGaps(sourceGaps),
    reportRef: parseReportRef(feed, latestReport),
  };
}

export function getFeedScoutItemCategory(item: FeedScoutItem): FeedScoutItemCategory {
  const kind = item.kind.trim().toLowerCase();
  const platform = item.platform.trim().toLowerCase();
  if (platform === "local_git" || kind === "repo_change" || kind === "skill_change") {
    return "internal";
  }
  return "external";
}

export function filterFeedScoutItemsForProject(
  items: FeedScoutItem[],
  project: { projectId?: string | null; projectName?: string | null },
): FeedScoutItem[] {
  const projectName = normalizeFeedScoutText(project.projectName ?? "");
  const projectId = normalizeFeedScoutText(project.projectId ?? "");
  if (!projectName && !projectId) return items;
  return items.filter((item) => {
    const sourceName = normalizeFeedScoutText(item.sourceName);
    const sourceId = normalizeFeedScoutText(item.sourceId);
    const groupName = normalizeFeedScoutText(item.entityGroupName);
    const groupId = normalizeFeedScoutText(item.entityGroupId);
    return (
      sourceName === projectName ||
      sourceId === projectId ||
      groupName === projectName ||
      groupId === projectId
    );
  });
}

export function normalizeFeedScoutText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function uniqueFeedScoutValues<T extends FeedScoutItem>(
  items: T[],
  selector: (item: T) => string,
): string[] {
  return [...new Set(items.map((item) => selector(item).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
