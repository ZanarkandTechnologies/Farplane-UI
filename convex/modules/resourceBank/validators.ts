import { type Infer, v } from "convex/values";

export const sourceKindValidator = v.union(
  v.literal("url"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("file"),
  v.literal("note"),
  v.literal("screenshot"),
  v.literal("clip"),
);

export const assetKindValidator = v.union(
  v.literal("url"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("file"),
  v.literal("note"),
  v.literal("screenshot"),
  v.literal("clip"),
  v.literal("frame"),
  v.literal("transcript"),
);

export const assetRoleValidator = v.union(
  v.literal("primary"),
  v.literal("derived"),
  v.literal("evidence"),
  v.literal("thumbnail"),
  v.literal("transcript"),
);

export const confidenceValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const attributionStatusValidator = v.union(
  v.literal("known"),
  v.literal("partial"),
  v.literal("unknown"),
);

export const sourcePrivacyValidator = v.union(
  v.literal("public"),
  v.literal("local"),
  v.literal("private"),
  v.literal("unknown"),
);

export const sourceScopeValidator = v.object({
  startMs: v.optional(v.number()),
  endMs: v.optional(v.number()),
  pageRange: v.optional(v.string()),
  regionLabel: v.optional(v.string()),
});

export const createIngestionJobArgsValidator = {
  sourceKind: sourceKindValidator,
  sourceRef: v.string(),
  originalInstruction: v.optional(v.string()),
  note: v.optional(v.string()),
  requestedFocus: v.optional(v.string()),
  sourceScope: v.optional(sourceScopeValidator),
  tags: v.optional(v.array(v.string())),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  externalTaskRef: v.optional(v.string()),
  requestedBy: v.optional(v.string()),
  sourcePrivacy: v.optional(sourcePrivacyValidator),
};

export const addResourceAssetArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  parentAssetId: v.optional(v.id("resourceBankAssets")),
  assetRole: assetRoleValidator,
  assetKind: assetKindValidator,
  title: v.string(),
  sourceUrl: v.optional(v.string()),
  canonicalUrl: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  localPath: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  startMs: v.optional(v.number()),
  endMs: v.optional(v.number()),
  platform: v.optional(v.string()),
  author: v.optional(v.string()),
  attributionStatus: v.optional(attributionStatusValidator),
  outputTypes: v.optional(v.array(v.string())),
  audiences: v.optional(v.array(v.string())),
  ageRanges: v.optional(v.array(v.string())),
  industries: v.optional(v.array(v.string())),
  customerRoles: v.optional(v.array(v.string())),
  tastinessScore: v.optional(v.number()),
  tags: v.optional(v.array(v.string())),
  searchableText: v.optional(v.string()),
  retentionNote: v.optional(v.string()),
};

export const analysisTypeValidator = v.union(
  v.literal("summary"),
  v.literal("visual"),
  v.literal("video"),
  v.literal("copy"),
  v.literal("style"),
  v.literal("prompt"),
  v.literal("skill-extraction"),
  v.literal("usefulness"),
);

export const addResourceAnalysisArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  assetId: v.id("resourceBankAssets"),
  analysisType: analysisTypeValidator,
  sourceSkill: v.string(),
  facts: v.optional(v.array(v.string())),
  interpretation: v.optional(v.array(v.string())),
  userIntent: v.optional(v.string()),
  whyItWorks: v.optional(v.array(v.string())),
  takeaways: v.optional(v.array(v.string())),
  transcriptText: v.optional(v.string()),
  frameNotes: v.optional(v.string()),
  promptGuess: v.optional(v.string()),
  remixConstraints: v.optional(v.array(v.string())),
  confidence: v.optional(confidenceValidator),
  embeddingText: v.optional(v.string()),
  embeddingModel: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
  tags: v.optional(v.array(v.string())),
};

export const findingKindValidator = v.union(
  v.literal("existing_skill"),
  v.literal("skill_candidate"),
  v.literal("skill_update"),
  v.literal("reusable_technique"),
);

export const creativeElementKindValidator = v.union(
  v.literal("visual"),
  v.literal("audio"),
  v.literal("hook"),
  v.literal("storyboard"),
  v.literal("editing"),
  v.literal("copy"),
  v.literal("format"),
  v.literal("constraint"),
);

