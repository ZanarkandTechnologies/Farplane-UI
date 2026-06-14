import { type Infer, v } from "convex/values";

export const optionalSkillInvocationTextValidator = v.optional(v.string());

export const ingestSkillInvocationArgsValidator = {
  skillId: v.string(),
  skillPath: v.string(),
  sourceTool: v.string(),
  sourceEvent: v.optional(v.string()),
  label: v.optional(v.string()),
  sessionId: optionalSkillInvocationTextValidator,
  turnId: optionalSkillInvocationTextValidator,
  projectPath: optionalSkillInvocationTextValidator,
  occurredAt: v.optional(v.number()),
  stepKey: optionalSkillInvocationTextValidator,
  source: optionalSkillInvocationTextValidator,
};

export const ingestSkillInvocationValidator = v.object(ingestSkillInvocationArgsValidator);
export type IngestSkillInvocationArgs = Infer<typeof ingestSkillInvocationValidator>;

export const skillInvocationDashboardArgsValidator = {
  rangeDays: v.optional(v.number()),
  limit: v.optional(v.number()),
};
