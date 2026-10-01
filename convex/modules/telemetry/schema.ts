import { defineTable } from "convex/server";
import { telemetryEventValidator } from "./validators";

// `events` replaces `hookTelemetryEvents` and `agentEvents`; see validators.ts for the two row shapes.
export const telemetryTables = {
  events: defineTable(telemetryEventValidator)
    // Every row of one source, by time (the global windows and the copy migration's checks).
    .index("by_source_eventAt", ["source", "eventAt"])
    .index("by_source_project_eventAt", ["source", "projectId", "eventAt"])
    .index("by_source_session_eventAt", ["source", "sessionId", "eventAt"])
    // Hook rows (runtime rows have no hookName, so these never return them).
    .index("by_hook_eventAt", ["hookName", "eventAt"])
    .index("by_hook_type_eventAt", ["hookName", "hookType", "eventAt"])
    .index("by_project_hook_eventAt", ["projectId", "hookName", "eventAt"])
    .index("by_project_hook_type_eventAt", ["projectId", "hookName", "hookType", "eventAt"])
    .index("by_session_hook_eventAt", ["sessionId", "hookName", "eventAt"])
    .index("by_session_hook_type_eventAt", ["sessionId", "hookName", "hookType", "eventAt"])
    .index("by_eventKey", ["eventKey"])
    // Runtime rows (hook rows have no agentId, teamId or stepKey).
    .index("by_agent_eventAt", ["agentId", "eventAt"])
    .index("by_team_eventAt", ["teamId", "eventAt"])
    .index("by_team_project_eventAt", ["teamId", "projectId", "eventAt"])
    .index("by_team_agent_eventAt", ["teamId", "agentId", "eventAt"])
    .index("by_agent_stepKey", ["agentId", "stepKey"])
    .index("by_project_stepKey", ["projectId", "stepKey"])
    // The copy migration's idempotency key.
    .index("by_legacyId", ["legacyId"]),
};
