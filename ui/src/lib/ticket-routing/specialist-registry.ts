/**
 * Ticket specialist routing is the shared UI contract between Kanban and Office3D.
 * A specialist is an artifact-producing work identity, not a persistent employee;
 * its fixed studio destination is derived here and never inferred from a skill
 * invocation. Phase work (QA, planning, review) and integrations belong to
 * their existing operating rooms or channel desks instead.
 */

import type { DepartmentIslandId } from "@/modules/office/lib/department-island-layout";
import type { OperatingRoomId } from "@/modules/office/lib/operating-room-catalog";

export type TicketSpecialistDefinition = {
  id: string;
  displayName: string;
  /** The customer-facing result this facility is designed to produce. */
  deliverableLabel: string;
  /**
   * The preferred Farplane skill for a task started from this facility. It is
   * guidance for the task thread, never a telemetry-derived routing signal.
   */
  primarySkillId?: string;
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
    deliverableLabel: "a landing page",
    primarySkillId: "landing-page",
    departmentId: "marketing",
    roomId: "production",
  },
  {
    id: "content-specialist",
    displayName: "Content Specialist",
    deliverableLabel: "ready-to-publish content",
    primarySkillId: "social-content",
    departmentId: "marketing",
    roomId: "production",
  },
  {
    id: "video-specialist",
    displayName: "Video Specialist",
    deliverableLabel: "a production-ready video",
    primarySkillId: "video-production",
    departmentId: "marketing",
    roomId: "production",
  },
  {
    id: "research-specialist",
    displayName: "Research Specialist",
    deliverableLabel: "decision-ready research",
    primarySkillId: "research",
    departmentId: "intelligence",
    roomId: "research",
  },
  {
    id: "skill-specialist",
    displayName: "Skill Specialist",
    deliverableLabel: "a reusable skill",
    primarySkillId: "skill-creator",
    departmentId: "operations",
    roomId: "skills",
  },
  {
    id: "customer-research-specialist",
    displayName: "Customer Research",
    deliverableLabel: "a customer research brief",
    primarySkillId: "customer-research",
    departmentId: "intelligence",
    roomId: "research",
  },
  {
    id: "lead-scout-specialist",
    displayName: "Lead Scout",
    deliverableLabel: "a ranked prospect list",
    primarySkillId: "lead-scout",
    departmentId: "sales",
  },
  {
    id: "first-value-outreach-specialist",
    displayName: "First-Value Outreach",
    deliverableLabel: "personalized first-value outreach",
    primarySkillId: "first-value-outreach",
    departmentId: "sales",
  },
  {
    id: "outreach-campaign-specialist",
    displayName: "Outreach Campaigns",
    deliverableLabel: "an approval-ready outreach campaign",
    primarySkillId: "outreach-impl-plan",
    departmentId: "sales",
  },
  {
    id: "solution-specialist",
    displayName: "Solution Shaping",
    deliverableLabel: "a solution brief",
    primarySkillId: "solution-shaping",
    departmentId: "deals",
  },
  {
    id: "personalized-offer-specialist",
    displayName: "Personalized Offers",
    deliverableLabel: "a personalized offer",
    primarySkillId: "personalized-offer",
    departmentId: "deals",
  },
  {
    id: "proposal-specialist",
    displayName: "Proposal Pricing",
    deliverableLabel: "a priced proposal",
    primarySkillId: "proposal-pricing",
    departmentId: "deals",
  },
] as const satisfies readonly TicketSpecialistDefinition[];

const SPECIALIST_BY_ID = new Map<string, TicketSpecialistDefinition>(
  TICKET_SPECIALIST_REGISTRY.map((specialist) => [specialist.id, specialist]),
);

export function resolveTicketSpecialist(
  value: string | null | undefined,
): TicketSpecialistDefinition | undefined {
  return SPECIALIST_BY_ID.get(value?.trim() ?? "");
}
