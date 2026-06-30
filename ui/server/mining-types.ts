import { safeMiningId, type JsonObject } from "./mining-sources";

export type MiningProgram = {
  id: string;
  name: string;
  version: string;
  objective: string;
  outputMode: "markdown-json" | "json" | "markdown";
  prompt: string;
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

export const DEFAULT_MINING_PROGRAMS: MiningProgram[] = [
  {
    id: "decision-v1",
    name: "Decision extractor",
    version: "1.1.0",
    objective: "Extract key product, architecture, and workflow decisions from a Codex thread.",
    outputMode: "markdown-json",
    prompt:
      'Read the source Codex thread and return only a JSON array of decision objects. Each object must use this minimal schema: { title: string, problem: string, options: string[], recommendation: string, ticketId?: string, sessionId: string, decisionKind: "product"|"architecture"|"workflow"|"implementation", confidence: "low"|"medium"|"high" }. Exclude automation prompts, routing wrappers, and routine status chatter. If no real decision is present, return [].',
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
  },
  {
    id: "trajectory-v1",
    name: "Trajectory miner",
    version: "1.0.0",
    objective: "Find high-value trajectories across a thread: intent, pivots, completed work, and next leverage.",
    outputMode: "markdown-json",
    prompt:
      "Read the source Codex thread. Return a compact trajectory with original intent, pivots, final state, high-value artifacts, missed opportunities, and reusable follow-up actions.",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  },
  {
    id: "learning-v1",
    name: "Learning miner",
    version: "1.0.0",
    objective: "Extract durable lessons, troubles, and prevention rules from old work.",
    outputMode: "markdown-json",
    prompt:
      "Read the source Codex thread. Return lessons, repeated troubles, corrected assumptions, prevention rules, and candidate docs or skills that should receive the learning.",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  },
  {
    id: "ticket-completion-audit-v1",
    name: "Ticket completion audit",
    version: "0.2.0",
    objective:
      "Score completed ticket execution from a structured ticket-completion packet with deterministic metrics, ticket-folder context, decisions, and bounded transcript refs.",
    outputMode: "markdown-json",
    prompt:
      "Read packet.json and score the completed ticket without inventing unavailable metrics. Use deterministic metrics as provided, inspect ticket folder context, mined decisions, proof artifacts, and bounded transcript context, then return scorecard.json/scorecard.md fields for scope following, program adherence, proof quality, missed steps, correction handling, efficiency, decision quality, regression risk, and next improvements. Token usage and turns must remain unknown unless reliable source data is present.",
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
  },
];

export function normalizeProgram(value: unknown): MiningProgram | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = safeMiningId(String(row.id ?? ""), "");
  const name = String(row.name ?? "").trim();
  const prompt = String(row.prompt ?? "").trim();
  if (!id || !name || !prompt) return null;
  const now = new Date().toISOString();
  const outputMode = String(row.outputMode ?? row.output_mode ?? "markdown-json");
  return {
    id,
    name,
    version: String(row.version ?? "1.0.0").trim() || "1.0.0",
    objective: String(row.objective ?? "").trim() || "Mine useful outputs from a Codex thread.",
    outputMode: outputMode === "json" || outputMode === "markdown" ? outputMode : "markdown-json",
    prompt,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : now,
  };
}

export function normalizeRunIndexEntry(value: unknown): MiningRunIndexEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const runId = String(row.runId ?? row.run_id ?? "").trim();
  const programId = String(row.programId ?? row.program_id ?? "").trim();
  if (!runId || !programId) return null;
  const status = String(row.status ?? "queued");
  return {
    runId,
    miningMode:
      row.miningMode === "event_triggered" ||
      row.miningMode === "ticket_completion" ||
      row.miningMode === "manual_selected"
        ? row.miningMode
        : "historical_backfill",
    source:
      row.source === "hook" ||
      row.source === "manual" ||
      row.source === "provider" ||
      row.source === "automation"
        ? row.source
        : "backfill",
    programId,
    programVersion: String(row.programVersion ?? row.program_version ?? "1.0.0"),
    label: String(row.label ?? runId),
    mode: row.mode === "worker" ? "worker" : "dry-run",
    status: status === "running" || status === "complete" || status === "failed" ? status : "queued",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    completedAt: typeof row.completedAt === "string" ? row.completedAt : undefined,
    sourceCount: Number(row.sourceCount ?? row.source_count ?? 0),
    outputCount: Number(row.outputCount ?? row.output_count ?? 0),
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
