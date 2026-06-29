import { messageWindowPathForSource, type JsonObject, type MiningThreadSource } from "./mining-sources";
import { pathExists, readJsonFile } from "./mining-files";
import type { MiningProgram, MiningRunIndexEntry } from "./mining-types";

type EvidenceSpan = {
  id: string;
  sourcePath: string;
  jsonPointer: string;
  role: "user" | "assistant" | "summary" | "unknown";
  capturedAt?: string;
  text: string;
};

function clip(value: string | undefined, max = 320): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

function inferTicketId(spans: EvidenceSpan[]): string | undefined {
  for (const span of spans) {
    const match = span.text.match(/\bTASK-\d{4}\b/i);
    if (match) return match[0].toUpperCase();
  }
  return undefined;
}

function inferDecisionKind(text: string): string {
  const normalized = text.toLowerCase();
  if (/\b(ui|tab|panel|dashboard|frontend|screen|view)\b/.test(normalized)) return "product";
  if (/\b(hook|telemetry|projection|schema|service|api|storage|convex)\b/.test(normalized)) {
    return "architecture";
  }
  if (/\b(ticket|workflow|process|review|qa|goal|backfill)\b/.test(normalized)) return "workflow";
  return "implementation";
}

function decisionCandidate(spans: EvidenceSpan[]): string | undefined {
  return spans
    .filter((span) => span.role === "user")
    .map((span) => span.text)
    .find((text) => {
      if (/^# Telegram Message\b/i.test(text)) return false;
      if (/^Automation:/i.test(text)) return false;
      if (/^<codex_delegation>/i.test(text)) return false;
      if (/\b(what is your name|answer normally|response routing|try again)\b/i.test(text)) return false;
      return (
        /\b(should|use|build|remove|split|keep|make|create|implement|deprecate|promote|publish|store|project|projection)\b/i.test(
          text,
        ) ||
        /\blet'?s\s+(use|build|remove|split|keep|make|create|implement|deprecate|promote|publish|store|project)\b/i.test(
          text,
        )
      );
    });
}

function buildTelemetry(input: {
  outputId: string;
  program: MiningProgram;
  runId: string;
  source: MiningThreadSource;
  spans: EvidenceSpan[];
  summary: string;
}): JsonObject[] {
  if (input.program.id === "decision-v1" && !decisionCandidate(input.spans)) return [];
  const eventAt = new Date(
    Number(input.source.updatedAt ?? 0) > 0 ? Number(input.source.updatedAt) * 1000 : Date.now(),
  ).toISOString();
  const summary = clip(decisionCandidate(input.spans), 180) || input.summary;
  return [
    {
      schemaVersion: 1,
      eventName: "decision.observed",
      eventAt,
      eventKey: `chat-history-mining:v1:decision.observed:${input.runId}:${input.outputId}`,
      source: "chat_history_mining",
      sourceProgram: input.program.id,
      status: "observed",
      severity: "medium",
      ticketId: inferTicketId(input.spans),
      sessionId: input.source.sessionId ?? input.source.id,
      threadId: input.source.id,
      cwd: input.source.cwd,
      decisionKind: inferDecisionKind(`${input.program.objective} ${input.source.name} ${input.source.preview}`),
      summary,
      reviewRunPath: `.farplane/mine/runs/${input.runId}/outputs/${input.outputId}/output.json`,
      evidenceSpanIds: input.spans.map((span) => span.id),
    },
  ];
}

function buildDecisionRows(input: {
  program: MiningProgram;
  source: MiningThreadSource;
  spans: EvidenceSpan[];
}): JsonObject[] {
  const decisionText = decisionCandidate(input.spans);
  if (!decisionText) return [];
  const assistantText = input.spans
    .filter((span) => span.role === "assistant")
    .map((span) => span.text)
    .join("\n");
  const options = assistantText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^([-*]|\d+[.)])\s+/.test(line))
    .map((line) => clip(line.replace(/^([-*]|\d+[.)])\s+/, ""), 220))
    .filter(Boolean)
    .slice(0, 5);
  return [
    {
      title: clip(decisionText, 96) || "Decision",
      problem: clip(input.spans.find((span) => span.role === "user")?.text || input.source.preview, 260),
      options,
      recommendation: clip(assistantText.match(/recommendation\s*:\s*([^\n]+)/i)?.[1] ?? decisionText),
      ticketId: inferTicketId(input.spans),
      sessionId: input.source.sessionId ?? input.source.id,
      decisionKind: inferDecisionKind(`${input.program.objective} ${input.source.name} ${input.source.preview}`),
      confidence: input.spans.some((span) => span.role === "user") ? "medium" : "low",
    },
  ];
}

function clippedEvidenceText(value: unknown, max = 520): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

