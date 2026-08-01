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
  sourceSkill?: string;
  analysisMarkdown?: string;
  userIntent?: string;
  transcriptText?: string;
  confidence?: string;
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
  kind: "visual" | "audio" | "storyboard" | "editing" | "character" | "format";
  title: string;
  description: string;
  whyItWorks: string;
  goldenExample: {
    assetId: string;
    description?: string;
  };
  goldenRecipe: string;
  anchor?: string;
  pinned: boolean;
  embeddingText: string;
  tags: string[];
  projectId?: string;
  taskId?: string;
  createdAtMs: number;
};

export type BrandKitElementKind = ResourceBankCreativeElementRow["kind"];

export type BrandKitGoldenExample = {
  title?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: string;
  storageUrl?: string | null;
  localPath?: string;
  assetId?: string;
  description?: string;
};

export type BrandKitProviderHandle = {
  provider: "elevenlabs" | "fish" | "other";
  handleKind: "voice_id" | "model_id" | "style_id" | "other";
  handle: string;
};

export type BrandKitPrompt = {
  text: string;
  revision: number;
  updatedAtMs: number;
};

export type BrandKitElementSnapshot = {
  elementId: string;
  kind: BrandKitElementKind;
  title: string;
  description: string;
  whyItWorks: string;
  goldenExample: BrandKitGoldenExample;
  goldenRecipe: string;
  anchor?: string;
  tags: string[];
  providerHandles?: BrandKitProviderHandle[];
  provenance: {
    resourceElementId?: string;
    ingestionJobId?: string;
    assetId?: string;
    analysisId?: string;
    promotedFrom: "resource_bank" | "manual";
    promotedBy?: string;
    promotedAtMs: number;
    idempotencyKeyHash?: string;
  };
  sourceSnapshotHash: string;
  approvedAtMs: number;
  approvedBy?: string;
};

export type BrandKitRow = {
  _id?: string;
  kitId: string;
  projectId?: string;
  slug: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  revision: number;
  elements: BrandKitElementSnapshot[];
  prompt: BrandKitPrompt;
  createdAtMs: number;
  updatedAtMs: number;
  archivedAtMs?: number;
};

export type ResourceBankAssetDetail = ResourceBankAssetRow & {
  analyses: ResourceBankAnalysisRow[];
  creativeElements: ResourceBankCreativeElementRow[];
  derivedAssets: ResourceBankAssetRow[];
  previewAsset?: ResourceBankAssetRow;
  previewStatus: ResourceBankPreviewStatus;
  skillFindings: ResourceBankSkillFindingRow[];
};

export type ResourceBankPreviewStatus = {
  state: "ready" | "source_handle" | "missing";
  message: string;
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
  whyItWorks: string;
  goldenExample: ResourceBankCreativeElementRow["goldenExample"];
  goldenRecipe: string;
  anchor?: string;
  pinned: boolean;
  tags: string[];
};

export type TastyPackAnalysis = {
  operatorNote?: string;
  markdown: string;
};