export const addSkillFindingArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  assetId: v.id("resourceBankAssets"),
  analysisId: v.id("resourceBankAnalyses"),
  findingKind: findingKindValidator,
  skillId: v.optional(v.string()),
  skillPath: v.optional(v.string()),
  label: v.string(),
  capability: v.string(),
  evidenceAnchor: v.string(),
  howToReuse: v.string(),
  suggestedSkillChange: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  confidence: v.optional(confidenceValidator),
  embeddingText: v.optional(v.string()),
  embeddingModel: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
};

export const addCreativeElementArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  assetId: v.id("resourceBankAssets"),
  analysisId: v.optional(v.id("resourceBankAnalyses")),
  kind: creativeElementKindValidator,
  title: v.string(),
  description: v.string(),
  anchor: v.optional(v.string()),
  embeddingText: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
  tags: v.optional(v.array(v.string())),
};

export const completeIngestionJobArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  status: v.optional(v.union(v.literal("ready"), v.literal("failed"), v.literal("needs_review"))),
  error: v.optional(v.string()),
};

export const searchGalleryArgsValidator = {
  query: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  assetKind: v.optional(assetKindValidator),
  assetRole: v.optional(assetRoleValidator),
  outputTypes: v.optional(v.array(v.string())),
  audiences: v.optional(v.array(v.string())),
  ageRanges: v.optional(v.array(v.string())),
  industries: v.optional(v.array(v.string())),
  customerRoles: v.optional(v.array(v.string())),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  limit: v.optional(v.number()),
};

export const searchSkillFindingsArgsValidator = {
  query: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  findingKind: v.optional(findingKindValidator),
  skillId: v.optional(v.string()),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  limit: v.optional(v.number()),
};

export const getResourceAssetArgsValidator = {
  assetId: v.id("resourceBankAssets"),
};

export const listCreativeElementsByAssetArgsValidator = {
  assetId: v.id("resourceBankAssets"),
  kind: v.optional(creativeElementKindValidator),
  limit: v.optional(v.number()),
};

export const listCreativeElementsByJobArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  kind: v.optional(creativeElementKindValidator),
  limit: v.optional(v.number()),
};

export const dashboardArgsValidator = {
  query: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  limit: v.optional(v.number()),
};

export const linkJobToTaskArgsValidator = {
  jobId: v.id("resourceBankIngestionJobs"),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  externalTaskRef: v.optional(v.string()),
};

export const findSimilarAssetsArgsValidator = {
  embedding: v.array(v.float64()),
  assetKind: v.optional(assetKindValidator),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  limit: v.optional(v.number()),
};

export const retrieveForCreationArgsValidator = {
  goal: v.string(),
  embedding: v.optional(v.array(v.float64())),
  tags: v.optional(v.array(v.string())),
  outputType: v.optional(v.string()),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  count: v.optional(v.number()),
};

export const tastyPackTimeframeValidator = v.union(
  v.literal("past_day"),
  v.literal("past_week"),
  v.literal("past_month"),
  v.literal("past_90_days"),
  v.literal("all"),
);

export const createTastyPackArgsValidator = {
  idea: v.optional(v.string()),
  timeframe: v.optional(tastyPackTimeframeValidator),
  startAtMs: v.optional(v.number()),
  endAtMs: v.optional(v.number()),
  tags: v.optional(v.array(v.string())),
  outputType: v.optional(v.string()),
  outputTypes: v.optional(v.array(v.string())),
  audience: v.optional(v.string()),
  audiences: v.optional(v.array(v.string())),
  ageRanges: v.optional(v.array(v.string())),
  industry: v.optional(v.string()),
  industries: v.optional(v.array(v.string())),
  customerRole: v.optional(v.string()),
  customerRoles: v.optional(v.array(v.string())),
  projectId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  kinds: v.optional(v.array(creativeElementKindValidator)),
  limit: v.optional(v.number()),
};

export const resetResourceBankAfterSnapshotArgsValidator = {
  confirm: v.string(),
  snapshotCreatedAtMs: v.number(),
  expectedCounts: v.object({
    jobs: v.number(),
    assets: v.number(),
    analyses: v.number(),
    skillFindings: v.number(),
    creativeElements: v.number(),
  }),
};

export const seedDemoArgsValidator = {
  resetDemo: v.optional(v.boolean()),
  confirm: v.string(),
};

export const createIngestionJobValidator = v.object(createIngestionJobArgsValidator);
export type CreateIngestionJobArgs = Infer<typeof createIngestionJobValidator>;

export const addCreativeElementValidator = v.object(addCreativeElementArgsValidator);
export type AddCreativeElementArgs = Infer<typeof addCreativeElementValidator>;
