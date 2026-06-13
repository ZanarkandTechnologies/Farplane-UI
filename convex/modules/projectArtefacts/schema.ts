// Project artefacts owns the bounded Convex index of workspace artefact metadata.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const projectArtefactTables = {
  projectArtefactIndex: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.string(),
    agentId: v.string(),
    workspace: v.string(),
    path: v.string(),
    name: v.string(),
    kind: v.string(),
    sizeBytes: v.optional(v.number()),
    updatedAtMs: v.optional(v.number()),
    indexedAtMs: v.number(),
    lastSeenAtMs: v.number(),
    status: v.union(v.literal("present"), v.literal("missing")),
    isPreviewable: v.boolean(),
    taskId: v.optional(v.string()),
    truncated: v.optional(v.boolean()),
  })
    .index("by_project_indexed_at", ["projectId", "indexedAtMs"])
    .index("by_project_agent_path", ["projectId", "agentId", "path"])
    .index("by_project_status_indexed_at", ["projectId", "status", "indexedAtMs"]),
};
