/**
 * FARPLANE FILE EVENT REGISTRY
 * ============================
 * Ownership: Farplane file-change hook.
 * Inputs: tracked project-relative file paths and bounded file text.
 * Outputs: compact typed file events and sanitized parser snapshots.
 * Side effects: none; callers own snapshot persistence and telemetry publish.
 */
import { createHash } from "node:crypto";

export type FarplaneFileKind =
  | "ticket"
  | "ticket_program"
  | "ticket_progress"
  | "goal"
  | "product"
  | "harness"
  | "automation"
  | "binding"
  | "config"
  | "memory"
  | "learning"
  | "history"
  | "taste"
  | "doc"
  | "unknown";

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

export type FieldPreview = {
  hash: string;
  preview?: string;
};

export type FrontmatterDiff = {
  changed: Record<string, { before?: FieldPreview; after?: FieldPreview }>;
  added: string[];
  removed: string[];
};

export type ChangedField = {
  path: string;
  before?: FieldPreview;
  after?: FieldPreview;
};

export type FarplaneFileSnapshot = {
  schemaVersion: 1;
  kind: FarplaneFileKind;
  path: string;
  entityKind: string;
  entityId?: string;
  contentHash: string;
  frontmatter?: Record<string, FieldPreview>;
  jsonFields?: Record<string, FieldPreview>;
  headings: string[];
  lineCount: number;
  terminal?: boolean;
  updatedAt: number;
};

export type FarplaneFileEvent = {
  schemaVersion: 1;
  eventName: FarplaneFileEventName;
  source: "local_file_post_tool_use" | "provider_webhook";
  projectId?: string;
  sessionId?: string;
  threadId?: string;
  path?: string;
  provider?: string;
  externalId?: string;
  entityKind: string;
  entityId?: string;
  contentHash: string;
  frontmatterDiff?: FrontmatterDiff;
  changedFields?: ChangedField[];
  sectionHints?: string[];
  terminal?: boolean;
  firstObservation?: boolean;
  summary?: string;
  eventAt: number;
  eventKey: string;
};

export type FarplaneFileEventInput = {
  path: string;
  text: string;
  previous?: FarplaneFileSnapshot;
  eventAt: number;
  projectId?: string;
  sessionId?: string;
  threadId?: string;
};

const PREVIEW_LIMIT = 120;
const MAX_CHANGED_FIELDS = 12;
const MAX_SECTION_HINTS = 8;
const TERMINAL_VALUES = new Set(["done", "complete", "completed", "closed"]);

