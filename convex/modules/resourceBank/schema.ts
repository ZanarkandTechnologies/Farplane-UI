// Resource Bank owns media ingestion jobs, retained assets, analysis records, and extracted skill findings.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const RESOURCE_BANK_EMBEDDING_DIMENSIONS = 1536;

export const resourceBankTables = {
  resourceBankIngestionJobs: defineTable({
    sourceKind: v.union(
      v.literal("url"),
      v.literal("image"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("file"),
      v.literal("note"),
      v.literal("screenshot"),
      v.literal("clip"),
    ),
    sourceRef: v.string(),
    originalInstruction: v.optional(v.string()),
    note: v.optional(v.string()),
    requestedFocus: v.optional(v.string()),
    sourceScope: v.optional(
      v.object({
        startMs: v.optional(v.number()),
        endMs: v.optional(v.number()),
        pageRange: v.optional(v.string()),
        regionLabel: v.optional(v.string()),
      }),
    ),
    tags: v.array(v.string()),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    externalTaskRef: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("needs_review"),
    ),
    sourcePrivacy: v.union(
      v.literal("public"),
      v.literal("local"),
      v.literal("private"),
      v.literal("unknown"),
    ),
    error: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    completedAtMs: v.optional(v.number()),
  })
    .index("by_status_createdAtMs", ["status", "createdAtMs"])
    .index("by_project_createdAtMs", ["projectId", "createdAtMs"])
    .index("by_task_createdAtMs", ["taskId", "createdAtMs"]),

  resourceBankAssets: defineTable({
    ingestionJobId: v.id("resourceBankIngestionJobs"),
    parentAssetId: v.optional(v.id("resourceBankAssets")),
    assetRole: v.union(
      v.literal("primary"),
      v.literal("derived"),
      v.literal("evidence"),
      v.literal("thumbnail"),
      v.literal("transcript"),
    ),
    assetKind: v.union(
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
    ),
    title: v.string(),
    sourceUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    storageId: v.optional(v.string()),
    localPath: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
    platform: v.optional(v.string()),
    author: v.optional(v.string()),
    attributionStatus: v.union(v.literal("known"), v.literal("partial"), v.literal("unknown")),
    outputTypes: v.optional(v.array(v.string())),
    audiences: v.optional(v.array(v.string())),
    ageRanges: v.optional(v.array(v.string())),
    industries: v.optional(v.array(v.string())),
    customerRoles: v.optional(v.array(v.string())),
    tastinessScore: v.optional(v.number()),
    tags: v.array(v.string()),
    searchableText: v.string(),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    retentionNote: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_createdAtMs", ["createdAtMs"])
    .index("by_job", ["ingestionJobId"])
    .index("by_project_createdAtMs", ["projectId", "createdAtMs"])
    .index("by_task_createdAtMs", ["taskId", "createdAtMs"])
    .searchIndex("search_assets", {
      searchField: "searchableText",
      filterFields: ["assetKind", "assetRole", "projectId", "taskId"],
    }),

  resourceBankAnalyses: defineTable({
    ingestionJobId: v.id("resourceBankIngestionJobs"),
    assetId: v.id("resourceBankAssets"),
    analysisType: v.union(
      v.literal("summary"),
      v.literal("visual"),
      v.literal("video"),
      v.literal("copy"),
      v.literal("style"),
      v.literal("prompt"),
      v.literal("skill-extraction"),
      v.literal("usefulness"),
    ),
    sourceSkill: v.string(),
    facts: v.array(v.string()),
    interpretation: v.array(v.string()),
    userIntent: v.optional(v.string()),
    whyItWorks: v.array(v.string()),
    takeaways: v.array(v.string()),
    transcriptText: v.optional(v.string()),
    frameNotes: v.optional(v.string()),
    promptGuess: v.optional(v.string()),
    remixConstraints: v.array(v.string()),
    confidence: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    embeddingTarget: v.literal("analysis_search"),
    embeddingText: v.string(),
    embeddingModel: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAtMs: v.number(),
  })
    .index("by_asset", ["assetId"])
    .index("by_job", ["ingestionJobId"])
    .index("by_project_createdAtMs", ["projectId", "createdAtMs"])
    .searchIndex("search_analysis", {
      searchField: "embeddingText",
      filterFields: ["analysisType", "projectId", "taskId"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: RESOURCE_BANK_EMBEDDING_DIMENSIONS,
      filterFields: ["analysisType", "projectId", "taskId"],
    }),

  resourceBankSkillFindings: defineTable({
    ingestionJobId: v.id("resourceBankIngestionJobs"),
    assetId: v.id("resourceBankAssets"),
    analysisId: v.id("resourceBankAnalyses"),
    findingKind: v.union(
      v.literal("existing_skill"),
      v.literal("skill_candidate"),
      v.literal("skill_update"),
      v.literal("reusable_technique"),
    ),
    skillId: v.optional(v.string()),
    skillPath: v.optional(v.string()),
    label: v.string(),
    capability: v.string(),
    evidenceAnchor: v.string(),
    howToReuse: v.string(),
    suggestedSkillChange: v.optional(v.string()),
    tags: v.array(v.string()),
    confidence: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    embeddingTarget: v.literal("skill_finding_search"),
    embeddingText: v.string(),
    embeddingModel: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    createdAtMs: v.number(),
  })
    .index("by_asset", ["assetId"])
    .index("by_analysis", ["analysisId"])
    .index("by_job", ["ingestionJobId"])
    .index("by_skillId_createdAtMs", ["skillId", "createdAtMs"])
    .index("by_project_createdAtMs", ["projectId", "createdAtMs"])
    .searchIndex("search_skill_findings", {
      searchField: "embeddingText",
      filterFields: ["findingKind", "skillId", "projectId", "taskId"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: RESOURCE_BANK_EMBEDDING_DIMENSIONS,
      filterFields: ["findingKind", "skillId", "projectId", "taskId"],
    }),

  resourceBankCreativeElements: defineTable({
    ingestionJobId: v.id("resourceBankIngestionJobs"),
    assetId: v.id("resourceBankAssets"),
    analysisId: v.optional(v.id("resourceBankAnalyses")),
    kind: v.union(
      v.literal("visual"),
      v.literal("audio"),
      v.literal("hook"),
      v.literal("storyboard"),
      v.literal("editing"),
      v.literal("copy"),
      v.literal("format"),
      v.literal("constraint"),
    ),
    title: v.string(),
    description: v.string(),
    anchor: v.optional(v.string()),
    embeddingTarget: v.literal("creative_element_search"),
    embeddingText: v.string(),
    embedding: v.optional(v.array(v.float64())),
    tags: v.array(v.string()),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    createdAtMs: v.number(),
  })
    .index("by_asset", ["assetId"])
    .index("by_job", ["ingestionJobId"])
    .index("by_kind_createdAtMs", ["kind", "createdAtMs"])
    .index("by_project_createdAtMs", ["projectId", "createdAtMs"])
    .index("by_task_createdAtMs", ["taskId", "createdAtMs"])
    .searchIndex("search_creative_elements", {
      searchField: "embeddingText",
      filterFields: ["kind", "projectId", "taskId"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: RESOURCE_BANK_EMBEDDING_DIMENSIONS,
      filterFields: ["kind", "projectId", "taskId"],
    }),
};
