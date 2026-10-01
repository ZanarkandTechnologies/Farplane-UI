// One-off copy of the old telemetry tables into `events`. Run a page at a time and pass the returned cursor
// back until `isDone`:
//   npx convex run modules/telemetry/migrations:migrateLegacyEvents '{"table":"hook"}'
//   npx convex run modules/telemetry/migrations:migrateLegacyEvents '{"table":"runtime","cursor":"<cursor>"}'
// Idempotent: a row already copied (same legacyId), or already ingested again (same hook eventKey, or the
// same agent + stepKey), is skipped, so a page can be re-run safely.
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { legacyAgentEventRowToEvent, legacyHookRowToEvent } from "./rows";
import {
  type TelemetryEvent,
  migrateLegacyEventsArgsValidator,
  migrateLegacyEventsResultValidator,
} from "./validators";

const DEFAULT_BATCH = 200;
const MAX_BATCH = 500;

async function alreadyCopied(ctx: MutationCtx, event: TelemetryEvent): Promise<boolean> {
  const legacyId = event.legacyId;
  if (legacyId) {
    const copied = await ctx.db
      .query("events")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
      .first();
    if (copied) return true;
  }
  if (event.source === "hook" && event.eventKey) {
    const eventKey = event.eventKey;
    const same = await ctx.db
      .query("events")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .first();
    return same !== null;
  }
  if (event.source === "runtime" && event.stepKey) {
    const stepKey = event.stepKey;
    const same = await ctx.db
      .query("events")
      .withIndex("by_agent_stepKey", (q) => q.eq("agentId", event.agentId).eq("stepKey", stepKey))
      .first();
    return same !== null;
  }
  return false;
}

export const migrateLegacyEvents = internalMutation({
  args: migrateLegacyEventsArgsValidator,
  returns: migrateLegacyEventsResultValidator,
  handler: async (ctx, args) => {
    const numItems = Math.max(1, Math.min(MAX_BATCH, Math.floor(args.batchSize ?? DEFAULT_BATCH)));
    const cursor = args.cursor ?? null;
    let events: TelemetryEvent[];
    let continueCursor: string;
    let isDone: boolean;
    if (args.table === "hook") {
      const page = await ctx.db.query("hookTelemetryEvents").paginate({ numItems, cursor });
      events = page.page.map(legacyHookRowToEvent);
      continueCursor = page.continueCursor;
      isDone = page.isDone;
    } else {
      const page = await ctx.db.query("agentEvents").paginate({ numItems, cursor });
      events = page.page.map(legacyAgentEventRowToEvent);
      continueCursor = page.continueCursor;
      isDone = page.isDone;
    }

    let copied = 0;
    let skipped = 0;
    for (const event of events) {
      if (await alreadyCopied(ctx, event)) {
        skipped += 1;
        continue;
      }
      await ctx.db.insert("events", event);
      copied += 1;
    }
    return {
      table: args.table,
      scanned: events.length,
      copied,
      skipped,
      cursor: continueCursor,
      isDone,
    };
  },
});
