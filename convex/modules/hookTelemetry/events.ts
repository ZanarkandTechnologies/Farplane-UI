import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "../../_generated/server";
import {
  ingestHookTelemetryArgsValidator,
  ingestHookTelemetryBatchArgsValidator,
  type IngestHookTelemetryArgs,
} from "./validators";

function cleanText(value: string | undefined, limit: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function generatedEventKey(args: IngestHookTelemetryArgs): string {
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

async function insertHookTelemetry(ctx: MutationCtx, args: IngestHookTelemetryArgs) {
  const eventKey = cleanText(args.eventKey, 500) ?? generatedEventKey(args);
  const existing = await ctx.db
    .query("hookTelemetryEvents")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
    .first();
  if (existing) return { id: existing._id, duplicate: true };

  const id = await ctx.db.insert("hookTelemetryEvents", {
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
  returns: v.object({ id: v.id("hookTelemetryEvents"), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    return await insertHookTelemetry(ctx, args);
  },
});

export const ingestHookTelemetryBatch = internalMutation({
  args: ingestHookTelemetryBatchArgsValidator,
  returns: v.object({
    ids: v.array(v.id("hookTelemetryEvents")),
    duplicateCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const ids = [];
    let duplicateCount = 0;
    for (const event of args.events.slice(0, 500)) {
      const result = await insertHookTelemetry(ctx, event);
      ids.push(result.id);
      if (result.duplicate) duplicateCount += 1;
    }
    return { ids, duplicateCount };
  },
});
