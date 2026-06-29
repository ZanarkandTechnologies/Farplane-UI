/**
 * FARPLANE FILE EVENT TELEMETRY CONTRACT
 * ======================================
 * Ownership: hook telemetry module.
 * Inputs/outputs: typed `farplane.*` event payloads accepted from hook telemetry.
 * Side effects: none.
 * Invariants: guards expose compact metadata only; raw file bodies remain outside this contract.
 */
import { type Infer, v } from "convex/values";

export const FARPLANE_FILE_EVENT_NAMES = [
  "farplane.ticket.changed",
  "farplane.ticket.completed",
  "farplane.ticket.program.changed",
  "farplane.ticket.progress.changed",
  "farplane.goals.changed",
  "farplane.products.changed",
  "farplane.harness.changed",
  "farplane.automations.changed",
  "farplane.bindings.changed",
  "farplane.config.changed",
  "farplane.memory.changed",
  "farplane.learning.changed",
  "farplane.history.changed",
  "farplane.taste.changed",
  "farplane.file.changed",
] as const;

export type FarplaneFileEventName = (typeof FARPLANE_FILE_EVENT_NAMES)[number];

export const farplaneFileEventNameValidator = v.union(
  v.literal("farplane.ticket.changed"),
  v.literal("farplane.ticket.completed"),
  v.literal("farplane.ticket.program.changed"),
  v.literal("farplane.ticket.progress.changed"),
  v.literal("farplane.goals.changed"),
  v.literal("farplane.products.changed"),
  v.literal("farplane.harness.changed"),
  v.literal("farplane.automations.changed"),
  v.literal("farplane.bindings.changed"),
  v.literal("farplane.config.changed"),
  v.literal("farplane.memory.changed"),
  v.literal("farplane.learning.changed"),
  v.literal("farplane.history.changed"),
  v.literal("farplane.taste.changed"),
  v.literal("farplane.file.changed"),
);

export const fieldPreviewValidator = v.object({
  hash: v.string(),
  preview: v.optional(v.string()),
});

export const changedFieldValidator = v.object({
  path: v.string(),
  before: v.optional(fieldPreviewValidator),
  after: v.optional(fieldPreviewValidator),
});

export const frontmatterDiffValidator = v.object({
  changed: v.record(v.string(), v.object({
    before: v.optional(fieldPreviewValidator),
    after: v.optional(fieldPreviewValidator),
  })),
  added: v.array(v.string()),
  removed: v.array(v.string()),
});

export const farplaneFileEventPayloadValidator = v.object({
  schemaVersion: v.literal(1),
  eventName: farplaneFileEventNameValidator,
  source: v.union(v.literal("local_file_post_tool_use"), v.literal("provider_webhook")),
  projectId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  threadId: v.optional(v.string()),
  path: v.optional(v.string()),
  provider: v.optional(v.string()),
  externalId: v.optional(v.string()),
  entityKind: v.string(),
  entityId: v.optional(v.string()),
  contentHash: v.string(),
  frontmatterDiff: v.optional(frontmatterDiffValidator),
  changedFields: v.optional(v.array(changedFieldValidator)),
  sectionHints: v.optional(v.array(v.string())),
  terminal: v.optional(v.boolean()),
  firstObservation: v.optional(v.boolean()),
  summary: v.optional(v.string()),
  cwd: v.optional(v.string()),
  eventAt: v.number(),
  eventKey: v.string(),
});

export type FieldPreview = Infer<typeof fieldPreviewValidator>;
export type ChangedField = Infer<typeof changedFieldValidator>;
export type FrontmatterDiff = Infer<typeof frontmatterDiffValidator>;
export type FarplaneFileEventPayload = Infer<typeof farplaneFileEventPayloadValidator>;

const FARPLANE_FILE_EVENT_NAME_SET = new Set<string>(FARPLANE_FILE_EVENT_NAMES);
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "body",
  "rawBody",
  "rawFile",
  "rawDiff",
  "content",
  "transcript",
  "toolOutput",
  "toolResponse",
  "stdout",
  "stderr",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isFieldPreview(value: unknown): value is FieldPreview {
  return isRecord(value) && isString(value.hash) && (typeof value.preview === "undefined" || typeof value.preview === "string");
}

function isChangedField(value: unknown): value is ChangedField {
  if (!isRecord(value) || !isString(value.path)) return false;
  return (
    (typeof value.before === "undefined" || isFieldPreview(value.before)) &&
    (typeof value.after === "undefined" || isFieldPreview(value.after))
  );
}

function isFrontmatterDiff(value: unknown): value is FrontmatterDiff {
  if (!isRecord(value) || !isRecord(value.changed) || !isStringArray(value.added) || !isStringArray(value.removed)) return false;
  return Object.values(value.changed).every((entry) => {
    if (!isRecord(entry)) return false;
    return (
      (typeof entry.before === "undefined" || isFieldPreview(entry.before)) &&
      (typeof entry.after === "undefined" || isFieldPreview(entry.after))
    );
  });
}

export function isFarplaneFileEventName(value: unknown): value is FarplaneFileEventName {
  return typeof value === "string" && FARPLANE_FILE_EVENT_NAME_SET.has(value);
}

export function isFarplaneFileEventPayload(value: unknown): value is FarplaneFileEventPayload {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => FORBIDDEN_PAYLOAD_KEYS.has(key))) return false;
  if (value.schemaVersion !== 1 || !isFarplaneFileEventName(value.eventName)) return false;
  if (value.source !== "local_file_post_tool_use" && value.source !== "provider_webhook") return false;
  if (!isString(value.entityKind) || !isString(value.contentHash) || !isNumber(value.eventAt) || !isString(value.eventKey)) return false;
  if (typeof value.changedFields !== "undefined" && (!Array.isArray(value.changedFields) || !value.changedFields.every(isChangedField))) return false;
  if (typeof value.frontmatterDiff !== "undefined" && !isFrontmatterDiff(value.frontmatterDiff)) return false;
  if (typeof value.sectionHints !== "undefined" && !isStringArray(value.sectionHints)) return false;
  return true;
}
