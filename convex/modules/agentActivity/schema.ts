// Agent activity owns live status rows plus append-only agent event history for office activity feeds.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const agentActivityTables = {
  agentEvents: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    agentId: v.string(),
    eventType: v.string(),
    activityType: v.optional(v.string()),
    actorType: v.optional(v.string()),
    label: v.string(),
    detail: v.optional(v.string()),
    state: v.optional(v.string()),
    skillId: v.optional(v.string()),
    source: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    beatId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_team_occurred_at", ["teamId", "occurredAt"])
    .index("by_team_agent_occurred_at", ["teamId", "agentId", "occurredAt"])
    .index("by_project_occurred_at", ["projectId", "occurredAt"])
    .index("by_project_agent_occurred_at", ["projectId", "agentId", "occurredAt"])
    .index("by_project_step_key", ["projectId", "stepKey"])
    .index("by_agent_step_key", ["agentId", "stepKey"])
    .index("by_occurred_at", ["occurredAt"]),

  agentStatus: defineTable({
    teamId: v.optional(v.string()),
    agentId: v.string(),
    state: v.string(),
    statusText: v.string(),
    bubbles: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        weight: v.number(),
      }),
    ),
    currentBeatId: v.optional(v.string()),
    currentSkillId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    updatedAt: v.number(),
    lastEventAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_team_agent", ["teamId", "agentId"])
    .index("by_updated_at", ["updatedAt"]),
};
