// Team board owns project task state and append-only board events used by office task workflows.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const teamBoardTables = {
  teamBoardTasks: defineTable({
    projectId: v.string(),
    taskId: v.string(),
    title: v.string(),
    status: v.string(),
    ownerAgentId: v.optional(v.string()),
    priority: v.string(),
    provider: v.string(),
    canonicalProvider: v.string(),
    providerUrl: v.optional(v.string()),
    syncState: v.string(),
    syncError: v.optional(v.string()),
    notes: v.optional(v.string()),
    taskType: v.optional(v.string()),
    approvalState: v.optional(v.string()),
    linkedSessionKey: v.optional(v.string()),
    createdTeamId: v.optional(v.string()),
    createdProjectId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_task_id", ["projectId", "taskId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_updated_at", ["projectId", "updatedAt"]),

  teamBoardEvents: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.string(),
    taskId: v.string(),
    eventType: v.string(),
    actorType: v.string(),
    actorAgentId: v.optional(v.string()),
    label: v.string(),
    detail: v.optional(v.string()),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    beatId: v.optional(v.string()),
    occurredAt: v.number(),
    stepKey: v.optional(v.string()),
  })
    .index("by_team_occurred_at", ["teamId", "occurredAt"])
    .index("by_project_occurred_at", ["projectId", "occurredAt"])
    .index("by_project_task_occurred_at", ["projectId", "taskId", "occurredAt"])
    .index("by_project_step_key", ["projectId", "stepKey"]),
};
