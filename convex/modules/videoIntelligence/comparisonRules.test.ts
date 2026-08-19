import { describe, expect, it } from "vitest";
import {
  canonicalComparisonPair,
  comparisonEdgeChanged,
  comparisonWindowStartDay,
  evaluateComparisonFacts,
  normalizePublisherKey,
} from "./comparisonRules";

const validFacts = {
  asOfDay: "2026-08-19",
  originSourceId: "source-a",
  originAuthorityKey: "youtube:creator-a",
  originRevisionLifecycle: "current" as const,
  candidateSourceId: "source-b",
  candidateAuthorityKey: "youtube:creator-b",
  originPublisher: "Creator A",
  candidatePublisher: "Creator B",
  candidateRevisionLifecycle: "current" as const,
  candidatePublishedAt: "2026-08-10T12:00:00.000Z",
};

describe("recent comparison guard", () => {
  it("accepts a current, recent, distinct source", () => {
    expect(evaluateComparisonFacts(validFacts)).toEqual({
      eligible: true,
      candidateDay: "2026-08-10",
    });
    expect(comparisonWindowStartDay("2026-08-19")).toBe("2026-08-05");
    expect(
      evaluateComparisonFacts({
        ...validFacts,
        originAuthorityKey: undefined,
        candidateAuthorityKey: undefined,
        originPublisher: "Creator A",
        candidatePublisher: "Creator B",
      }),
    ).toMatchObject({ eligible: true });
  });

  it("rejects same-source, same-creator, stale, future, and superseded candidates", () => {
    expect(evaluateComparisonFacts({ ...validFacts, candidateSourceId: "source-a" })).toMatchObject(
      { reason: "comparison_same_source" },
    );
    expect(
      evaluateComparisonFacts({
        ...validFacts,
        candidateAuthorityKey: validFacts.originAuthorityKey,
      }),
    ).toMatchObject({ reason: "comparison_same_authority" });
    expect(
      evaluateComparisonFacts({
        ...validFacts,
        originAuthorityKey: undefined,
        candidateAuthorityKey: undefined,
        originPublisher: "Acme—Labs",
        candidatePublisher: "  ACME labs  ",
      }),
    ).toMatchObject({ reason: "comparison_same_publisher" });
    expect(
      evaluateComparisonFacts({
        ...validFacts,
        originAuthorityKey: undefined,
        candidateAuthorityKey: undefined,
        candidatePublisher: undefined,
      }),
    ).toMatchObject({ reason: "comparison_creator_identity_missing" });
    expect(
      evaluateComparisonFacts({ ...validFacts, candidatePublishedAt: "2026-08-04" }),
    ).toMatchObject({ reason: "comparison_candidate_outside_window" });
    expect(
      evaluateComparisonFacts({ ...validFacts, candidatePublishedAt: "2026-08-20" }),
    ).toMatchObject({ reason: "comparison_candidate_outside_window" });
    expect(
      evaluateComparisonFacts({ ...validFacts, candidateRevisionLifecycle: "superseded" }),
    ).toMatchObject({ reason: "comparison_revision_not_current" });
  });
});

it("normalizes publisher identity conservatively", () => {
  expect(normalizePublisherKey("  Créator.TV — Official ")).toBe("creator tv official");
  expect(normalizePublisherKey(undefined)).toBe("");
});

it("canonicalizes revision pairs and updates only changed judgment", () => {
  expect(canonicalComparisonPair("revision-b", "revision-a")).toEqual({
    pairKey: "revision-a\u0000revision-b",
    swapped: true,
  });
  expect(
    comparisonEdgeChanged(
      { relationship: "same_development", rationale: "Exact launch." },
      { relationship: "same_development", rationale: "Exact launch." },
    ),
  ).toBe(false);
  expect(
    comparisonEdgeChanged(
      { relationship: "same_development", rationale: "Exact launch." },
      { relationship: "same_active_discussion", rationale: "Debate continues." },
    ),
  ).toBe(true);
});
