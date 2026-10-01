// Writes into `events`. Hook rows arrive through `/telemetry/hooks` (+ `/batch`); runtime rows through
// agentActivity's `/ingest` and `/status/report` mutations, which also reduce `agentStatus`.
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import {
  type IngestHookTelemetryArgs,
  ingestHookTelemetryArgsValidator,
  ingestHookTelemetryBatchArgsValidator,
} from "../hookTelemetry/validators";
import type { RuntimeEvent } from "./validators";

function cleanText(value: string | undefined, limit: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function generatedHookEventKey(args: IngestHookTelemetryArgs): string {
  const payload = asRecord(args.payload);
  const bucket = Math.floor(args.eventAt / 1000);
  return [
    "hook",
    args.hookName,
    args.hookType,
    args.sessionId ?? text(payload.sessionId) ?? text(payload.session_id) ?? "session",
    text(payload.turnId) ?? text(payload.turn_id) ?? "turn",
    text(payload.toolUseId) ?? text(payload.tool_use_id) ?? text(payload.skillId) ?? "event",
    String(bucket),
  ]
    .join(":")
    .replace(/\s+/g, "-")
    .slice(0, 500);
}

async function insertHookEvent(ctx: MutationCtx, args: IngestHookTelemetryArgs) {
  const eventKey = cleanText(args.eventKey, 500) ?? generatedHookEventKey(args);
  const existing = await ctx.db
    .query("events")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
    .first();
  if (existing) return { id: existing._id, duplicate: true };

  const id = await ctx.db.insert("events", {
    source: "hook",
    hookName: cleanText(args.hookName, 160) ?? "unknown",
    hookType: cleanText(args.hookType, 160) ?? "unknown",
    projectId: cleanText(args.projectId, 160),
    sessionId: cleanText(args.sessionId, 200),
    payload: args.payload,
    eventAt: args.eventAt,
    eventKey,
  });
  return { id, duplicate: false };
}

export const ingestHookTelemetry = internalMutation({
  args: ingestHookTelemetryArgsValidator,
  returns: v.object({ id: v.id("events"), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    return await insertHookEvent(ctx, args);
  },
});

export const ingestHookTelemetryBatch = internalMutation({
  args: ingestHookTelemetryBatchArgsValidator,
  returns: v.object({
    ids: v.array(v.id("events")),
    duplicateCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const ids = [];
    let duplicateCount = 0;
    for (const event of args.events.slice(0, 500)) {
      const result = await insertHookEvent(ctx, event);
      ids.push(result.id);
      if (result.duplicate) duplicateCount += 1;
    }
    return { ids, duplicateCount };
  },
});

/** Whether a runtime row with this step key was already recorded for the agent, or for the project. */
export async function hasRuntimeStep(
  ctx: MutationCtx,
  scope: { agentId: string; projectId?: string; stepKey: string },
): Promise<boolean> {
  const forAgent = await ctx.db
    .query("events")
    .withIndex("by_agent_stepKey", (q) => q.eq("agentId", scope.agentId).eq("stepKey", scope.stepKey))
    .first();
  if (forAgent) return true;
  const projectId = scope.projectId;
  if (!projectId) return false;
  const forProject = await ctx.db
    .query("events")
    .withIndex("by_project_stepKey", (q) => q.eq("projectId", projectId).eq("stepKey", scope.stepKey))
    .first();
  return forProject !== null;
}

export async function insertRuntimeEvent(ctx: MutationCtx, event: Omit<RuntimeEvent, "source">) {
  return await ctx.db.insert("events", { source: "runtime", ...event });
}
