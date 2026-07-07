// Pure Resource Bank reducers used by Convex functions and focused tests.

export const RESOURCE_BANK_TAG_LIMIT = 32;
export const RESOURCE_BANK_TEXT_LIMIT = 6_000;
export const RESOURCE_BANK_QUERY_LIMIT = 40;

export type ResourceBankAssetRow = {
  _id?: string;
  ingestionJobId?: string;
  parentAssetId?: string;
  title: string;
  assetKind: string;
  assetRole: string;
  platform?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: string;
  storageUrl?: string | null;
  localPath?: string;
  durationMs?: number;
  startMs?: number;
  endMs?: number;
  author?: string;
  attributionStatus?: string;
  outputTypes: string[];
  audiences: string[];
  ageRanges: string[];
  industries: string[];
  customerRoles: string[];
  tastinessScore?: number;
  tags: string[];
  searchableText: string;
  projectId?: string;
  taskId?: string;
  retentionNote?: string;
  operatorNote?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceBankAnalysisRow = {
  _id?: string;
  assetId: string;
  analysisType: string;
  whyItWorks: string[];
  takeaways: string[];
  promptGuess?: string;
  remixConstraints: string[];
  embeddingText: string;
  tags: string[];
  createdAtMs: number;
};

export type ResourceBankSkillFindingRow = {
  _id?: string;
  assetId: string;
  findingKind: string;
  skillId?: string;
  label: string;
  capability: string;
  evidenceAnchor: string;
  howToReuse: string;
  suggestedSkillChange?: string;
  tags: string[];
  embeddingText: string;
  createdAtMs: number;
};

export type ResourceBankCreativeElementRow = {
  _id?: string;
  ingestionJobId?: string;
  assetId: string;
  analysisId?: string;
  kind:
    | "visual"
    | "audio"
    | "hook"
    | "storyboard"
    | "editing"
    | "copy"
    | "character"
    | "format"
    | "constraint";
  title: string;
  description: string;
  anchor?: string;
  pinned: boolean;
  embeddingText: string;
  tags: string[];
  projectId?: string;
  taskId?: string;
  createdAtMs: number;
};

export type ResourceBankAssetDetail = ResourceBankAssetRow & {
  analyses: ResourceBankAnalysisRow[];
  creativeElements: ResourceBankCreativeElementRow[];
  derivedAssets: ResourceBankAssetRow[];
  previewAsset?: ResourceBankAssetRow;
  skillFindings: ResourceBankSkillFindingRow[];
};

export type ResourceBankDashboard = {
  totals: {
    assetCount: number;
    creativeElementCount: number;
    skillFindingCount: number;
    latestSavedAt?: number;
  };
  assets: ResourceBankAssetDetail[];
  topTags: Array<{ tag: string; count: number }>;
  clusters: Array<{
    key: string;
    label: string;
    assetCount: number;
    skillFindingCount: number;
    tags: string[];
  }>;
};

export type TastyPackTimeframe = "past_day" | "past_week" | "past_month" | "past_90_days" | "all";

export type TastyPackFilters = {
  idea?: string;
  timeframe?: TastyPackTimeframe;
  startAtMs?: number;
  endAtMs?: number;
  tags?: readonly string[];
  outputType?: string;
  outputTypes?: readonly string[];
  audience?: string;
  audiences?: readonly string[];
  ageRanges?: readonly string[];
  industry?: string;
  industries?: readonly string[];
  customerRole?: string;
  customerRoles?: readonly string[];
  projectId?: string;
  taskId?: string;
};

export type ResolvedTastyPackFilters = {
  timeframe: TastyPackTimeframe;
  startAtMs?: number;
  endAtMs?: number;
  tags: string[];
  outputTypes: string[];
  audiences: string[];
  ageRanges: string[];
  industries: string[];
  customerRoles: string[];
  projectId?: string;
  taskId?: string;
};

export type TastyPackSource = {
  assetId?: string;
  title: string;
  savedAtMs: number;
  assetKind: string;
  platform?: string;
  tastinessScore?: number;
  tags: string[];
  outputTypes: string[];
  audiences: string[];
  ageRanges: string[];
  industries: string[];
  customerRoles: string[];
  sourceHandle?: string;
  attribution: {
    author?: string;
    status?: string;
    sourceUrl?: string;
    canonicalUrl?: string;
  };
};

export type TastyPackElement = {
  id?: string;
  kind: ResourceBankCreativeElementRow["kind"];
  title: string;
  description: string;
  anchor?: string;
  pinned: boolean;
  tags: string[];
};

export type TastyPackAnalysis = {
  operatorNote?: string;
  summary: string[];
  whySaved: string[];
  extractionLimits: string[];
};

export type TastyPackCapture = {
  captureId: string;
  source: TastyPackSource;
  analysis: TastyPackAnalysis;
  elements: TastyPackElement[];
};

export type TastyPack = {
  request: {
    idea?: string;
    timeframe: TastyPackTimeframe;
    startAtMs?: number;
    endAtMs?: number;
    filters: Omit<ResolvedTastyPackFilters, "timeframe" | "startAtMs" | "endAtMs">;
  };
  captures: TastyPackCapture[];
  meta: {
    captureCount: number;
    timeframe: TastyPackTimeframe;
    pinnedElementCount: number;
    operatorNoteCount: number;
    warnings: string[];
  };
};

export function cleanText(value: string | undefined, limit = 240): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

export function normalizeTag(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/[^a-z0-9:_/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || null;
}

export function normalizeTags(values: readonly string[] | undefined): string[] {
  const tags = new Set<string>();
  for (const value of values ?? []) {
    const normalized = normalizeTag(value);
    if (normalized) tags.add(normalized);
    if (tags.size >= RESOURCE_BANK_TAG_LIMIT) break;
  }
  return [...tags];
}

export function mergeTags(...groups: Array<readonly string[] | undefined>): string[] {
  return normalizeTags(groups.flatMap((group) => [...(group ?? [])]));
}

export function normalizeFacetValues(...groups: Array<readonly string[] | undefined>): string[] {
  return normalizeTags(groups.flatMap((group) => [...(group ?? [])]));
}

export function buildRetrievalTagPlan(input: { tags?: readonly string[]; outputType?: string }): {
  filterTags: string[];
  tagExpansions: string[];
} {
  const filterTags = normalizeTags(input.tags);
  const outputTags = input.outputType ? normalizeTags([`output:${input.outputType}`]) : [];
  return {
    filterTags,
    tagExpansions: mergeTags(filterTags, outputTags),
  };
}

export function clampLimit(limit: number | undefined, fallback = 24, max = 80): number {
  return Math.max(1, Math.min(max, Math.floor(limit ?? fallback)));
}

export function includesAllTags(
  rowTags: readonly string[],
  requiredTags: readonly string[],
): boolean {
  if (requiredTags.length === 0) return true;
  const rowTagSet = new Set(rowTags.map((tag) => tag.toLowerCase()));
  return requiredTags.every((tag) => rowTagSet.has(tag.toLowerCase()));
}

export function intersectsFacet(
  rowValues: readonly string[],
  requiredValues: readonly string[],
): boolean {
  if (requiredValues.length === 0) return true;
  const rowSet = new Set(rowValues.map((value) => value.toLowerCase()));
  return requiredValues.some((value) => rowSet.has(value.toLowerCase()));
}

export function resolveTastyPackFilters(
  input: TastyPackFilters,
  nowMs: number,
): ResolvedTastyPackFilters {
  const timeframe = input.timeframe ?? "past_week";
  const explicitStartAtMs = input.startAtMs;
  const timeframeStartAtMs =
    timeframe === "all"
      ? undefined
      : nowMs -
        (
          {
            past_day: 1,
            past_week: 7,
            past_month: 30,
            past_90_days: 90,
          } satisfies Record<Exclude<TastyPackTimeframe, "all">, number>
        )[timeframe] *
          24 *
          60 *
          60 *
          1000;

  return {
    timeframe,
    startAtMs: explicitStartAtMs ?? timeframeStartAtMs,
    endAtMs: input.endAtMs,
    tags: normalizeTags(input.tags),
    outputTypes: normalizeFacetValues(
      input.outputTypes,
      input.outputType ? [input.outputType] : undefined,
    ),
    audiences: normalizeFacetValues(input.audiences, input.audience ? [input.audience] : undefined),
    ageRanges: normalizeFacetValues(input.ageRanges),
    industries: normalizeFacetValues(
      input.industries,
      input.industry ? [input.industry] : undefined,
    ),
    customerRoles: normalizeFacetValues(
      input.customerRoles,
      input.customerRole ? [input.customerRole] : undefined,
    ),
    projectId: cleanText(input.projectId, 120),
    taskId: cleanText(input.taskId, 120),
  };
}

export function matchesTastyPackFilters(
  asset: ResourceBankAssetRow,
  filters: ResolvedTastyPackFilters,
): boolean {
  if (asset.assetRole !== "primary") return false;
  if (filters.startAtMs !== undefined && asset.createdAtMs < filters.startAtMs) return false;
  if (filters.endAtMs !== undefined && asset.createdAtMs > filters.endAtMs) return false;
  if (filters.projectId && asset.projectId !== filters.projectId) return false;
  if (filters.taskId && asset.taskId !== filters.taskId) return false;
  if (!includesAllTags(asset.tags, filters.tags)) return false;
  if (!intersectsFacet(asset.outputTypes, filters.outputTypes)) return false;
  if (!intersectsFacet(asset.audiences, filters.audiences)) return false;
  if (!intersectsFacet(asset.ageRanges, filters.ageRanges)) return false;
  if (!intersectsFacet(asset.industries, filters.industries)) return false;
  if (!intersectsFacet(asset.customerRoles, filters.customerRoles)) return false;
  return true;
}

export function buildTastyPack(input: {
  idea?: string;
  filters: ResolvedTastyPackFilters;
  assets: ResourceBankAssetRow[];
  analyses: ResourceBankAnalysisRow[];
  creativeElements: ResourceBankCreativeElementRow[];
}): TastyPack {
  const analysesByAsset = groupBy(input.analyses, (analysis) => analysis.assetId);
  const elementsByAsset = groupBy(input.creativeElements, (element) => element.assetId);
  const captures = input.assets.map((asset) => {
    const analyses = analysesByAsset.get(asset._id ?? "") ?? [];
    const elements = sortCreativeElementsForTastePack(elementsByAsset.get(asset._id ?? "") ?? []);
    return {
      captureId: asset._id ?? `asset-${asset.createdAtMs}`,
      source: toSource(asset),
      analysis: toAnalysisSummary(analyses, asset),
      elements: elements.map(toElement),
    };
  });
  const warnings = buildTastyPackWarnings(captures);

  return {
    request: {
      idea: cleanText(input.idea, 500),
      timeframe: input.filters.timeframe,
      startAtMs: input.filters.startAtMs,
      endAtMs: input.filters.endAtMs,
      filters: {
        tags: input.filters.tags,
        outputTypes: input.filters.outputTypes,
        audiences: input.filters.audiences,
        ageRanges: input.filters.ageRanges,
        industries: input.filters.industries,
        customerRoles: input.filters.customerRoles,
        projectId: input.filters.projectId,
        taskId: input.filters.taskId,
      },
    },
    captures,
    meta: {
      captureCount: captures.length,
      timeframe: input.filters.timeframe,
      pinnedElementCount: countPinnedElements(captures),
      operatorNoteCount: countOperatorNotes(captures),
      warnings,
    },
  };
}

export function sortCreativeElementsForTastePack(
  elements: readonly ResourceBankCreativeElementRow[],
): ResourceBankCreativeElementRow[] {
  return [...elements].sort(
    (left, right) =>
      Number(right.pinned) - Number(left.pinned) || right.createdAtMs - left.createdAtMs,
  );
}

export function countPinnedElements(captures: readonly TastyPackCapture[]): number {
  return captures.flatMap((capture) => capture.elements).filter((element) => element.pinned).length;
}

export function countOperatorNotes(captures: readonly TastyPackCapture[]): number {
  return captures.filter((capture) => capture.analysis.operatorNote).length;
}

export function buildTastyPackWarnings(captures: readonly TastyPackCapture[]): string[] {
  const elements = captures.flatMap((capture) => capture.elements);
  const pinnedElementCount = elements.filter((element) => element.pinned).length;
  const operatorNoteCount = captures.filter((capture) => capture.analysis.operatorNote).length;
  const warnings: string[] = [];
  if (captures.length === 0) {
    warnings.push("No saved captures matched the supplied filters.");
  } else if (elements.length === 0) {
    warnings.push("Pack has no creative elements to plan from.");
  }
  if (elements.length > 0 && pinnedElementCount === 0) {
    warnings.push("Pack has no pinned elements; treat extracted elements as context, not taste.");
  }
  if (operatorNoteCount > 0 && pinnedElementCount === 0) {
    warnings.push("Operator note exists, but no element was pinned from that stated taste.");
  }
  return warnings;
}

function sourceHandle(
  asset: Pick<ResourceBankAssetRow, "storageId" | "canonicalUrl" | "sourceUrl" | "localPath">,
): string | undefined {
  return asset.storageId ?? asset.canonicalUrl ?? asset.sourceUrl ?? asset.localPath;
}

function toSource(asset: ResourceBankAssetRow): TastyPackSource {
  return {
    assetId: asset._id,
    title: asset.title,
    savedAtMs: asset.createdAtMs,
    assetKind: asset.assetKind,
    platform: asset.platform,
    tastinessScore: asset.tastinessScore,
    tags: asset.tags,
    outputTypes: asset.outputTypes,
    audiences: asset.audiences,
    ageRanges: asset.ageRanges,
    industries: asset.industries,
    customerRoles: asset.customerRoles,
    sourceHandle: sourceHandle(asset),
    attribution: {
      author: asset.author,
      status: asset.attributionStatus,
      sourceUrl: asset.sourceUrl,
      canonicalUrl: asset.canonicalUrl,
    },
  };
}

function toElement(element: ResourceBankCreativeElementRow): TastyPackElement {
  return {
    id: element._id,
    kind: element.kind,
    title: element.title,
    description: element.description,
    anchor: element.anchor,
    pinned: element.pinned,
    tags: element.tags,
  };
}

function toAnalysisSummary(
  analyses: ResourceBankAnalysisRow[],
  asset?: ResourceBankAssetRow,
): TastyPackAnalysis {
  return {
    operatorNote: asset?.operatorNote,
    summary: analyses.flatMap((analysis) => analysis.whyItWorks).slice(0, 6),
    whySaved: analyses.flatMap((analysis) => analysis.takeaways).slice(0, 6),
    extractionLimits: analyses.flatMap((analysis) => analysis.remixConstraints).slice(0, 6),
  };
}

export function buildAssetSearchableText(input: {
  title: string;
  note?: string;
  requestedFocus?: string;
  sourceRef?: string;
  tags?: readonly string[];
}): string {
  return [input.title, input.note, input.requestedFocus, input.sourceRef, ...(input.tags ?? [])]
    .filter(Boolean)
    .join("\n")
    .slice(0, RESOURCE_BANK_TEXT_LIMIT);
}

export function buildAnalysisEmbeddingText(input: {
  facts?: readonly string[];
  frameNotes?: string;
  interpretation?: readonly string[];
  promptGuess?: string;
  remixConstraints?: readonly string[];
  takeaways?: readonly string[];
  transcriptText?: string;
  userIntent?: string;
  whyItWorks?: readonly string[];
}): string {
  return [
    "Facts",
    ...(input.facts ?? []),
    "User intent",
    input.userIntent,
    "Interpretation",
    ...(input.interpretation ?? []),
    "Why it works",
    ...(input.whyItWorks ?? []),
    "Takeaways",
    ...(input.takeaways ?? []),
    "Prompt guess",
    input.promptGuess,
    "Remix constraints",
    ...(input.remixConstraints ?? []),
    "Frame notes",
    input.frameNotes,
    "Transcript",
    input.transcriptText,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, RESOURCE_BANK_TEXT_LIMIT);
}

export function buildSkillFindingEmbeddingText(input: {
  label: string;
  capability: string;
  evidenceAnchor: string;
  howToReuse: string;
  suggestedSkillChange?: string;
  tags?: readonly string[];
}): string {
  return [
    input.label,
    input.capability,
    input.evidenceAnchor,
    input.howToReuse,
    input.suggestedSkillChange,
    ...(input.tags ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, RESOURCE_BANK_TEXT_LIMIT);
}

export function buildCreativeElementEmbeddingText(input: {
  title: string;
  description: string;
  anchor?: string;
  tags?: readonly string[];
}): string {
  return [input.title, input.description, input.anchor, ...(input.tags ?? [])]
    .filter(Boolean)
    .join("\n")
    .slice(0, RESOURCE_BANK_TEXT_LIMIT);
}

export function buildResourceBankDashboard(
  assets: ResourceBankAssetRow[],
  analyses: ResourceBankAnalysisRow[],
  creativeElements: ResourceBankCreativeElementRow[],
  skillFindings: ResourceBankSkillFindingRow[],
): ResourceBankDashboard {
  const analysesByAsset = groupBy(analyses, (analysis) => analysis.assetId);
  const elementsByAsset = groupBy(creativeElements, (element) => element.assetId);
  const findingsByAsset = groupBy(skillFindings, (finding) => finding.assetId);
  const derivedByParent = groupBy(
    assets.filter((asset) => asset.assetRole !== "primary"),
    (asset) => asset.parentAssetId ?? "",
  );
  const primaryAssets = assets.filter((asset) => asset.assetRole === "primary");
  const tagCounts = new Map<string, number>();
  for (const tag of [
    ...assets.flatMap((asset) => asset.tags),
    ...skillFindings.flatMap((finding) => finding.tags),
  ]) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const clusters = [...tagCounts.entries()]
    .filter(
      ([tag]) => tag.startsWith("skill:") || tag.startsWith("style:") || tag.startsWith("format:"),
    )
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([tag]) => {
      const clusterAssets = primaryAssets.filter((asset) => asset.tags.includes(tag));
      const clusterFindings = skillFindings.filter((finding) => finding.tags.includes(tag));
      return {
        key: tag,
        label: tag.replace(/^[^:]+:/, "").replace(/-/g, " "),
        assetCount: clusterAssets.length,
        skillFindingCount: clusterFindings.length,
        tags: [tag],
      };
    });

  return {
    totals: {
      assetCount: primaryAssets.length,
      creativeElementCount: creativeElements.length,
      skillFindingCount: skillFindings.length,
      latestSavedAt: primaryAssets[0]?.createdAtMs,
    },
    assets: primaryAssets.map((asset) => ({
      ...asset,
      analyses: analysesByAsset.get(asset._id ?? "") ?? [],
      creativeElements: elementsByAsset.get(asset._id ?? "") ?? [],
      derivedAssets: derivedByParent.get(asset._id ?? "") ?? [],
      previewAsset: selectPreviewAsset(asset, derivedByParent.get(asset._id ?? "") ?? []),
      skillFindings: findingsByAsset.get(asset._id ?? "") ?? [],
    })),
    topTags: [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 16)
      .map(([tag, count]) => ({ tag, count })),
    clusters,
  };
}

function selectPreviewAsset(
  asset: ResourceBankAssetRow,
  derivedAssets: readonly ResourceBankAssetRow[],
): ResourceBankAssetRow | undefined {
  const candidates = [asset, ...derivedAssets];
  return (
    candidates.find(
      (candidate) => candidate.assetRole === "thumbnail" && isPreviewableKind(candidate.assetKind),
    ) ?? candidates.find((candidate) => isPreviewableKind(candidate.assetKind))
  );
}

function isPreviewableKind(kind: string): boolean {
  return kind === "image" || kind === "screenshot" || kind === "frame" || kind === "thumbnail";
}

function groupBy<T>(values: readonly T[], getKey: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(value);
    } else {
      grouped.set(key, [value]);
    }
  }
  return grouped;
}
