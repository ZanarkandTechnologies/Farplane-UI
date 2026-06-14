// Skill invocation telemetry table owned by the skillInvocations Convex module.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const skillInvocationTables = {
  skillInvocationEvents: defineTable({
    skillId: v.string(),
    skillPath: v.string(),
    sourceTool: v.string(),
    sourceEvent: v.string(),
    label: v.string(),
    sessionId: v.optional(v.string()),
    turnId: v.optional(v.string()),
    projectPath: v.optional(v.string()),
    occurredAt: v.number(),
    stepKey: v.optional(v.string()),
    source: v.string(),
    receivedAt: v.number(),
  })
    .index("by_occurredAt", ["occurredAt"])
    .index("by_skillId_occurredAt", ["skillId", "occurredAt"])
    .index("by_sourceTool_occurredAt", ["sourceTool", "occurredAt"])
    .index("by_stepKey", ["stepKey"]),
};