function pushEvidenceSpan(
  spans: EvidenceSpan[],
  input: {
    capturedAt?: unknown;
    jsonPointer: string;
    role: EvidenceSpan["role"];
    sourcePath: string;
    text: unknown;
  },
): void {
  const text = clippedEvidenceText(input.text);
  if (!text) return;
  spans.push({
    id: `span-${spans.length + 1}`,
    sourcePath: input.sourcePath,
    jsonPointer: input.jsonPointer,
    role: input.role,
    capturedAt: typeof input.capturedAt === "string" ? input.capturedAt : undefined,
    text,
  });
}

async function readEvidenceSpans(source: MiningThreadSource): Promise<EvidenceSpan[]> {
  const sourcePath = messageWindowPathForSource(source);
  if (!sourcePath || !(await pathExists(sourcePath))) {
    return [
      {
        id: "span-1",
        sourcePath: source.cwd ?? "codex-thread-list",
        jsonPointer: "/preview",
        role: "summary",
        text: source.preview,
      },
    ];
  }
  const summary = await readJsonFile<JsonObject>(sourcePath, {});
  const spans: EvidenceSpan[] = [];
  const pending =
    summary.pending_user_turn && typeof summary.pending_user_turn === "object"
      ? (summary.pending_user_turn as JsonObject)
      : {};
  pushEvidenceSpan(spans, {
    capturedAt: pending.user_captured_at,
    jsonPointer: "/pending_user_turn/user_text",
    role: "user",
    sourcePath,
    text: pending.user_text,
  });
  const exchanges = Array.isArray(summary.rolling_exchanges) ? summary.rolling_exchanges : [];
  exchanges.slice(-4).forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as JsonObject;
    const exchangeIndex = Math.max(0, exchanges.length - 4) + index;
    pushEvidenceSpan(spans, {
      capturedAt: row.user_captured_at,
      jsonPointer: `/rolling_exchanges/${exchangeIndex}/user_text`,
      role: "user",
      sourcePath,
      text: row.user_text,
    });
    pushEvidenceSpan(spans, {
      capturedAt: row.assistant_captured_at,
      jsonPointer: `/rolling_exchanges/${exchangeIndex}/assistant_text`,
      role: "assistant",
      sourcePath,
      text: row.assistant_text,
    });
  });
  if (!spans.length) {
    pushEvidenceSpan(spans, {
      jsonPointer: "/preview",
      role: "summary",
      sourcePath,
      text: source.preview,
    });
  }
  return spans.slice(0, 6);
}

function redactionFlagsForText(text: string): string[] {
  const flags: string[] = [];
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) flags.push("email");
  if (/\/Users\/[A-Za-z0-9._-]+/.test(text)) flags.push("local-user-path");
  if (/(api[_-]?key|secret|token|password)\s*[:=]/i.test(text)) flags.push("secret-like-token");
  return flags;
}

function buildRedactionReport(input: {
  spans: EvidenceSpan[];
  source: MiningThreadSource;
}): { flags: string[]; markdown: string; status: "clean" | "needs_review" } {
  const flags = Array.from(new Set(input.spans.flatMap((span) => redactionFlagsForText(span.text))));
  const status = flags.length ? "needs_review" : "clean";
  return {
    flags,
    status,
    markdown: [
      `# Redaction Report: ${input.source.name}`,
      "",
      `Status: ${status}`,
      `Flags: ${flags.length ? flags.join(", ") : "none"}`,
      `Source thread: ${input.source.id}`,
      "",
      "## Scanned Source Spans",
      ...input.spans.map((span) => `- ${span.id}: ${span.sourcePath}${span.jsonPointer} (${span.role})`),
      "",
    ].join("\n"),
  };
}

