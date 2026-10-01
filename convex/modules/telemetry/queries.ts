// The telemetry reads under one path, `modules/telemetry/queries:<name>`, all over `events`. Same names,
// arguments and results as the old paths, which stay registered (and read `events` too) until their
// readers move here:
// - modules/hookTelemetry/queries:*      (explorer, bubbles, lineage, learning timeline, observed workers)
// - status:*                            (agent events and activity feeds; agentStatus stays in agentActivity)
// - modules/runtimeTelemetry/telemetry:* (agent-hours dashboards)
// - modules/skillInvocations/queries:*   (skill invocation dashboard)
export {
  getHookTelemetryExplorer,
  getLearningTimelineFromHookTelemetry,
  getObservedCodexWorkers,
  getRecentBubbleMessages,
  getThreadLineageGraph,
  listHookTelemetryEvents,
} from "../hookTelemetry/queries";
export {
  getAgentActivityFeed,
  getAgentEvents,
  getRecentAgentEvents,
  getTeamActivityFeed,
} from "../agentActivity/status";
export { getTeamTelemetry, getTelemetryDashboard } from "../runtimeTelemetry/telemetry";
export { getSkillInvocationDashboard } from "../skillInvocations/queries";
