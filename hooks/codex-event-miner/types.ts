/**
 * CODEX EVENT MINER TYPES
 * =======================
 * Ownership: Codex event miner hook package.
 * Inputs/outputs: shared event, metadata, parse option, and window-state shapes.
 * Side effects: none.
 * Invariants: contracts stay compact and telemetry-safe; raw transcript fields are not modeled here.
 */

export type JsonRecord = Record<string, unknown>;

export type MinerEventName =
  | "miner.window.updated"
  | "miner.agent.skipped"
  | "miner.agent.queued"
  | "miner.agent.launched"
  | "miner.agent.failed"
  | "miner.agent.completed"
  | "decision.observed"
  | "learning.lesson.observed"
  | "learning.trouble.observed";

export type MinerMetadata = {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  projectPath?: string;
  projectId?: string;
};

export type MinerEventCandidate = {
  eventName: MinerEventName;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  ticketId?: string;
  projectPath?: string;
  projectId?: string;
  sourceProgram: string;
  source: "stop_payload" | "window_cadence" | "miner_agent" | "miner_agent_report";
  status?: string;
  severity?: "low" | "medium" | "high";
  summary: string;
  decisionKind?: "architecture" | "scope" | "implementation" | "product" | "workflow";
  reviewRunPath?: string;
  docsDelta?: {
    target?: string;
    rowsAdded?: number;
  };
  turnCount?: number;
  cadenceTurns?: number;
  nextReviewInTurns?: number;
  occurredAt: number;
  eventKey: string;
};

export type MinerProgramSpec = {
  id: string;
  description: string;
  cadenceTurns: number;
  outputEvents: string[];
  sink: Array<"telemetry" | "docs" | "report">;
  instructions: string[];
  schema: Record<string, unknown>;
};

export type MinerAgentLaunchRequest = {
  sessionId: string;
  turnId?: string;
  ticketId?: string;
  projectPath: string;
  projectId?: string;
  transcriptPath?: string;
  eventAt: number;
  programs: MinerProgramSpec[];
  turnCount: number;
  cadenceTurns: number;
};

export type MinerAgentLaunchResult = {
  status: "launched" | "failed" | "dry_run";
  reason: string;
  runPath?: string;
  pid?: number;
};

export type MinerWindowState = {
  sessionId: string;
  turnCount: number;
  lastReviewTurnCount: number;
  seenTurnIds: string[];
  emittedReportKeys: string[];
  updatedAt: number;
};

export type MinerParseOptions = {
  cadenceTurns?: number;
  windowState?: MinerWindowState;
  includeReviewReports?: boolean;
  maxReviewReports?: number;
  programs?: MinerProgramSpec[];
};

export type PublishMinerEventsOptions = {
  endpointBaseUrl?: string;
  telemetryToken?: string;
  fetchImpl?: typeof fetch;
};

export const DEFAULT_CADENCE_TURNS = 5;
export const MAX_SEEN_TURN_IDS = 160;
export const MAX_EMITTED_REPORT_KEYS = 500;
