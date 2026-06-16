import { defineTable } from "convex/server";
import { v } from "convex/values";

export const hookTelemetryTables = {
  hookTelemetryEvents: defineTable({
    hookName: v.string(),
    hookType: v.string(),
    projectId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    payload: v.optional(v.any()),
    eventAt: v.number(),
    eventKey: v.optional(v.string()),
  })
    .index("by_eventAt", ["eventAt"])
    .index("by_hook_eventAt", ["hookName", "eventAt"])
    .index("by_project_eventAt", ["projectId", "eventAt"])
    .index("by_session_eventAt", ["sessionId", "eventAt"])
    .index("by_eventKey", ["eventKey"]),
};
