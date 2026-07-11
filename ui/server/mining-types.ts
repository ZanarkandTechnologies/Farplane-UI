import { safeMiningId, type JsonObject } from "./mining-sources";

export type MiningProgram = {
  id: string;
  name: string;
  version: string;
  objective: string;
  outputMode: "markdown-json" | "json" | "markdown";
  prompt?: string;
  programRef?: string;
  programDigest?: string;
  immutable: true;
  createdAt: string;
  updatedAt: string;
};

export type MiningRunIndexEntry = {
  runId: string;
  miningMode?: "historical_backfill" | "event_triggered" | "ticket_completion" | "manual_selected";
  source?: "hook" | "backfill" | "manual" | "provider" | "automation";
  programId: string;
  programVersion: string;
  label: string;
  mode?: "dry-run" | "worker";
  status: "queued" | "running" | "complete" | "failed";
  createdAt: string;
  completedAt?: string;
  sourceCount: number;
  outputCount: number;
  reviewedCount: number;
  promotedCount: number;
  rejectedCount: number;
  privacyIssueCount?: number;
  duplicateCount?: number;
  rejectedSourceCount?: number;
};

export type MiningLocalApi = {
  listPrograms: () => Promise<MiningProgram[]>;
  saveProgram: (input: unknown) => Promise<MiningProgram[]>;
  listThreadSources: (input: { limit: number; lastDays?: number }) => Promise<MiningThreadSource[]>;
  listRuns: () => Promise<MiningRunIndexEntry[]>;
  createRun: (input: unknown) => Promise<JsonObject | null>;
  readRun: (runId: string) => Promise<JsonObject | null>;
  replayRun: (runId: string) => Promise<JsonObject | null>;
  updateOutputVerdict: (input: {
    runId: string;
    outputId: string;
    verdict: "unreviewed" | "promoted" | "rejected";
  }) => Promise<JsonObject | null>;
  runsExist: () => Promise<boolean>;
};

export type MiningLocalApiDeps = {
  mineRoot: string;
  requestCodexThreads: (limit: number) => Promise<unknown>;
  readFilesystemThreads: (limit: number) => Promise<JsonObject[]>;
  now?: () => Date;
};

export function normalizeProgram(value: unknown): MiningProgram | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = safeMiningId(String(row.id ?? row.program_id ?? ""), "");
  const name = String(row.name ?? row.program_id ?? row.id ?? "").trim();
  if (!id || !name) return null;
  const now = new Date().toISOString();
  const outputMode = String(row.outputMode ?? row.output_mode ?? "markdown-json");
  return {
    id,
    name,
    version: String(row.version ?? "1.0.0").trim() || "1.0.0",
    objective: String(row.objective ?? "").trim() || "Mine useful outputs from a Codex thread.",
    outputMode: outputMode === "json" || outputMode === "markdown" ? outputMode : "markdown-json",
    prompt: String(row.prompt ?? "").trim() || undefined,
    programRef: String(row.programRef ?? row.program_ref ?? row.ref ?? "").trim() || undefined,
    programDigest: String(row.programDigest ?? row.program_digest ?? row.digest ?? "").trim() || undefined,
    immutable: true,
    createdAt:
      typeof (row.createdAt ?? row.created_at) === "string"
        ? String(row.createdAt ?? row.created_at)
        : now,
    updatedAt:
      typeof (row.updatedAt ?? row.updated_at) === "string"
        ? String(row.updatedAt ?? row.updated_at)
        : now,
  };
}

export function normalizeRunIndexEntry(value: unknown): MiningRunIndexEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const runId = String(row.runId ?? row.run_id ?? "").trim();
  const programRef = row.program_ref && typeof row.program_ref === "object" ? row.program_ref as JsonObject : {};
  const programId = String(
    row.programId ??
      row.program_id ??
      programRef.id ??
      (typeof row.program_ref === "string" ? row.program_ref : row.program ?? ""),
  ).trim();
  if (!runId || !programId) return null;
  const status = String(row.status ?? "queued");
  return {
    runId,
    miningMode:
      row.miningMode === "event_triggered" ||
      row.miningMode === "ticket_completion" ||
      row.miningMode === "manual_selected"
        ? row.miningMode
        : row.route_id || row.routeId
          ? "event_triggered"
          : "historical_backfill",
    source:
      row.source === "hook" ||
      row.source === "manual" ||
      row.source === "provider" ||
      row.source === "automation"
        ? row.source
        : "backfill",
    programId,
    programVersion: String(row.programVersion ?? row.program_version ?? programRef.version ?? "1.0.0"),
    label: String(row.label ?? runId),
    mode: row.mode === "worker" ? "worker" : "dry-run",
    status: status === "running" || status === "complete" || status === "failed" ? status : "queued",
    createdAt:
      typeof (row.createdAt ?? row.created_at) === "string"
        ? String(row.createdAt ?? row.created_at)
        : new Date().toISOString(),
    completedAt:
      typeof (row.completedAt ?? row.completed_at) === "string"
        ? String(row.completedAt ?? row.completed_at)
        : undefined,
    sourceCount: Number(row.sourceCount ?? row.source_count ?? (Array.isArray(row.input_manifest) ? row.input_manifest.length : 0)),
    outputCount: Number(row.outputCount ?? row.output_count ?? (Array.isArray(row.outputs) ? row.outputs.length : 0)),
    reviewedCount: Number(row.reviewedCount ?? row.reviewed_count ?? 0),
    promotedCount: Number(row.promotedCount ?? row.promoted_count ?? 0),
    rejectedCount: Number(row.rejectedCount ?? row.rejected_count ?? 0),
    privacyIssueCount: Number(row.privacyIssueCount ?? row.privacy_issue_count ?? 0),
    duplicateCount: Number(row.duplicateCount ?? row.duplicate_count ?? 0),
    rejectedSourceCount: Number(row.rejectedSourceCount ?? row.rejected_source_count ?? 0),
  };
}

export function sortRunIndex(entries: MiningRunIndexEntry[]): MiningRunIndexEntry[] {
  return [...entries].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}
