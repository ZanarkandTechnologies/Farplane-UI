import { describe, expect, it } from "vitest";
import {
  assertComparisonReceipt,
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

describe("comparison receipt contract", () => {
  const completeZero = {
    status: "complete" as const,
    asOfDay: "2026-08-19",
    windowStartDay: "2026-08-05",
    horizonDays: 14,
    candidateCount: 3,
    acceptedCount: 0,
    limitation: "None of the three candidates covered the same development.",
  };

  it("distinguishes complete-zero, sparse, failed, and not-run", () => {
    expect(() => assertComparisonReceipt(completeZero, 0)).not.toThrow();
    expect(() =>
      assertComparisonReceipt(
        {
          ...completeZero,
          status: "sparse",
          candidateCount: 0,
          limitation: "No eligible candidates were in the recent catalog.",
        },
        0,
      ),
    ).not.toThrow();
    expect(() =>
      assertComparisonReceipt(
        {
          status: "failed",
          asOfDay: null,
          windowStartDay: null,
          horizonDays: null,
          candidateCount: 0,
          acceptedCount: 0,
          limitation: "Candidate retrieval failed.",
        },
        0,
      ),
    ).not.toThrow();
    expect(() =>
      assertComparisonReceipt(
        {
          status: "not_run",
          asOfDay: null,
          windowStartDay: null,
          horizonDays: null,
          candidateCount: 0,
          acceptedCount: 0,
          limitation: "Legacy revision.",
        },
        0,
      ),
    ).not.toThrow();
  });

  it("rejects mismatched counts, windows, statuses, and silent zero results", () => {
    expect(() => assertComparisonReceipt({ ...completeZero, acceptedCount: 1 }, 0)).toThrow(
      "comparison_receipt_count_invalid",
    );
    expect(() =>
      assertComparisonReceipt({ ...completeZero, windowStartDay: "2026-08-06" }, 0),
    ).toThrow("comparison_receipt_window_invalid");
    expect(() => assertComparisonReceipt({ ...completeZero, status: "sparse" }, 0)).toThrow(
      "comparison_receipt_status_invalid",
    );
    expect(() => assertComparisonReceipt({ ...completeZero, limitation: null }, 0)).toThrow(
      "comparison_receipt_limitation_missing",
    );
  });
});
