export type ThreadDataProgram = {
  id: string;
  name: string;
  version: string;
  objective: string;
  outputMode: "markdown-json" | "json" | "markdown";
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type ThreadDataSource = {
  id: string;
  sessionId?: string;
  name: string;
  preview: string;
  cwd?: string;
  updatedAt?: number;
  sourceKind?: string;
};

export type ThreadDataRunStatus = "queued" | "running" | "complete" | "failed";

export type ThreadDataRunIndexEntry = {
  runId: string;
  miningMode?: "historical_backfill" | "event_triggered" | "ticket_completion" | "manual_selected";
  source?: "hook" | "backfill" | "manual" | "provider" | "automation";
  programId: string;
  programVersion: string;
  label: string;
  mode?: "dry-run" | "worker";
  status: ThreadDataRunStatus;
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

export type ThreadDataRunOutput = {
  id: string;
  sessionId: string;
  threadId: string;
  ticketId?: string;
  sourceTitle: string;
  status: "complete" | "failed";
  verdict: "unreviewed" | "promoted" | "rejected";
  redactionStatus: "clean" | "needs_review" | "redacted";
  summary: string;
  outputMarkdownPath: string;
  outputJsonPath: string;
  decisionsJsonPath?: string;
  redactionMarkdownPath?: string;
  outputMarkdown?: string;
  outputJson?: unknown;
  outputScorecard?: unknown;
  scorecardMarkdown?: string;
  outputDecisions?: unknown;
  redactionMarkdown?: string;
  telemetryEvents?: Array<Record<string, unknown>>;
};

export type ThreadDataAttempt = {
  attemptId: string;
  executorKind?: string;
  startedAt?: string;
  completedAt?: string;
  status?: string;
  reason?: string;
};

export type ThreadDataArtifact = {
  id: string;
  label: string;
  kind: "json" | "markdown" | "output" | "folder";
  path: string;
  content?: string;
};

export type ThreadDataRunDetail = {
  run: ThreadDataRunIndexEntry & {
    root: string;
    reportPath: string;
    promptPath: string;
  };
  program: ThreadDataProgram | null;
  sources: ThreadDataSource[];
  outputs: ThreadDataRunOutput[];
  attempts?: ThreadDataAttempt[];
  artifacts?: ThreadDataArtifact[];
  inputJson?: unknown;
  sourcesJson?: unknown;
  reportMarkdown: string;
  parentPrompt: string;
};

export type ThreadDataProgramsResponse = {
  ok: boolean;
  mineRoot?: string;
  programs: ThreadDataProgram[];
  error?: string;
};

export type ThreadDataThreadsResponse = {
  ok: boolean;
  threads: ThreadDataSource[];
  error?: string;
};

export type ThreadDataRunsResponse = {
  ok: boolean;
  mineRoot?: string;
  exists?: boolean;
  runs: ThreadDataRunIndexEntry[];
  latest: ThreadDataRunIndexEntry | null;
  error?: string;
};

export type ThreadDataRunResponse = {
  ok: boolean;
  mineRoot?: string;
  detail: ThreadDataRunDetail | null;
  error?: string;
};
