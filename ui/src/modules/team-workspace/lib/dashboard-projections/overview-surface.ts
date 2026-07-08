/**
 * Overview projection model.
 * Inputs are compiled project dashboard JSON rows; outputs are render-safe
 * Overview cards, attention items, reports, and source provenance.
 */

export type OverviewPinCard = {
  id: string;
  label: string;
  value: string;
  description?: string;
  detail: string;
  target: string;
  provider: string;
  status: "available" | "source_gap" | "missing" | "stale";
  priority: number;
  reason?: string;
  cardKind?: "number" | "trend" | "status" | "cost" | "queue";
};

export type OverviewAttentionItem = {
  id: string;
  kind: "gap" | "ticket" | "human_action";
  title: string;
  linkedTicketId?: string;
  ticketStatus?: string;
  attentionReason: string;
  owner: "agent" | "human" | "system";
  firstSeenAt?: string;
  ageHours?: number;
};

export type OverviewReportLink = {
  id: string;
  ref?: string;
  parentRef?: string;
  childRefs?: string[];
  ancestorRefs?: string[];
  groupRef?: string;
  depth?: number;
  label: string;
  kind?: string;
  path: string;
  href?: string;
  summary?: string;
  summaryRows?: string[];
  content?: string;
  intervalId?: string;
  createdAt?: string;
  frontMatter?: Record<string, string>;
  updatedAtMs: number | null;
};

export type OverviewSourceRef = {
  id: string;
  label: string;
  path: string;
  exists: boolean;
  updatedAtMs: number | null;
};

export type OverviewSurface = {
  generatedAt: string;
  projectId: string;
  pins: OverviewPinCard[];
  attention: OverviewAttentionItem[];
  reports: OverviewReportLink[];
  sources: OverviewSourceRef[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  const normalized = stringValue(value).trim();
  return normalized ? normalized : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function pinStatus(value: unknown): OverviewPinCard["status"] {
  return value === "available" || value === "source_gap" || value === "stale" ? value : "missing";
}

function cardKind(value: unknown): OverviewPinCard["cardKind"] {
  return value === "number" ||
    value === "trend" ||
    value === "status" ||
    value === "cost" ||
    value === "queue"
    ? value
    : undefined;
}

function attentionKind(value: unknown): OverviewAttentionItem["kind"] {
  return value === "ticket" || value === "human_action" ? value : "gap";
}

function attentionOwner(value: unknown): OverviewAttentionItem["owner"] {
  return value === "human" || value === "system" ? value : "agent";
}

function parsePins(value: unknown): OverviewPinCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): OverviewPinCard | null => {
      const row = record(entry);
      if (!row) return null;
      const id = stringValue(row.id).trim();
      if (!id) return null;
      return {
        id,
        label: stringValue(row.label) || id,
        value: stringValue(row.value) || "n/a",
        description: optionalString(row.description ?? row.tooltip),
        detail: stringValue(row.detail),
        target: stringValue(row.target),
        provider: stringValue(row.provider) || "provider_missing",
        status: pinStatus(row.status),
        priority: numberValue(row.priority),
        reason: optionalString(row.reason),
        cardKind: cardKind(row.card_kind ?? row.cardKind),
      };
    })
    .filter((pin): pin is OverviewPinCard => Boolean(pin))
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 4);
}

function parseAttention(value: unknown): OverviewAttentionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): OverviewAttentionItem | null => {
      const row = record(entry);
      if (!row) return null;
      const id = stringValue(row.id).trim();
      const title = stringValue(row.title).trim();
      if (!id || !title) return null;
      return {
        id,
        kind: attentionKind(row.kind),
        title,
        linkedTicketId: optionalString(row.linked_ticket_id ?? row.linkedTicketId),
        ticketStatus: optionalString(row.ticket_status ?? row.ticketStatus),
        attentionReason: stringValue(row.attention_reason ?? row.attentionReason),
        owner: attentionOwner(row.owner),
        firstSeenAt: optionalString(row.first_seen_at ?? row.firstSeenAt),
        ageHours:
          typeof row.age_hours === "number" || typeof row.ageHours === "number"
            ? numberValue(row.age_hours ?? row.ageHours)
            : undefined,
      };
    })
    .filter((item): item is OverviewAttentionItem => Boolean(item));
}

function parseReports(value: unknown): OverviewReportLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): OverviewReportLink | null => {
      const row = record(entry);
      if (!row) return null;
      const id = stringValue(row.id).trim();
      const path = stringValue(row.path).trim();
      if (!id || !path) return null;
      return {
        id,
        ref: optionalString(row.ref),
        parentRef: optionalString(row.parent_ref ?? row.parentRef),
        childRefs: stringList(row.children_refs ?? row.childRefs),
        ancestorRefs: stringList(row.ancestor_refs ?? row.ancestorRefs),
        groupRef: optionalString(row.group_ref ?? row.groupRef),
        depth: typeof row.depth === "number" && Number.isFinite(row.depth) ? row.depth : undefined,
        label: stringValue(row.label) || id,
        kind: optionalString(row.kind),
        path,
        href: optionalString(row.href),
        summary: optionalString(row.summary ?? row.ui_summary ?? row.uiSummary),
        summaryRows: stringList(row.summary_rows ?? row.summaryRows),
        content: optionalString(row.content ?? row.body ?? row.markdown),
        intervalId: optionalString(row.interval_id ?? row.intervalId),
        createdAt: optionalString(row.created_at ?? row.createdAt),
        frontMatter: stringRecord(row.front_matter ?? row.frontMatter),
        updatedAtMs: nullableNumber(row.updated_at_ms ?? row.updatedAtMs),
      };
    })
    .filter((report): report is OverviewReportLink => Boolean(report));
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => stringValue(entry).trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  const source = record(value);
  if (!source) return undefined;
  const normalized = Object.fromEntries(
    Object.entries(source)
      .map(([key, entry]) => [key, stringValue(entry)] as const)
      .filter(([, entry]) => entry.trim().length > 0),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function parseSources(value: unknown): OverviewSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): OverviewSourceRef | null => {
      const row = record(entry);
      if (!row) return null;
      const id = stringValue(row.id).trim();
      if (!id) return null;
      return {
        id,
        label: stringValue(row.label) || id,
        path: stringValue(row.path),
        exists: booleanValue(row.exists),
        updatedAtMs: nullableNumber(row.updated_at_ms ?? row.updatedAtMs),
      };
    })
    .filter((source): source is OverviewSourceRef => Boolean(source));
}

export function parseOverviewSurface(value: unknown): OverviewSurface | null {
  const source = record(value);
  if (!source) return null;
  const generatedAt = stringValue(source.generated_at ?? source.generatedAt).trim();
  const projectId = stringValue(source.project_id ?? source.projectId).trim();
  if (!generatedAt || !projectId) return null;
  if (
    !Array.isArray(source.pins) ||
    !Array.isArray(source.attention) ||
    !Array.isArray(source.reports) ||
    !Array.isArray(source.sources)
  ) {
    return null;
  }
  return {
    generatedAt,
    projectId,
    pins: parsePins(source.pins),
    attention: parseAttention(source.attention),
    reports: parseReports(source.reports),
    sources: parseSources(source.sources),
  };
}
