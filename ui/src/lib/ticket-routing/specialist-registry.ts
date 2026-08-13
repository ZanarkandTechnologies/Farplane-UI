/**
 * Ticket specialist routing is the shared UI contract between Kanban and Office3D.
 * A specialist is an artifact-oriented work identity, not a persistent employee;
 * its fixed destination is derived here and never inferred from a skill invocation.
 */

import type { DepartmentIslandId } from "@/modules/office/lib/department-island-layout";
import type { OperatingRoomId } from "@/modules/office/lib/operating-room-catalog";

export type TicketSpecialistDefinition = {
  id: string;
  displayName: string;
  /** Every specialist belongs to exactly one physical capability department. */
  departmentId: DepartmentIslandId;
  /**
   * Present when a specialist is hosted by a full operating room. Sales and
   * Deals service bays intentionally omit this: they are ticket-first stations
   * in their department island, not duplicate application rooms.
   */
  roomId?: OperatingRoomId;
};

export const TICKET_SPECIALIST_REGISTRY = [
  {
    id: "landing-page-specialist",
    displayName: "Landing Page Specialist",
    departmentId: "marketing",
    roomId: "production",
  },
  {
    id: "content-specialist",
    displayName: "Content Specialist",
    departmentId: "marketing",
    roomId: "production",
  },
  {
    id: "video-specialist",
    displayName: "Video Specialist",
    departmentId: "marketing",
    roomId: "production",
  },
  {
    id: "research-specialist",
    displayName: "Research Specialist",
    departmentId: "intelligence",
    roomId: "research",
  },
  { id: "qa-specialist", displayName: "QA Specialist", departmentId: "operations", roomId: "qa" },
  {
    id: "hiring-specialist",
    displayName: "Hiring Specialist",
    departmentId: "back-office",
    roomId: "organization",
  },
  {
    id: "finance-specialist",
    displayName: "Finance Specialist",
    departmentId: "back-office",
    roomId: "finance",
  },
  {
    id: "harness-specialist",
    displayName: "Harness Specialist",
    departmentId: "operations",
    roomId: "harness",
  },
  {
    id: "skill-specialist",
    displayName: "Skill Specialist",
    departmentId: "operations",
    roomId: "skills",
  },
  {
    id: "comms-specialist",
    displayName: "Communications Specialist",
    departmentId: "customer",
    roomId: "comms",
  },
  {
    id: "customer-research-specialist",
    displayName: "Customer Research",
    departmentId: "customer",
  },
  {
    id: "telemetry-specialist",
    displayName: "Telemetry Specialist",
    departmentId: "operations",
    roomId: "telemetry",
  },
  {
    id: "thread-intelligence-specialist",
    displayName: "Thread Intelligence Specialist",
    departmentId: "intelligence",
    roomId: "thread-data",
  },
  {
    id: "improvement-specialist",
    displayName: "Improvement Specialist",
    departmentId: "operations",
    roomId: "self-improvement",
  },
  { id: "lead-scout-specialist", displayName: "Lead Scout", departmentId: "sales" },
  {
    id: "first-value-outreach-specialist",
    displayName: "First-Value Outreach",
    departmentId: "sales",
  },
  {
    id: "outreach-campaign-specialist",
    displayName: "Outreach Campaigns",
    departmentId: "sales",
  },
  {
    id: "solution-specialist",
    displayName: "Solution Shaping",
    departmentId: "deals",
  },
  {
    id: "personalized-offer-specialist",
    displayName: "Personalized Offers",
    departmentId: "deals",
  },
  { id: "proposal-specialist", displayName: "Proposal Pricing", departmentId: "deals" },
] as const satisfies readonly TicketSpecialistDefinition[];

const SPECIALIST_BY_ID = new Map<string, TicketSpecialistDefinition>(
  TICKET_SPECIALIST_REGISTRY.map((specialist) => [specialist.id, specialist]),
);

export function resolveTicketSpecialist(
  value: string | null | undefined,
): TicketSpecialistDefinition | undefined {
  return SPECIALIST_BY_ID.get(value?.trim() ?? "");
}