export type TastyPackCapture = {
  captureId: string;
  source: TastyPackSource;
  transcript?: string;
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

export function normalizeBrandKitSlug(value: string | undefined): string | undefined {
  const normalized = normalizeTag(value ?? "");
  return normalized?.slice(0, 80);
}

export function normalizeBrandKitId(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  const unprefixed = trimmed.toLowerCase().startsWith("brand-kit:")
    ? trimmed.slice("brand-kit:".length)
    : trimmed;
  const slug = normalizeBrandKitSlug(unprefixed);
  return slug ? `brand-kit:${slug}` : undefined;
}

export function mapResourceKindToBrandKitKind(
  kind: ResourceBankCreativeElementRow["kind"],
): BrandKitElementKind {
  return kind;
}

export function looksLikeSecret(value: string | undefined): boolean {
  const normalized = value?.trim() ?? "";
  if (!normalized) return false;
  if (/\s/.test(normalized)) {
    if (/bearer\s+\S+/i.test(normalized)) return true;
    return normalized.split(/\s+/).some((token) => looksLikeSecret(token));
  }
  if (/^(sk|pk|rk|api|key|token|secret)[_-]/i.test(normalized)) return true;
  if (/bearer\s+/i.test(normalized)) return true;
  if (normalized.length >= 32 && /[A-Za-z]/.test(normalized) && /\d/.test(normalized)) {
    return true;
  }
  return false;
}

export function assertSafeProviderHandles(handles: readonly BrandKitProviderHandle[] = []): void {
  for (const handle of handles) {
    if (looksLikeSecret(handle.handle)) throw new Error("brand_kit_provider_handle_looks_secret");
  }
}

export function normalizeBrandKitPromptInput(
  input: { text?: string },
  existing: BrandKitPrompt | undefined,
  updatedAtMs: number,
): BrandKitPrompt {
  const text =
    input.text === undefined
      ? (existing?.text ?? "")
      : (cleanText(input.text, RESOURCE_BANK_TEXT_LIMIT) ?? "");
  const secretScanText = text.replace(
    /\b(?:fish(?:\s+audio)?\s+)?(?:voice|model)\s+(?:reference\s+)?id\s*[:=]?\s*[a-f0-9]{32}\b/gi,
    "public provider reference",
  );
  if (looksLikeSecret(secretScanText)) throw new Error("brand_kit_prompt_text_looks_secret");
  return {
    text,
    revision: existing ? existing.revision + 1 : 1,
    updatedAtMs,
  };
}

export function buildBrandKitProductionSnapshot(input: {
  kit: BrandKitRow;
  snapshotCreatedAtMs: number;
}) {
  const prompt = input.kit.prompt ?? {
    text: "",
    revision: 1,
    updatedAtMs: input.kit.updatedAtMs,
  };
  return {
    kitId: input.kit.kitId,
    kitRevision: input.kit.revision,
    snapshotCreatedAtMs: input.snapshotCreatedAtMs,
    prompt: {
      text: prompt.text,
      revision: prompt.revision,
      updatedAtMs: prompt.updatedAtMs,
    },
    kit: {
      name: input.kit.name,
      description: input.kit.description,
      elements: input.kit.elements,
    },
    elements: input.kit.elements,
  };
}

export function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `bk_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildBrandKitSourceSnapshotHash(input: {
  kind: BrandKitElementKind;
  title: string;
  description: string;
  whyItWorks: string;
  goldenExample: BrandKitGoldenExample;
  goldenRecipe: string;
  anchor?: string;
  tags: string[];
}): string {
  return stableHash(input);
}

export function requireCleanText(value: string | undefined, field: string, limit = 2_000): string {
  const text = cleanText(value, limit);
  if (!text) throw new Error(`${field}_required`);
  return text;
}

export function buildBrandKitIdempotencyHash(
  idempotencyKey: string | undefined,
  sourceSnapshotHash: string,
): string | undefined {
  const key = cleanText(idempotencyKey, 240);
  return key ? stableHash({ key, sourceSnapshotHash }) : undefined;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
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
      transcript: analyses.find((analysis) => analysis.transcriptText)?.transcriptText,
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
    whyItWorks: element.whyItWorks,
    goldenExample: element.goldenExample,
    goldenRecipe: element.goldenRecipe,
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
    markdown: analyses
      .map((analysis) => analysis.analysisMarkdown)
      .filter(Boolean)
      .join("\n\n"),
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
  analysisMarkdown: string;
  transcriptText?: string;
  userIntent?: string;
}): string {
  return [
    "User intent",
    input.userIntent,
    "Analysis",
    input.analysisMarkdown,
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
  whyItWorks?: string;
  goldenExampleDescription?: string;
  goldenRecipe?: string;
  anchor?: string;
  tags?: readonly string[];
}): string {
  return [
    input.title,
    input.description,
    input.whyItWorks,
    input.goldenExampleDescription,
    input.goldenRecipe,
    input.anchor,
    ...(input.tags ?? []),
  ]
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
    assets: primaryAssets.map((asset) => {
      const derivedAssets = derivedByParent.get(asset._id ?? "") ?? [];
      const previewAsset = selectPreviewAsset(asset, derivedAssets);
      return {
        ...asset,
        analyses: analysesByAsset.get(asset._id ?? "") ?? [],
        creativeElements: elementsByAsset.get(asset._id ?? "") ?? [],
        derivedAssets,
        previewAsset,
        previewStatus: describePreviewStatus(asset, previewAsset),
        skillFindings: findingsByAsset.get(asset._id ?? "") ?? [],
      };
    }),
    topTags: [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 16)
      .map(([tag, count]) => ({ tag, count })),
    clusters,
  };
}

function describePreviewStatus(
  asset: ResourceBankAssetRow,
  previewAsset: ResourceBankAssetRow | undefined,
): ResourceBankPreviewStatus {
  if (previewAsset && hasBrowserDisplayablePreview(previewAsset)) {
    return {
      state: "ready",
      message:
        previewAsset.assetRole === "primary"
          ? "Primary asset is browser-displayable."
          : "Stored preview asset is ready.",
    };
  }
  if (previewAsset || asset.sourceUrl || asset.canonicalUrl || asset.storageId || asset.localPath) {
    return {
      state: "source_handle",
      message:
        "Source reference is saved, but no browser-displayable thumbnail or contact sheet is stored.",
    };
  }
  return {
    state: "missing",
    message: "No source handle or preview asset is stored for this reference.",
  };
}

export function selectPreviewAsset(
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

function hasBrowserDisplayablePreview(asset: ResourceBankAssetRow): boolean {
  if (asset.storageUrl || asset.localPath) return true;
  const candidate = asset.canonicalUrl ?? asset.sourceUrl;
  if (!candidate) return false;
  if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) return true;
  return /^https?:\/\//i.test(candidate) && /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(candidate);
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
