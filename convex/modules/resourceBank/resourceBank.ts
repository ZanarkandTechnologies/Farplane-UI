// Pure Resource Bank reducers used by Convex functions and focused tests.

export const RESOURCE_BANK_TAG_LIMIT = 32;
export const RESOURCE_BANK_TEXT_LIMIT = 6_000;
export const RESOURCE_BANK_QUERY_LIMIT = 40;

export type ResourceBankAssetRow = {
  _id?: string;
  parentAssetId?: string;
  title: string;
  assetKind: string;
  assetRole: string;
  tags: string[];
  searchableText: string;
  projectId?: string;
  taskId?: string;
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

export type ResourceBankAssetDetail = ResourceBankAssetRow & {
  analyses: ResourceBankAnalysisRow[];
  derivedAssets: ResourceBankAssetRow[];
  skillFindings: ResourceBankSkillFindingRow[];
};

export type ResourceBankDashboard = {
  totals: {
    assetCount: number;
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

export function buildRetrievalTagPlan(input: {
  tags?: readonly string[];
  outputType?: string;
}): { filterTags: string[]; tagExpansions: string[] } {
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

export function includesAllTags(rowTags: readonly string[], requiredTags: readonly string[]): boolean {
  if (requiredTags.length === 0) return true;
  const rowTagSet = new Set(rowTags.map((tag) => tag.toLowerCase()));
  return requiredTags.every((tag) => rowTagSet.has(tag.toLowerCase()));
}

export function buildAssetSearchableText(input: {
  title: string;
  note?: string;
  requestedFocus?: string;
  sourceRef?: string;
  tags?: readonly string[];
}): string {
  return [
    input.title,
    input.note,
    input.requestedFocus,
    input.sourceRef,
    ...(input.tags ?? []),
  ]
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

export function buildResourceBankDashboard(
  assets: ResourceBankAssetRow[],
  analyses: ResourceBankAnalysisRow[],
  skillFindings: ResourceBankSkillFindingRow[],
): ResourceBankDashboard {
  const analysesByAsset = groupBy(analyses, (analysis) => analysis.assetId);
  const findingsByAsset = groupBy(skillFindings, (finding) => finding.assetId);
  const derivedByParent = groupBy(
    assets.filter((asset) => asset.assetRole !== "primary"),
    (asset) => asset.parentAssetId ?? "",
  );
  const primaryAssets = assets.filter((asset) => asset.assetRole === "primary");
  const tagCounts = new Map<string, number>();
  for (const tag of [...assets.flatMap((asset) => asset.tags), ...skillFindings.flatMap((finding) => finding.tags)]) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const clusters = [...tagCounts.entries()]
    .filter(([tag]) => tag.startsWith("skill:") || tag.startsWith("style:") || tag.startsWith("format:"))
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
      skillFindingCount: skillFindings.length,
      latestSavedAt: primaryAssets[0]?.createdAtMs,
    },
    assets: primaryAssets.map((asset) => ({
      ...asset,
      analyses: analysesByAsset.get(asset._id ?? "") ?? [],
      derivedAssets: derivedByParent.get(asset._id ?? "") ?? [],
      skillFindings: findingsByAsset.get(asset._id ?? "") ?? [],
    })),
    topTags: [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 16)
      .map(([tag, count]) => ({ tag, count })),
    clusters,
  };
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
