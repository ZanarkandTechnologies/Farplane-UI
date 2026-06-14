import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { type IngestSkillInvocationArgs, ingestSkillInvocationArgsValidator } from "./validators";

function cleanText(value: string | undefined, limit: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

async function insertSkillInvocation(ctx: MutationCtx, args: IngestSkillInvocationArgs) {
  const stepKey = cleanText(args.stepKey, 500);
  if (stepKey) {
    const existing = await ctx.db
      .query("skillInvocationEvents")
      .withIndex("by_stepKey", (q) => q.eq("stepKey", stepKey))
      .first();
    if (existing) return existing._id;
  }

  const now = Date.now();
  return await ctx.db.insert("skillInvocationEvents", {
    skillId: cleanText(args.skillId, 120) ?? "unknown",
    skillPath: cleanText(args.skillPath, 1_000) ?? "unknown",
    sourceTool: cleanText(args.sourceTool, 120) ?? "unknown",
    sourceEvent: cleanText(args.sourceEvent, 120) ?? "PostToolUse",
    label: cleanText(args.label, 120) ?? "Read skill MD",
    sessionId: cleanText(args.sessionId, 160),
    turnId: cleanText(args.turnId, 160),
    projectPath: cleanText(args.projectPath, 500),
    occurredAt: args.occurredAt ?? now,
    stepKey,
    source: cleanText(args.source, 120) ?? "codex-post-tool-use",
    receivedAt: now,
  });
}

export const ingestSkillInvocation = internalMutation({
  args: ingestSkillInvocationArgsValidator,
  returns: v.id("skillInvocationEvents"),
  handler: async (ctx, args) => {
    return await insertSkillInvocation(ctx, args);
  },
});
