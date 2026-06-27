/**
 * CODEX EVENT MINER REPORT FLUSHER
 * ================================
 * Ownership: `learning-docs-v1` report projection.
 * Inputs/outputs: completed miner-agent reports to compact telemetry fallback candidates.
 * Side effects: read-only scan of `.farplane/event-miner/runs`.
 * Invariants: emits agent-provided compact event summaries, not full docs or transcripts.
 */

import fs from "node:fs";
import path from "node:path";
import {
  cleanString,
  eventBase,
  isRecord,
  number,
  parseJsonFile,
  relativeReportRunPath,
  stableHash,
  withEventKey,
} from "./helpers";
import {
  MAX_EMITTED_REPORT_KEYS,
  type JsonRecord,
  type MinerEventCandidate,
  type MinerEventName,
  type MinerMetadata,
  type MinerWindowState,
} from "./types";

function eventName(value: unknown): MinerEventName | undefined {
  const name = cleanString(value, 120);
  if (
    name === "decision.observed" ||
    name === "learning.lesson.observed" ||
    name === "learning.trouble.observed" ||
    name === "miner.agent.completed" ||
    name === "miner.agent.failed"
  ) {
    return name;
  }
  return undefined;
}

function reportSummary(report: JsonRecord): string {
  return (
    cleanString(report.summary, 360) ??
    cleanString(report.result, 360) ??
    cleanString(report.status, 120) ??
    "Learning review completed."
  );
}

function docsDelta(event: JsonRecord): MinerEventCandidate["docsDelta"] {
  const row = isRecord(event.docsDelta) ? event.docsDelta : {};
  const target = cleanString(row.target, 180);
  const rowsAdded = number(row.rowsAdded);
  return target || rowsAdded ? { target, rowsAdded } : undefined;
}

function reportEventCandidates(input: {
  projectPath: string;
  reportPath: string;
  report: JsonRecord;
  metadata: MinerMetadata;
  ticketId?: string;
  occurredAt: number;
}): MinerEventCandidate[] {
  const relativeRunPath = relativeReportRunPath(input.projectPath, input.reportPath);
  const status = cleanString(input.report.status, 120) ?? "completed";
  const rows: MinerEventCandidate[] = [
    withEventKey({
      ...eventBase({
        eventName: /fail|error|blocked/i.test(status) ? "miner.agent.failed" : "miner.agent.completed",
        metadata: input.metadata,
        ticketId: input.ticketId,
        sourceProgram: "codex-event-miner",
        source: "miner_agent_report",
        status,
        severity: /fail|error|blocked/i.test(status) ? "high" : "low",
        summary: reportSummary(input.report),
        occurredAt: input.occurredAt,
        reviewRunPath: relativeRunPath,
      }),
    }),
  ];

  const events = Array.isArray(input.report.events) ? input.report.events.filter(isRecord) : [];
  for (const event of events) {
    const name = eventName(event.eventName);
    if (!name) continue;
    const summary =
      cleanString(event.summary, 360) ??
      cleanString(event.decision, 360) ??
      cleanString(event.reason, 360) ??
      cleanString(event.title, 360);
    if (!summary) continue;
    rows.push(
      withEventKey({
        ...eventBase({
          eventName: name,
          metadata: input.metadata,
          ticketId: cleanString(event.ticketId, 120) ?? cleanString(event.ticket_id, 120) ?? input.ticketId,
          sourceProgram: cleanString(event.sourceProgram, 120) ?? "miner-agent",
          source: "miner_agent_report",
          status: cleanString(event.status, 80) ?? "observed",
          severity: cleanString(event.severity, 80) as MinerEventCandidate["severity"],
          summary,
          occurredAt: input.occurredAt,
          reviewRunPath: relativeRunPath,
        }),
        decisionKind: cleanString(event.decisionKind, 80) as MinerEventCandidate["decisionKind"],
        docsDelta: docsDelta(event),
      }),
    );
  }

  return rows;
}

function reviewReportPaths(projectPath: string, maxReports: number): string[] {
  const root = path.join(projectPath, ".farplane", "event-miner", "runs");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "report.json"))
    .filter((filePath) => fs.existsSync(filePath))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .slice(0, maxReports);
}

function reportSessionId(reportPath: string, report: JsonRecord): string | undefined {
  const direct = cleanString(report.sessionId, 200) ?? cleanString(report.session_id, 200);
  if (direct) return direct;
  const input = parseJsonFile(path.join(path.dirname(reportPath), "input.json"));
  return input ? cleanString(input.sessionId, 200) ?? cleanString(input.session_id, 200) : undefined;
}

export function flushReviewReports(input: {
  metadata: MinerMetadata;
  ticketId?: string;
  window: MinerWindowState;
  occurredAt: number;
  maxReviewReports: number;
}): { candidates: MinerEventCandidate[]; window: MinerWindowState } {
  const projectPath = input.metadata.projectPath;
  if (!projectPath) return { candidates: [], window: input.window };
  const emitted = new Set(input.window.emittedReportKeys ?? []);
  const candidates: MinerEventCandidate[] = [];
  for (const reportPath of reviewReportPaths(projectPath, input.maxReviewReports)) {
    const reportKey = stableHash({ reportPath, mtime: fs.statSync(reportPath).mtimeMs });
    if (emitted.has(reportKey)) continue;
    const report = parseJsonFile(reportPath);
    if (!report) continue;
    const sessionId = reportSessionId(reportPath, report);
    if (sessionId && sessionId !== input.metadata.sessionId) continue;
    candidates.push(
      ...reportEventCandidates({
        projectPath,
        reportPath,
        report,
        metadata: input.metadata,
        ticketId: input.ticketId,
        occurredAt: input.occurredAt,
      }),
    );
    emitted.add(reportKey);
  }
  return {
    candidates,
    window: {
      ...input.window,
      emittedReportKeys: [...emitted].slice(-MAX_EMITTED_REPORT_KEYS),
    },
  };
}
