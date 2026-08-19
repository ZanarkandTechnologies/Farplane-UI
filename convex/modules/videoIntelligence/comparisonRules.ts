/**
 * Pure comparison guards own the 14-day/distinct/current contract.
 * Model judgment selects a relationship; these checks only validate stored identities and time.
 */
import { isTimelineDay } from "../content/timeline";
import { calendarDayDifference } from "./editorial";

export const RECENT_COMPARISON_WINDOW_DAYS = 14;
export const MAX_COMPARISON_CANDIDATES = 20;
export const MAX_RELATED_COVERAGE_EDGES = 8;

export type ComparisonRelationship = "same_development" | "same_active_discussion";

export type ComparisonFacts = {
  asOfDay: string;
  originSourceId: string;
  originAuthorityKey?: string;
  originPublisher?: string;
  originRevisionLifecycle: "current" | "superseded";
  candidateSourceId: string;
  candidateAuthorityKey?: string;
  candidatePublisher?: string;
  candidateRevisionLifecycle: "current" | "superseded";
  candidatePublishedAt?: string;
};

export type ComparisonGate =
  | { eligible: true; candidateDay: string }
  | {
      eligible: false;
      reason:
        | "comparison_day_invalid"
        | "comparison_same_source"
        | "comparison_same_authority"
        | "comparison_same_publisher"
        | "comparison_creator_identity_missing"
        | "comparison_revision_not_current"
        | "comparison_candidate_date_missing"
        | "comparison_candidate_outside_window";
    };

export function evaluateComparisonFacts(facts: ComparisonFacts): ComparisonGate {
  if (!isTimelineDay(facts.asOfDay)) {
    return { eligible: false, reason: "comparison_day_invalid" };
  }
  if (facts.originSourceId === facts.candidateSourceId) {
    return { eligible: false, reason: "comparison_same_source" };
  }
  if (
    facts.originAuthorityKey &&
    facts.candidateAuthorityKey &&
    facts.originAuthorityKey === facts.candidateAuthorityKey
  ) {
    return { eligible: false, reason: "comparison_same_authority" };
  }
  if (!facts.originAuthorityKey || !facts.candidateAuthorityKey) {
    const originPublisher = normalizePublisherKey(facts.originPublisher);
    const candidatePublisher = normalizePublisherKey(facts.candidatePublisher);
    if (!originPublisher || !candidatePublisher) {
      return { eligible: false, reason: "comparison_creator_identity_missing" };
    }
    if (originPublisher === candidatePublisher) {
      return { eligible: false, reason: "comparison_same_publisher" };
    }
  }
  if (
    facts.originRevisionLifecycle !== "current" ||
    facts.candidateRevisionLifecycle !== "current"
  ) {
    return { eligible: false, reason: "comparison_revision_not_current" };
  }
  const candidateDay = publicationDay(facts.candidatePublishedAt);
  if (!candidateDay) {
    return { eligible: false, reason: "comparison_candidate_date_missing" };
  }
  const age = calendarDayDifference(facts.asOfDay, candidateDay);
  if (age < 0 || age > RECENT_COMPARISON_WINDOW_DAYS) {
    return { eligible: false, reason: "comparison_candidate_outside_window" };
  }
  return { eligible: true, candidateDay };
}

export function normalizePublisherKey(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function publicationDay(value: string | undefined): string | null {
  if (!value) return null;
  const directDay = value.slice(0, 10);
  if (isTimelineDay(directDay)) return directDay;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

export function comparisonWindowStartDay(asOfDay: string): string {
  if (!isTimelineDay(asOfDay)) throw new Error("comparison_day_invalid");
  return new Date(
    Date.parse(`${asOfDay}T00:00:00.000Z`) - RECENT_COMPARISON_WINDOW_DAYS * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
}

export function canonicalComparisonPair(
  leftRevisionId: string,
  rightRevisionId: string,
): { pairKey: string; swapped: boolean } {
  const swapped = leftRevisionId.localeCompare(rightRevisionId) > 0;
  const [first, second] = swapped
    ? [rightRevisionId, leftRevisionId]
    : [leftRevisionId, rightRevisionId];
  return { pairKey: `${first}\u0000${second}`, swapped };
}

export function comparisonEdgeChanged(
  existing: { relationship: ComparisonRelationship; rationale: string },
  next: { relationship: ComparisonRelationship; rationale: string },
): boolean {
  return existing.relationship !== next.relationship || existing.rationale !== next.rationale;
}
