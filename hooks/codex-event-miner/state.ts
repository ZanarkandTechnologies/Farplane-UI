/**
 * CODEX EVENT MINER WINDOW STATE
 * ==============================
 * Ownership: Codex event miner hook package.
 * Inputs/outputs: per-session turn ids and emitted report keys persisted under `.farplane/event-miner`.
 * Side effects: local state file reads/writes.
 * Invariants: state is dedupe/cadence metadata only, never message content.
 */

import fs from "node:fs";
import path from "node:path";
import { cleanString, number, parseJsonFile, safeIdPart } from "./helpers";
import { MAX_EMITTED_REPORT_KEYS, MAX_SEEN_TURN_IDS, type MinerWindowState } from "./types";

function defaultWindowState(sessionId: string, now: number): MinerWindowState {
  return {
    sessionId,
    turnCount: 0,
    lastReviewTurnCount: 0,
    seenTurnIds: [],
    emittedReportKeys: [],
    updatedAt: now,
  };
}

export function advanceWindowState(
  current: MinerWindowState | undefined,
  sessionId: string,
  turnId: string | undefined,
  now: number,
): { next: MinerWindowState; countedTurn: boolean } {
  const next = { ...(current ?? defaultWindowState(sessionId, now)) };
  next.sessionId = sessionId;
  next.seenTurnIds = [...new Set(next.seenTurnIds ?? [])].slice(-MAX_SEEN_TURN_IDS);
  next.emittedReportKeys = [...new Set(next.emittedReportKeys ?? [])].slice(-MAX_EMITTED_REPORT_KEYS);
  const key = turnId ?? `turn-at-${now}`;
  const countedTurn = !next.seenTurnIds.includes(key);
  if (countedTurn) {
    next.turnCount = Math.max(0, Math.floor(next.turnCount ?? 0)) + 1;
    next.seenTurnIds = [...next.seenTurnIds, key].slice(-MAX_SEEN_TURN_IDS);
  }
  next.updatedAt = now;
  return { next, countedTurn };
}

export function minerWindowStatePath(projectPath: string, sessionId: string): string {
  return path.join(projectPath, ".farplane", "event-miner", "windows", `${safeIdPart(sessionId)}.json`);
}

export function readMinerWindowState(projectPath: string, sessionId: string): MinerWindowState | undefined {
  const parsed = parseJsonFile(minerWindowStatePath(projectPath, sessionId));
  if (!parsed) return undefined;
  return {
    sessionId: cleanString(parsed.sessionId, 200) ?? sessionId,
    turnCount: Math.max(0, Math.floor(number(parsed.turnCount) ?? 0)),
    lastReviewTurnCount: Math.max(0, Math.floor(number(parsed.lastReviewTurnCount) ?? 0)),
    seenTurnIds: Array.isArray(parsed.seenTurnIds)
      ? parsed.seenTurnIds.filter((entry): entry is string => typeof entry === "string").slice(-MAX_SEEN_TURN_IDS)
      : [],
    emittedReportKeys: Array.isArray(parsed.emittedReportKeys)
      ? parsed.emittedReportKeys
          .filter((entry): entry is string => typeof entry === "string")
          .slice(-MAX_EMITTED_REPORT_KEYS)
      : [],
    updatedAt: Math.max(0, Math.floor(number(parsed.updatedAt) ?? 0)),
  };
}

export function writeMinerWindowState(projectPath: string, state: MinerWindowState): void {
  const filePath = minerWindowStatePath(projectPath, state.sessionId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
