/**
 * Facility job contract for permanent Office stations.
 *
 * Inputs: a registered specialist, project identity, and operator request.
 * Outputs: a compact canonical ticket title plus task-thread instructions.
 * Side effects: none. The Vite bridge owns ticket writes and Codex RPC.
 * Invariant: a facility guides one ticket/thread pair; it never derives routing
 * from telemetry or silently creates a second execution thread.
 */

import type { TicketSpecialistDefinition } from "./specialist-registry";

const MAX_TICKET_TITLE_LENGTH = 140;

function normalizedLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildFacilityTicketTitle(input: {
  specialist: TicketSpecialistDefinition;
  request: string;
}): string {
  const requestLine = normalizedLine(input.request.split(/\r?\n/, 1)[0] ?? "");
  if (!requestLine) throw new Error("facility_job_request_required");
  return trimToLength(`${input.specialist.displayName}: ${requestLine}`, MAX_TICKET_TITLE_LENGTH);
}

export function buildFacilityDeveloperInstructions(input: {
  specialist: TicketSpecialistDefinition;
  ticketId: string;
  projectName: string;
}): string {
  const primarySkill = input.specialist.primarySkillId
    ? `Use the ${input.specialist.primarySkillId} skill when it fits the request.`
    : "Use the closest available Farplane workflow when it fits the request.";
  return [
    `You are Farplane's ${input.specialist.displayName} for ${input.projectName}.`,
    `This thread is the only execution thread for ${input.ticketId}. Keep the durable outcome and its evidence in that ticket's project workspace.`,
    `Your job is to produce ${input.specialist.deliverableLabel}, not merely describe how it could be made.`,
    primarySkill,
    "Do not create another ticket or task thread. Use helper work only for context isolation; the ticket remains the owner of the outcome.",
  ].join("\n\n");
}

export function buildFacilityTaskMessage(input: {
  specialist: TicketSpecialistDefinition;
  ticketId: string;
  request: string;
}): string {
  const request = input.request.trim();
  if (!request) throw new Error("facility_job_request_required");
  return [
    `Start the ${input.specialist.displayName} assignment for ${input.ticketId}.`,
    "Operator request:",
    request,
  ].join("\n\n");
}
