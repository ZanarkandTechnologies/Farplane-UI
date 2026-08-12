import { describe, expect, it } from "vitest";

import { resolveContentSummary, shouldDeleteContentSource } from "./intelligenceProjectionModel";

describe("Content Intelligence projection model", () => {
  it("uses a cited dossier before an explicit Resource Bank analysis or Feed Scout summary", () => {
    expect(
      resolveContentSummary({
        dossierSummary: "Cited dossier",
        resourceBankAnalysis: "Pinned analysis",
        feedScoutSummary: "Discovery observation",
      }),
    ).toEqual({ summary: "Cited dossier", source: "dossier" });
    expect(
      resolveContentSummary({
        resourceBankAnalysis: "Pinned analysis",
        feedScoutSummary: "Discovery observation",
      }),
    ).toEqual({ summary: "Pinned analysis", source: "resource_bank" });
    expect(resolveContentSummary({ feedScoutSummary: "Discovery observation" })).toEqual({
      summary: "Discovery observation",
      source: "feed_scout",
    });
  });

  it("keeps a source when a Feed Scout intake job or discovery receipt remains", () => {
    expect(shouldDeleteContentSource({ remainingJobCount: 1, remainingDiscoveryCount: 0 })).toBe(
      false,
    );
    expect(shouldDeleteContentSource({ remainingJobCount: 0, remainingDiscoveryCount: 1 })).toBe(
      false,
    );
    expect(shouldDeleteContentSource({ remainingJobCount: 0, remainingDiscoveryCount: 0 })).toBe(
      true,
    );
  });
});
