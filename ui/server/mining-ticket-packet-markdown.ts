/**
 * TICKET COMPLETION PACKET MARKDOWN
 * =================================
 * Ownership: local mining server.
 * Inputs/outputs: TicketCompletionPacket JSON to compact human-readable Markdown.
 * Side effects: none.
 */
import type { TicketCompletionPacket } from "./mining-ticket-packet";

export function renderTicketCompletionPacketMarkdown(packet: TicketCompletionPacket): string {
  return [
    `# Ticket Completion Packet: ${packet.ticketId ?? packet.source.id}`,
    "",
    `Run: ${packet.runId}`,
    `Session: ${packet.sessionId ?? "unknown"}`,
    `Transcript policy: ${packet.transcript.fullTranscriptPolicy}`,
    "",
    "## Files",
    ...packet.files.map((file) =>
      `- ${file.path}: ${file.exists ? `${file.lineCount ?? 0} lines` : file.missingReason}`,
    ),
    "",
    "## Metrics",
    ...packet.metrics.map((row) =>
      `- ${row.label}: ${row.status === "known" ? `${row.value} ${row.unit ?? ""}`.trim() : `unknown (${row.reason})`}`,
    ),
    "",
    "## Decisions",
    ...(packet.decisions.length
      ? packet.decisions.map((decision) => `- ${decision.summary ?? decision.eventName ?? "decision"}`)
      : ["- none found"]),
    "",
    "## Transcript Window",
    ...(packet.transcript.boundedWindow.length
      ? packet.transcript.boundedWindow.map((row) => `- ${row.role}: ${row.text}`)
      : [`- unavailable: ${packet.transcript.unavailableReason ?? "none"}`]),
    "",
    "## Warnings",
    ...(packet.warnings.length ? packet.warnings.map((warning) => `- ${warning}`) : ["- none"]),
    "",
  ].join("\n");
}
