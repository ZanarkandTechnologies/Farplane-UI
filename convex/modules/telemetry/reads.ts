// Index-backed reads over `events`, newest first, returned in the old row shapes (rows.ts). Every telemetry
// reader goes through these two functions, so the projections never touch the table directly.
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import {
  hookEventToRow,
  type LegacyAgentEventRow,
  type LegacyHookRow,
  runtimeEventToRow,
} from "./rows";

export type HookRowFilter = {
  projectId?: string;
  sessionId?: string;
  hookName?: string;
  hookType?: string;
  /** Oldest eventAt to include. */
  since: number;
  limit: number;
};

/** Hook rows of a window, newest first, by the most specific index the filter names. */
export async function readHookRows(ctx: QueryCtx, filter: HookRowFilter): Promise<LegacyHookRow[]> {
  const { projectId, sessionId, hookName, hookType, since, limit } = filter;
  const events = ctx.db.query("events");
  let docs: Doc<"events">[];
  if (projectId && hookName && hookType) {
    docs = await events
      .withIndex("by_project_hook_type_eventAt", (q) =>
        q.eq("projectId", projectId).eq("hookName", hookName).eq("hookType", hookType).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (projectId && hookName) {
    docs = await events
      .withIndex("by_project_hook_eventAt", (q) =>
        q.eq("projectId", projectId).eq("hookName", hookName).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (projectId) {
    docs = await events
      .withIndex("by_source_project_eventAt", (q) =>
        q.eq("source", "hook").eq("projectId", projectId).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (sessionId && hookName && hookType) {
    docs = await events
      .withIndex("by_session_hook_type_eventAt", (q) =>
        q.eq("sessionId", sessionId).eq("hookName", hookName).eq("hookType", hookType).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (sessionId && hookName) {
    docs = await events
      .withIndex("by_session_hook_eventAt", (q) =>
        q.eq("sessionId", sessionId).eq("hookName", hookName).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (sessionId) {
    docs = await events
      .withIndex("by_source_session_eventAt", (q) =>
        q.eq("source", "hook").eq("sessionId", sessionId).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (hookName && hookType) {
    docs = await events
      .withIndex("by_hook_type_eventAt", (q) =>
        q.eq("hookName", hookName).eq("hookType", hookType).gte("eventAt", since),
      )
      .order("desc")
      .take(limit);
  } else if (hookName) {
    docs = await events
      .withIndex("by_hook_eventAt", (q) => q.eq("hookName", hookName).gte("eventAt", since))
      .order("desc")
      .take(limit);
  } else {
    docs = await events
      .withIndex("by_source_eventAt", (q) => q.eq("source", "hook").gte("eventAt", since))
      .order("desc")
      .take(limit);
  }
  return docs.flatMap((doc) => (doc.source === "hook" ? [hookEventToRow(doc)] : []));
}

export type RuntimeRowFilter = {
  teamId?: string;
  projectId?: string;
  agentId?: string;
  /** Only rows strictly older than this eventAt (feed paging). */
  before?: number;
  limit: number;
};

/**
 * Runtime rows, newest first. Scopes: team + project, team + agent, team, agent, or every runtime row.
 * A projectId without a teamId is not a scope here (no reader asks for it).
 */
export async function readRuntimeRows(
  ctx: QueryCtx,
  filter: RuntimeRowFilter,
): Promise<LegacyAgentEventRow[]> {
  const { teamId, projectId, agentId, before, limit } = filter;
  const events = ctx.db.query("events");
  let docs: Doc<"events">[];
  if (teamId && projectId) {
    docs = await events
      .withIndex("by_team_project_eventAt", (q) =>
        before
          ? q.eq("teamId", teamId).eq("projectId", projectId).lt("eventAt", before)
          : q.eq("teamId", teamId).eq("projectId", projectId),
      )
      .order("desc")
      .take(limit);
  } else if (teamId && agentId) {
    docs = await events
      .withIndex("by_team_agent_eventAt", (q) =>
        before
          ? q.eq("teamId", teamId).eq("agentId", agentId).lt("eventAt", before)
          : q.eq("teamId", teamId).eq("agentId", agentId),
      )
      .order("desc")
      .take(limit);
  } else if (teamId) {
    docs = await events
      .withIndex("by_team_eventAt", (q) =>
        before ? q.eq("teamId", teamId).lt("eventAt", before) : q.eq("teamId", teamId),
      )
      .order("desc")
      .take(limit);
  } else if (agentId) {
    docs = await events
      .withIndex("by_agent_eventAt", (q) =>
        before ? q.eq("agentId", agentId).lt("eventAt", before) : q.eq("agentId", agentId),
      )
      .order("desc")
      .take(limit);
  } else {
    docs = await events
      .withIndex("by_source_eventAt", (q) =>
        before ? q.eq("source", "runtime").lt("eventAt", before) : q.eq("source", "runtime"),
      )
      .order("desc")
      .take(limit);
  }
  return docs.flatMap((doc) => (doc.source === "runtime" ? [runtimeEventToRow(doc)] : []));
}
