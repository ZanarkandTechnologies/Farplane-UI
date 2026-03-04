import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agentEvents: defineTable({
    agentId: v.string(),
    eventType: v.string(),
    label: v.string(),
    detail: v.optional(v.string()),
    state: v.optional(v.string()),
    skillId: v.optional(v.string()),
    source: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    beatId: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_step_key", ["agentId", "stepKey"])
    .index("by_occurred_at", ["occurredAt"]),

  agentStatus: defineTable({
    agentId: v.string(),
    state: v.string(),
    statusText: v.string(),
    bubbles: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        weight: v.number(),
      })
    ),
    currentBeatId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    updatedAt: v.number(),
    lastEventAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_updated_at", ["updatedAt"]),
});