export async function buildDryRunOutput(input: {
  outputId: string;
  program: MiningProgram;
  runId: string;
  source: MiningThreadSource;
}): Promise<{
  json: JsonObject;
  markdown: string;
  redaction: { flags: string[]; markdown: string; status: "clean" | "needs_review" };
}> {
  const spans = await readEvidenceSpans(input.source);
  const redaction = buildRedactionReport({ source: input.source, spans });
  const userSignals = spans.filter((span) => span.role === "user").slice(0, 3);
  const reconstructionSpans = spans.filter((span) => span.role === "assistant").slice(0, 2);
  const summary = `${input.program.name} dry-run mined ${input.source.name} from ${spans.length} cited source span${spans.length === 1 ? "" : "s"}.`;
  const telemetryEvents = buildTelemetry({ ...input, spans, summary });
  const decisions = input.program.id === "decision-v1" ? buildDecisionRows({ ...input, spans }) : [];
  const json: JsonObject = {
    runId: input.runId,
    programId: input.program.id,
    programVersion: input.program.version,
    mode: "dry-run",
    sessionId: input.source.sessionId ?? input.source.id,
    threadId: input.source.id,
    ticketId: inferTicketId(spans),
    sourceTitle: input.source.name,
    status: "complete",
    verdict: "unreviewed",
    redactionStatus: redaction.status,
    summary,
    decisions,
    findings: [
      {
        type: "dry-run-mined-signal",
        signalType: "user_signal",
        title: userSignals[0]?.text.slice(0, 96) || input.program.objective,
        body: userSignals.map((span) => span.text).join("\n\n") || input.source.preview,
        evidenceSpanIds: userSignals.map((span) => span.id),
        confidence: userSignals.length ? "medium" : "low",
      },
      {
        type: "dry-run-ai-reconstruction",
        signalType: "ai_reconstruction",
        title: "Assistant-side reconstruction",
        body:
          reconstructionSpans.map((span) => span.text).join("\n\n") ||
          "No assistant reconstruction span available.",
        evidenceSpanIds: reconstructionSpans.map((span) => span.id),
        confidence: reconstructionSpans.length ? "medium" : "low",
      },
    ],
    evidenceSpans: spans,
    telemetryEvents,
  };
  const markdown = [
    `# ${input.source.name}`,
    "",
    `Program: ${input.program.id} v${input.program.version}`,
    `Run: ${input.runId}`,
    `Session: ${input.source.sessionId ?? input.source.id}`,
    `Thread: ${input.source.id}`,
    "Mode: dry-run",
    "Verdict: unreviewed",
    `Redaction: ${redaction.status}`,
    "",
    "## Summary",
    summary,
    "",
    "## User Signal",
    userSignals.map((span) => `- ${span.id}: ${span.text}`).join("\n") || `- ${input.source.preview}`,
    "",
    "## AI Reconstruction",
    reconstructionSpans.map((span) => `- ${span.id}: ${span.text}`).join("\n") ||
      "- No assistant reconstruction span available.",
    "",
    "## Evidence Spans",
    ...spans.map(
      (span) =>
        `- ${span.id}: ${span.sourcePath}${span.jsonPointer} (${span.role}${span.capturedAt ? `, ${span.capturedAt}` : ""})`,
    ),
    "",
    "## Telemetry Projection",
    ...telemetryEvents.map(
      (event) =>
        `- ${String(event.eventName)}: ${String(event.summary)} (${String(event.source)}, ${String(event.sourceProgram)})`,
    ),
    "",
    "## Redaction",
    `See redaction.md. Flags: ${redaction.flags.length ? redaction.flags.join(", ") : "none"}.`,
    "",
  ].join("\n");
  return { markdown, json, redaction };
}

export function buildParentPrompt(input: {
  program: MiningProgram;
  runId: string;
  runRoot: string;
  sources: MiningThreadSource[];
  mode: "dry-run" | "worker";
}): string {
  const sourceLines = input.sources
    .map((source, index) => `${index + 1}. ${source.id} (${source.sessionId ?? "no-session"}) - ${source.name}`)
    .join("\n");
  return [
    `# Mining Run ${input.runId}`,
    "",
    `Program: ${input.program.id} v${input.program.version}`,
    `Objective: ${input.program.objective}`,
    `Mode: ${input.mode}`,
    `Run root: ${input.runRoot}`,
    "",
    "For each source thread, spawn or assign one worker. Each worker must read the thread transcript/session, run the program prompt, and write:",
    "- `outputs/<thread-id>/output.md`",
    "- `outputs/<thread-id>/output.json`",
    "",
    "Each output must include source session id, thread id, program id/version, run id, redaction status, extracted findings, and evidence spans.",
    "",
    "## Program Prompt",
    input.program.prompt,
    "",
    "## Sources",
    sourceLines || "No sources selected.",
    "",
  ].join("\n");
}

export function buildReport(input: { entry: MiningRunIndexEntry; program: MiningProgram | null }): string {
  const entry = input.entry;
  return [
    `# ${entry.label}`,
    "",
    `Status: ${entry.status}`,
    `Mode: ${entry.mode ?? "dry-run"}`,
    `Created: ${entry.createdAt}`,
    `Completed: ${entry.completedAt ?? "n/a"}`,
    `Program: ${entry.programId} v${entry.programVersion}`,
    "",
    "## Counts",
    `- Sources: ${entry.sourceCount}`,
    `- Outputs: ${entry.outputCount}`,
    `- Reviewed: ${entry.reviewedCount}`,
    `- Promoted: ${entry.promotedCount}`,
    `- Rejected: ${entry.rejectedCount}`,
    `- Rejected sources: ${entry.rejectedSourceCount ?? 0}`,
    `- Privacy issues: ${entry.privacyIssueCount ?? 0}`,
    `- Duplicates: ${entry.duplicateCount ?? 0}`,
    "",
    "## Provenance",
    "Each output.json includes evidenceSpans with sourcePath and jsonPointer fields. User signals and AI reconstructions are separated in findings.",
    "",
    "## Review Gate",
    "Outputs start as unreviewed. Promotion requires an explicit reviewer verdict from the UI.",
    "",
    input.program ? `## Program Objective\n${input.program.objective}\n` : "",
  ].join("\n");
}
