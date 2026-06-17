import { type Infer, v } from "convex/values";

export const KNOWN_CODEX_HOOK_TYPES = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PreCompact",
  "PostCompact",
  "SubagentStart",
  "SubagentStop",
  "Stop",
] as const;

export const hookTelemetryPayloadValidator = v.object({
  hookName: v.string(),
  hookType: v.string(),
  projectId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  payload: v.optional(v.any()),
  eventAt: v.optional(v.number()),
  eventKey: v.optional(v.string()),
});

export type HookTelemetryPayload = Infer<typeof hookTelemetryPayloadValidator>;

export const ingestHookTelemetryArgsValidator = {
  hookName: v.string(),
  hookType: v.string(),
  projectId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  payload: v.optional(v.any()),
  eventAt: v.number(),
  eventKey: v.optional(v.string()),
};

export const ingestHookTelemetryValidator = v.object(ingestHookTelemetryArgsValidator);
export type IngestHookTelemetryArgs = Infer<typeof ingestHookTelemetryValidator>;

export const ingestHookTelemetryBatchArgsValidator = {
  events: v.array(ingestHookTelemetryValidator),
};

export const hookTelemetryWindowArgsValidator = {
  hookName: v.optional(v.string()),
  hookType: v.optional(v.string()),
  eventName: v.optional(v.string()),
  projectId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  rangeDays: v.optional(v.number()),
  limit: v.optional(v.number()),
};

export const hookTelemetryBubbleArgsValidator = {
  projectId: v.optional(v.string()),
  sessionIds: v.optional(v.array(v.string())),
  rangeMs: v.optional(v.number()),
  limit: v.optional(v.number()),
};
