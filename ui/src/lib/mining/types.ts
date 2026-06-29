/**
 * Mining contracts
 * Inputs: historical thread selections, file events, provider events, and ticket packets.
 * Outputs: browser-safe MiningProgram, MiningRun, source, attempt, and output types.
 * Side effects: none; filesystem persistence is owned by the Vite bridge.
 */

export type MiningOutputMode = "markdown-json" | "json" | "markdown";

export type MiningProgram = {
  id: string;
  name: string;
  version: string;
  objective: string;
  outputMode: MiningOutputMode;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type MiningRunMode =
  | "historical_backfill"
  | "event_triggered"
  | "ticket_completion"
  | "manual_selected";

export type MiningRunSource = "hook" | "backfill" | "manual" | "provider" | "automation";

export type MiningSourceKind =
  | "codex_thread"
  | "message_window"
  | "ticket_packet"
  | "file_event"
  | "provider_event";

export type MiningRunStatus = "queued" | "running" | "complete" | "failed" | "canceled";

export type MiningAttemptExecutorKind = "local_worker" | "codex_exec" | "codex_thread";

export type MiningAttempt = {
  attemptId: string;
  executorKind: MiningAttemptExecutorKind;
  executorRef?: string;
  startedAt: string;
  completedAt?: string;
  status: MiningRunStatus;
  logsPath?: string;
};

export type MiningSource = {
  sourceId: string;
  sourceKind: MiningSourceKind;
  inputRef: string;
  name?: string;
  preview?: string;
  ticketId?: string;
  sessionId?: string;
  threadId?: string;
  sourceEventKey?: string;
  provider?: string;
  externalId?: string;
  cwd?: string;
  updatedAt?: number;
};

export type MiningRunIndexEntry = {
  runId: string;
  mode: MiningRunMode;
  source: MiningRunSource;
  programId: string;
  programVersion: string;
  label: string;
  executorMode?: "dry-run" | "worker";
  status: MiningRunStatus;
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

export type MiningOutput = {
  outputId: string;
  sourceId: string;
  status: "complete" | "failed";
  verdict: "unreviewed" | "promoted" | "rejected";
  redactionStatus: "clean" | "needs_review" | "redacted";
  summary: string;
  outputMarkdownPath: string;
  outputJsonPath: string;
  decisionsJsonPath?: string;
  redactionMarkdownPath?: string;
  telemetryJsonPath?: string;
  telemetryEvents?: Array<Record<string, unknown>>;
};

export type CreateMiningRunInput = {
  mode: MiningRunMode;
  source: MiningRunSource;
  programId: string;
  threadIds?: string[];
  sources?: MiningSource[];
  filters?: {
    lastDays?: number;
    limit?: number;
  };
  executorMode?: "dry-run" | "worker";
  sourceEventKey?: string;
};