function hashText(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function previewValue(value: unknown): FieldPreview {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return {
    hash: hashText(text),
    preview: text ? text.slice(0, PREVIEW_LIMIT) : undefined,
  };
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function ticketIdFromPath(filePath: string): string | undefined {
  return filePath.match(/(?:^|\/)(TASK-\d+)\//i)?.[1]?.toUpperCase();
}

export function classifyFarplaneFile(filePath: string): FarplaneFileKind {
  const normalized = normalizePath(filePath);
  if (/^tickets\/TASK-\d+\/ticket\.md$/i.test(normalized)) return "ticket";
  if (/^tickets\/TASK-\d+\/program\.md$/i.test(normalized)) return "ticket_program";
  if (/^tickets\/TASK-\d+\/progress\.md$/i.test(normalized)) return "ticket_progress";
  if (/^(?:farplane\/)?goals\.md$/i.test(normalized)) return "goal";
  if (/^farplane\/products\.md$/i.test(normalized)) return "product";
  if (/^farplane\/harness\.md$/i.test(normalized)) return "harness";
  if (/^farplane\/automations\.md$/i.test(normalized)) return "automation";
  if (/^farplane\/bindings\.md$/i.test(normalized)) return "binding";
  if (/^farplane\/(?:manifest|hooks|pm)\.json$/i.test(normalized)) return "config";
  if (/^docs\/MEMORY\.md$/i.test(normalized)) return "memory";
  if (/^docs\/(?:LESSONS|TROUBLES)\.md$/i.test(normalized)) return "learning";
  if (/^docs\/HISTORY\.md$/i.test(normalized)) return "history";
  if (/^docs\/TASTE\.md$/i.test(normalized)) return "taste";
  if (/^docs\/.*\.md$/i.test(normalized)) return "doc";
  if (/^progress\.md$/i.test(normalized)) return "ticket_progress";
  return "unknown";
}

function entityKindForFile(kind: FarplaneFileKind): string {
  if (kind === "ticket" || kind === "ticket_program" || kind === "ticket_progress") return "ticket";
  if (kind === "goal") return "goal";
  if (kind === "product") return "product";
  if (kind === "harness") return "harness";
  if (kind === "automation") return "automation";
  if (kind === "binding") return "binding";
  if (kind === "config") return "config";
  if (kind === "memory") return "memory";
  if (kind === "learning") return "learning";
  if (kind === "history") return "history";
  if (kind === "taste") return "taste";
  return "doc";
}

function eventNameForKind(kind: FarplaneFileKind, input: { terminal?: boolean; completed?: boolean }): FarplaneFileEventName {
  if (input.completed) return "farplane.ticket.completed";
  if (kind === "ticket") return "farplane.ticket.changed";
  if (kind === "ticket_program") return "farplane.ticket.program.changed";
  if (kind === "ticket_progress") return "farplane.ticket.progress.changed";
  if (kind === "goal") return "farplane.goals.changed";
  if (kind === "product") return "farplane.products.changed";
  if (kind === "harness") return "farplane.harness.changed";
  if (kind === "automation") return "farplane.automations.changed";
  if (kind === "binding") return "farplane.bindings.changed";
  if (kind === "config") return "farplane.config.changed";
  if (kind === "memory") return "farplane.memory.changed";
  if (kind === "learning") return "farplane.learning.changed";
  if (kind === "history") return "farplane.history.changed";
  if (kind === "taste") return "farplane.taste.changed";
  return "farplane.file.changed";
}

function parseFrontmatter(text: string): Record<string, FieldPreview> {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};
  const frontmatter = text.slice(3, end).split(/\r?\n/g);
  const values: Record<string, FieldPreview> = {};
  for (const line of frontmatter) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1]?.trim();
    if (!key) continue;
    const value = (match[2] ?? "").replace(/^['"]|['"]$/g, "");
    values[key] = previewValue(value);
  }
  return values;
}

function parseRawFrontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};
  const frontmatter = text.slice(3, end).split(/\r?\n/g);
  const values: Record<string, string> = {};
  for (const line of frontmatter) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match?.[1]) continue;
    values[match[1].trim()] = (match[2] ?? "").replace(/^['"]|['"]$/g, "").trim();
  }
  return values;
}

function parseHeadings(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/)?.[2]?.trim())
    .filter((heading): heading is string => Boolean(heading))
    .slice(0, MAX_SECTION_HINTS);
}

function parseJsonFields(text: string): Record<string, FieldPreview> {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const fields: Record<string, FieldPreview> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      fields[key] = previewValue(JSON.stringify(value));
    }
    return fields;
  } catch {
    return {};
  }
}

function diffPreviewRecords(
  before: Record<string, FieldPreview> | undefined,
  after: Record<string, FieldPreview> | undefined,
): { diff?: FrontmatterDiff; changedFields: ChangedField[] } {
  const previous = before ?? {};
  const next = after ?? {};
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort();
  const changed: FrontmatterDiff["changed"] = {};
  const added: string[] = [];
  const removed: string[] = [];
  const changedFields: ChangedField[] = [];
  for (const key of keys) {
    const left = previous[key];
    const right = next[key];
    if (!left && right) added.push(key);
    if (left && !right) removed.push(key);
    if (left?.hash !== right?.hash) {
      if (left || right) {
        changed[key] = { before: left, after: right };
        changedFields.push({ path: key, before: left, after: right });
      }
    }
  }
  const diff = Object.keys(changed).length || added.length || removed.length ? { changed, added, removed } : undefined;
  return { diff, changedFields: changedFields.slice(0, MAX_CHANGED_FIELDS) };
}

