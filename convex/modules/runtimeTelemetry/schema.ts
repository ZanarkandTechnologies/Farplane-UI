import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  activeAgentCountValidator,
  activityEventTypeValidator,
  optionalTelemetryTextValidator,
  receivedAtValidator,
} from "./validators";

export const runtimeTelemetryTables = {
  runtimeTelemetryActivityPings: defineTable({
    eventType: activityEventTypeValidator,
    source: v.string(),
    activeAgentCount: activeAgentCountValidator,
    prompt: optionalTelemetryTextValidator,
    agentName: optionalTelemetryTextValidator,
    workflowName: optionalTelemetryTextValidator,
    machineName: optionalTelemetryTextValidator,
    projectName: optionalTelemetryTextValidator,
    projectDirectory: optionalTelemetryTextValidator,
    projectId: optionalTelemetryTextValidator,
    teamId: optionalTelemetryTextValidator,
    sessionId: optionalTelemetryTextValidator,
    turnId: optionalTelemetryTextValidator,
    receivedAt: receivedAtValidator,
  })
    .index("by_receivedAt", ["receivedAt"])
    .index("by_projectId_and_receivedAt", ["projectId", "receivedAt"])
    .index("by_teamId_and_receivedAt", ["teamId", "receivedAt"]),
};
