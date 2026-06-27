/**
 * CODEX EVENT MINER TELEMETRY
 * ===========================
 * Ownership: Codex event miner hook package.
 * Inputs/outputs: miner candidates to `/telemetry/hooks` envelopes.
 * Side effects: network publish through shared telemetry outbox and local outbox writes on failure.
 * Invariants: payloads stay compact, schema-shaped, and free of raw prompts/transcripts.
 */

import path from "node:path";
import { firstFarplaneConfigValue, readFarplaneConfigValue } from "../../cli/runtime-config";
import { publishHookTelemetryWithOutbox } from "../shared/telemetry-outbox";
import { readDotenvValue } from "./helpers";
import type { MinerEventCandidate, PublishMinerEventsOptions } from "./types";

export function buildMinerTelemetryEnvelope(candidate: MinerEventCandidate) {
  return {
    hookName: "codex-event-miner",
    hookType: "Stop",
    projectId: candidate.projectId,
    sessionId: candidate.sessionId,
    eventAt: candidate.occurredAt,
    eventKey: candidate.eventKey,
    payload: {
      schemaVersion: 1,
      eventName: candidate.eventName,
      ticketId: candidate.ticketId,
      threadId: candidate.threadId,
      turnId: candidate.turnId,
      cwd: candidate.projectPath,
      source: candidate.source,
      sourceProgram: candidate.sourceProgram,
      status: candidate.status,
      severity: candidate.severity,
      summary: candidate.summary,
      decisionKind: candidate.decisionKind,
      reviewRunPath: candidate.reviewRunPath,
      docsDelta: candidate.docsDelta,
      turnCount: candidate.turnCount,
      cadenceTurns: candidate.cadenceTurns,
      nextReviewInTurns: candidate.nextReviewInTurns,
    },
  };
}

export async function publishMinerEvents(
  candidates: MinerEventCandidate[],
  options: PublishMinerEventsOptions = {},
): Promise<{ attempted: number; published: number; skipped: boolean; queued?: number; replayed?: number }> {
  const primaryProjectPath = candidates.find((candidate) => candidate.projectPath)?.projectPath;
  return await publishHookTelemetryWithOutbox(candidates.map(buildMinerTelemetryEnvelope), {
    endpointBaseUrl: options.endpointBaseUrl,
    telemetryToken: options.telemetryToken,
    fetchImpl: options.fetchImpl,
    projectPath: primaryProjectPath,
  });
}

export function resolveDefaultEndpointBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  searchDirs: string[] = [],
): string {
  const configured = firstFarplaneConfigValue(["FARPLANE_CONVEX_SITE_URL", "CONVEX_SITE_URL"], { env });
  if (configured) return configured;
  for (const dir of searchDirs) {
    const value =
      readDotenvValue(path.join(dir, ".env.local"), "FARPLANE_CONVEX_SITE_URL") ??
      readDotenvValue(path.join(dir, ".env.local"), "CONVEX_SITE_URL");
    if (value) return value.trim();
  }
  return "";
}

export function resolveDefaultTelemetryToken(
  env: NodeJS.ProcessEnv = process.env,
  searchDirs: string[] = [],
): string {
  const configured = readFarplaneConfigValue("FARPLANE_TELEMETRY_TOKEN", { env, secret: true });
  if (configured) return configured;
  for (const dir of searchDirs) {
    const value = readDotenvValue(path.join(dir, ".env.local"), "FARPLANE_TELEMETRY_TOKEN");
    if (value) return value.trim();
  }
  return "";
}