function isTerminalTicket(frontmatter: Record<string, string>): boolean {
  const status = frontmatter.status?.toLowerCase();
  const phase = frontmatter.phase?.toLowerCase();
  const nextAction = frontmatter.next_action?.toLowerCase();
  return Boolean(
    (status && TERMINAL_VALUES.has(status)) ||
      (phase && TERMINAL_VALUES.has(phase)) ||
      nextAction === "done",
  );
}

function buildSnapshot(input: {
  path: string;
  kind: FarplaneFileKind;
  text: string;
  eventAt: number;
}): FarplaneFileSnapshot {
  const contentHash = hashText(input.text);
  const entityKind = entityKindForFile(input.kind);
  const frontmatter = parseFrontmatter(input.text);
  const rawFrontmatter = parseRawFrontmatter(input.text);
  const jsonFields = input.path.endsWith(".json") ? parseJsonFields(input.text) : undefined;
  return {
    schemaVersion: 1,
    kind: input.kind,
    path: input.path,
    entityKind,
    entityId: ticketIdFromPath(input.path) ?? (entityKind === "config" ? input.path : undefined),
    contentHash,
    frontmatter: Object.keys(frontmatter).length ? frontmatter : undefined,
    jsonFields: jsonFields && Object.keys(jsonFields).length ? jsonFields : undefined,
    headings: parseHeadings(input.text),
    lineCount: input.text.split(/\r?\n/g).length,
    terminal: input.kind === "ticket" ? isTerminalTicket(rawFrontmatter) : undefined,
    updatedAt: input.eventAt,
  };
}

function compactSummary(snapshot: FarplaneFileSnapshot): string {
  const entity = snapshot.entityId ? `${snapshot.entityKind} ${snapshot.entityId}` : snapshot.entityKind;
  return `${entity} changed`;
}

export function parseFarplaneFileEvent(input: FarplaneFileEventInput): {
  event: FarplaneFileEvent | null;
  snapshot: FarplaneFileSnapshot | null;
} {
  const normalized = normalizePath(input.path);
  const kind = classifyFarplaneFile(normalized);
  if (kind === "unknown") return { event: null, snapshot: null };
  const snapshot = buildSnapshot({ path: normalized, kind, text: input.text, eventAt: input.eventAt });
  const firstObservation = !input.previous;
  const previousMatches = input.previous?.kind === kind ? input.previous : undefined;
  const completed = kind === "ticket" && snapshot.terminal === true && previousMatches?.terminal === false;
  const frontmatter = diffPreviewRecords(previousMatches?.frontmatter, snapshot.frontmatter);
  const json = diffPreviewRecords(previousMatches?.jsonFields, snapshot.jsonFields);
  const changedFields = [...frontmatter.changedFields, ...json.changedFields.map((field) => ({
    ...field,
    path: `json.${field.path}`,
  }))].slice(0, MAX_CHANGED_FIELDS);
  const sectionHints = snapshot.headings;
  const eventName = eventNameForKind(kind, { terminal: snapshot.terminal, completed });
  const eventKeyHash = hashText(
    [
      normalized,
      eventName,
      snapshot.contentHash,
      previousMatches?.contentHash ?? "first",
      input.sessionId ?? "",
      input.threadId ?? "",
    ].join("\n"),
  );
  return {
    snapshot,
    event: {
      schemaVersion: 1,
      eventName,
      source: "local_file_post_tool_use",
      projectId: input.projectId,
      sessionId: input.sessionId,
      threadId: input.threadId,
      path: normalized,
      entityKind: snapshot.entityKind,
      entityId: snapshot.entityId,
      contentHash: snapshot.contentHash,
      frontmatterDiff: frontmatter.diff,
      changedFields: changedFields.length ? changedFields : undefined,
      sectionHints: sectionHints.length ? sectionHints : undefined,
      terminal: snapshot.terminal,
      firstObservation,
      summary: compactSummary(snapshot),
      eventAt: input.eventAt,
      eventKey: `farplane-file-event:${input.threadId ?? input.sessionId ?? "thread"}:${normalized}:${eventKeyHash}`.slice(
        0,
        500,
      ),
    },
  };
}
