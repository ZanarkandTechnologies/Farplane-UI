#!/usr/bin/env tsx
/**
 * Entrypoint for the Codex Stop event miner hook.
 */

import {
  launchResultCandidate,
  parseCodexEventMinerFromPayload,
  publishMinerEvents,
  readMinerWindowState,
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
  writeMinerWindowState,
} from "./handler";
import { launchMinerAgent } from "./launcher";
import { readFarplaneConfigValue } from "../../cli/runtime-config";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function numberFromConfig(name: string, fallback: number): number {
  const raw = readFarplaneConfigValue(name);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const debugEnabled = readFarplaneConfigValue("FARPLANE_EVENT_MINER_HOOK_DEBUG") === "1";
  const stdin = await readStdin();
  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    if (debugEnabled) console.error("[codex-event-miner] invalid JSON payload");
    return;
  }
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const cwd = typeof record.cwd === "string" ? record.cwd : process.cwd();
  const sessionId =
    typeof record.sessionId === "string"
      ? record.sessionId
      : typeof record.session_id === "string"
        ? record.session_id
        : undefined;
  const windowState = cwd && sessionId ? readMinerWindowState(cwd, sessionId) : undefined;
  const parsed = parseCodexEventMinerFromPayload(payload, Date.now(), {
    cadenceTurns: numberFromConfig("FARPLANE_EVENT_MINER_CADENCE_TURNS", 5),
    windowState,
  });
  if (parsed.candidates.length === 0) {
    if (debugEnabled) console.error("[codex-event-miner] no miner events detected");
    return;
  }
  try {
    if (parsed.launchRequest) {
      const launchResult = await launchMinerAgent(parsed.launchRequest, {
        dryRun: readFarplaneConfigValue("FARPLANE_EVENT_MINER_DRY_RUN") === "1",
      });
      parsed.candidates.push(launchResultCandidate(parsed.launchRequest, launchResult));
      if (launchResult.status === "launched" || launchResult.status === "dry_run") {
        parsed.windowState = {
          ...(parsed.windowState ?? windowState),
          sessionId: parsed.launchRequest.sessionId,
          turnCount: parsed.launchRequest.turnCount,
          lastReviewTurnCount: parsed.launchRequest.turnCount,
          seenTurnIds: parsed.windowState?.seenTurnIds ?? windowState?.seenTurnIds ?? [],
          emittedReportKeys: parsed.windowState?.emittedReportKeys ?? windowState?.emittedReportKeys ?? [],
          updatedAt: parsed.launchRequest.eventAt,
        };
      }
    }
    const searchDirs = [process.cwd(), cwd].filter(Boolean);
    const result = await publishMinerEvents(parsed.candidates, {
      endpointBaseUrl: resolveDefaultEndpointBaseUrl(process.env, searchDirs),
      telemetryToken: resolveDefaultTelemetryToken(process.env, searchDirs),
    });
    if (parsed.windowState && cwd) writeMinerWindowState(cwd, parsed.windowState);
    if (debugEnabled) {
      console.error(
        `[codex-event-miner] candidates=${result.attempted} published=${result.published} queued=${result.queued ?? 0} skipped=${result.skipped}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[codex-event-miner] ${message}`);
  }
}

void main();
