export type ContentSummarySource = "dossier" | "resource_bank" | "feed_scout" | null;

export function resolveContentSummary(input: {
  dossierSummary?: string;
  resourceBankAnalysis?: string;
  feedScoutSummary?: string;
}): { summary?: string; source: ContentSummarySource } {
  if (input.dossierSummary) return { summary: input.dossierSummary, source: "dossier" };
  if (input.resourceBankAnalysis)
    return { summary: input.resourceBankAnalysis, source: "resource_bank" };
  if (input.feedScoutSummary) return { summary: input.feedScoutSummary, source: "feed_scout" };
  return { source: null };
}

export function shouldDeleteContentSource(input: {
  remainingDiscoveryCount: number;
  remainingJobCount: number;
}): boolean {
  return input.remainingJobCount === 0 && input.remainingDiscoveryCount === 0;
}
