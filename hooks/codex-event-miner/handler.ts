/**
 * CODEX EVENT MINER HOOK
 * ======================
 * Ownership: Codex Stop hook package.
 * Inputs: untrusted Stop hook payload JSON plus local miner state.
 * Outputs: compact learning/decision telemetry envelopes.
 * Side effects: optional local state reads/writes and network publish via outbox.
 * Invariants: raw prompts, transcripts, full assistant messages, and tool output are never published.
 */

import {
  cleanString,
  inferTicketId,
  isRecord,
  resolveMetadata,
  resolveOccurredAt,
  resolveStopEventName,
  eventBase,
  withEventKey,
} from "./helpers";
import { flushReviewReports } from "./reports";
import { advanceWindowState, readMinerWindowState, writeMinerWindowState, minerWindowStatePath } from "./state";
import { DEFAULT_MINER_PROGRAMS } from "./launcher";
import {
  buildMinerTelemetryEnvelope,
  publishMinerEvents,
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "./telemetry";
import {
  DEFAULT_CADENCE_TURNS,
  type MinerAgentLaunchRequest,
  type MinerAgentLaunchResult,
  type MinerEventCandidate,
  type MinerEventName,
  type MinerParseOptions,
  type MinerWindowState,
  type PublishMinerEventsOptions,
} from "./types";

export type {
  MinerEventCandidate,
  MinerEventName,
  MinerParseOptions,
  MinerWindowState,
  PublishMinerEventsOptions,
  MinerAgentLaunchRequest,
  MinerAgentLaunchResult,
} from "./types";

export {
  buildMinerTelemetryEnvelope,
  minerWindowStatePath,
  publishMinerEvents,
  readMinerWindowState,
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
  writeMinerWindowState,
};

function cadenceCandidate(
  metadata: ReturnType<typeof resolveMetadata>,
  ticketId: string | undefined,
  window: MinerWindowState,
  cadenceTurns: number,
  occurredAt: number,
): MinerEventCandidate {
  const turnsSinceReview = Math.max(0, window.turnCount - window.lastReviewTurnCount);
  const due = turnsSinceReview >= cadenceTurns;
  const eventName: MinerEventName = due ? "miner.agent.queued" : "miner.agent.skipped";
  const nextReviewInTurns = due ? 0 : cadenceTurns - turnsSinceReview;
  return withEventKey({
    ...eventBase({
      eventName,
      metadata,
      ticketId,
      sourceProgram: "codex-event-miner",
      source: "window_cadence",
      status: due ? "queued" : "not_due",
      summary: due
        ? `Learning review queued after ${turnsSinceReview} captured turns.`
        : `Learning review not due; ${nextReviewInTurns} turns remaining.`,
      occurredAt,
    }),
    turnCount: window.turnCount,
    cadenceTurns,
    nextReviewInTurns,
  });
}

function windowCandidate(
  metadata: ReturnType<typeof resolveMetadata>,
  ticketId: string | undefined,
  window: MinerWindowState,
  cadenceTurns: number,
  occurredAt: number,
): MinerEventCandidate {
  const turnsSinceReview = Math.max(0, window.turnCount - window.lastReviewTurnCount);
  return withEventKey({
    ...eventBase({
      eventName: "miner.window.updated",
      metadata,
      ticketId,
      sourceProgram: "codex-event-miner",
      source: "stop_payload",
      status: "updated",
      summary: `Captured Stop turn ${window.turnCount}; miner cadence is ${cadenceTurns}.`,
      occurredAt,
    }),
    turnCount: window.turnCount,
    cadenceTurns,
    nextReviewInTurns: Math.max(0, cadenceTurns - turnsSinceReview),
  });
}

export function launchResultCandidate(
  request: MinerAgentLaunchRequest,
  result: MinerAgentLaunchResult,
): MinerEventCandidate {
  const eventName: MinerEventName =
    result.status === "launched" || result.status === "dry_run" ? "miner.agent.launched" : "miner.agent.failed";
  return withEventKey({
    ...eventBase({
      eventName,
      metadata: {
        sessionId: request.sessionId,
        threadId: request.sessionId,
        turnId: request.turnId,
        projectPath: request.projectPath,
        projectId: request.projectId,
      },
      ticketId: request.ticketId,
      sourceProgram: "codex-event-miner",
      source: "stop_payload",
      status: result.status,
      severity: result.status === "failed" ? "high" : "low",
      summary: result.reason,
      occurredAt: request.eventAt,
      reviewRunPath: result.runPath,
    }),
    turnCount: request.turnCount,
    cadenceTurns: request.cadenceTurns,
  });
}

export function parseCodexEventMinerFromPayload(
  payload: unknown,
  now = Date.now(),
  options: MinerParseOptions = {},
): { candidates: MinerEventCandidate[]; windowState?: MinerWindowState; launchRequest?: MinerAgentLaunchRequest } {
  if (!isRecord(payload)) return { candidates: [] };
  if (!/stop/i.test(resolveStopEventName(payload))) return { candidates: [] };
  const metadata = resolveMetadata(payload);
  if (!metadata.sessionId) return { candidates: [] };
  const occurredAt = resolveOccurredAt(payload, now);
  const ticketId = inferTicketId(
    cleanString(payload.ticketId, 120),
    cleanString(payload.ticket_id, 120),
    metadata.projectPath,
    cleanString(payload.transcript_path, 1_000),
  );
  const cadenceTurns = Math.max(1, Math.floor(options.cadenceTurns ?? DEFAULT_CADENCE_TURNS));
  const { next: advancedWindow } = advanceWindowState(
    options.windowState,
    metadata.sessionId,
    metadata.turnId,
    occurredAt,
  );
  let window = advancedWindow;
  const candidates: MinerEventCandidate[] = [];
  if (options.includeCadenceTelemetry) {
    candidates.push(windowCandidate(metadata, ticketId, window, cadenceTurns, occurredAt));
  }
  const cadence = cadenceCandidate(metadata, ticketId, window, cadenceTurns, occurredAt);
  if (cadence.eventName === "miner.agent.queued" || options.includeCadenceTelemetry) {
    candidates.push(cadence);
  }

  const due = cadence.eventName === "miner.agent.queued";
  const launchRequest =
    due && metadata.projectPath
      ? {
          sessionId: metadata.sessionId,
          turnId: metadata.turnId,
          ticketId,
          projectPath: metadata.projectPath,
          projectId: metadata.projectId,
          transcriptPath: cleanString(payload.transcript_path, 1_000) ?? cleanString(payload.transcriptPath, 1_000),
          eventAt: occurredAt,
          programs: options.programs ?? DEFAULT_MINER_PROGRAMS,
          turnCount: window.turnCount,
          cadenceTurns,
        }
      : undefined;

  if (options.includeReviewReports !== false) {
    const flushed = flushReviewReports({
      metadata,
      ticketId,
      window,
      occurredAt,
      maxReviewReports: Math.max(1, Math.floor(options.maxReviewReports ?? 12)),
    });
    window = flushed.window;
    candidates.push(...flushed.candidates);
  }

  return { candidates, windowState: window, launchRequest };
}

export function parseCodexEventMinerFromStdin(
  stdin: string,
  now = Date.now(),
  options: MinerParseOptions = {},
): { candidates: MinerEventCandidate[]; windowState?: MinerWindowState; launchRequest?: MinerAgentLaunchRequest } {
  try {
    return parseCodexEventMinerFromPayload(JSON.parse(stdin), now, options);
  } catch {
    return { candidates: [] };
  }
}
