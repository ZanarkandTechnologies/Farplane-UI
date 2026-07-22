/** Owns the extension's narrow local-service calls and validated analysis cache. */

const LOCAL_AGENT = "http://127.0.0.1:47893";
type Analysis = {
  schemaVersion: 1;
  sourceStatus: "TRANSCRIPT_USED" | "TRANSCRIPT_UNAVAILABLE" | "SUMMARY_ONLY";
  sourceNote: string;
  clickbait: {
    answer: string;
    verdict: "DELIVERED" | "PARTIAL" | "BAIT" | "UNVERIFIABLE";
    confidence: number;
    evidence: string[];
  };
  keyPoints: { finding: string; detail: string | null; timestamp: string | null }[];
  recommendation: {
    decision: "WATCH" | "READ" | "SKIP";
    personalRelevance: number | null;
    contentQuality: number;
    reasonCode: string;
    rationale: string;
    matchedProfile: string[];
  };
};

export type AnalysisJob = {
  id: string;
  videoId: string;
  title: string;
  status: "queued" | "running" | "succeeded" | "failed";
  threadId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function parseAnalysis(value: unknown): Analysis {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error("Invalid analysis");
  const clickbait = value.clickbait;
  const recommendation = value.recommendation;
  if (
    !oneOf(value.sourceStatus, [
      "TRANSCRIPT_USED",
      "TRANSCRIPT_UNAVAILABLE",
      "SUMMARY_ONLY",
    ]) ||
    typeof value.sourceNote !== "string" ||
    !isRecord(clickbait) ||
    typeof clickbait.answer !== "string" ||
    !oneOf(clickbait.verdict, ["DELIVERED", "PARTIAL", "BAIT", "UNVERIFIABLE"]) ||
    typeof clickbait.confidence !== "number" ||
    !strings(clickbait.evidence) ||
    !Array.isArray(value.keyPoints) ||
    !value.keyPoints.every(
      (point) =>
        isRecord(point) &&
        typeof point.finding === "string" &&
        (point.detail === null || typeof point.detail === "string") &&
        (point.timestamp === null || typeof point.timestamp === "string"),
    ) ||
    !isRecord(recommendation) ||
    !oneOf(recommendation.decision, ["WATCH", "READ", "SKIP"]) ||
    (recommendation.personalRelevance !== null &&
      typeof recommendation.personalRelevance !== "number") ||
    typeof recommendation.contentQuality !== "number" ||
    !oneOf(recommendation.reasonCode, [
      "VISUALS_REQUIRED",
      "SUMMARY_SUFFICIENT",
      "LOW_SIGNAL",
      "ALREADY_KNOWN",
      "NOT_RELEVANT",
      "PROFILE_UNAVAILABLE",
    ]) ||
    typeof recommendation.rationale !== "string" ||
    !strings(recommendation.matchedProfile)
  ) {
    throw new Error("Invalid analysis");
  }
  return value as Analysis;
}

function parseCacheEntry(value: unknown) {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.threadId !== "string" ||
    !value.threadId
  ) {
    return null;
  }
  try {
    const analysis = parseAnalysis(value.analysis);
    if (analysis.sourceStatus === "TRANSCRIPT_UNAVAILABLE") return null;
    return { analysis, threadId: value.threadId };
  } catch {
    return null;
  }
}

async function fetchJson(path: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${LOCAL_AGENT}${path}`, {
      ...init,
      headers: { ...init.headers, "x-farplane-client": "youtube-shortcut" },
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      const error = new Error(
        payload.error || `Local service returned ${response.status}`,
      ) as Error & { threadId?: string };
      if (typeof payload.threadId === "string")
        error.threadId = payload.threadId;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyze(videoId: string, title: string) {
  const cacheKey = `farplane-youtube-analysis-v1:${videoId}`;
  const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
  const parsed = parseCacheEntry(cached);
  if (parsed)
    return {
      ok: true,
      analysis: parsed.analysis,
      threadId: parsed.threadId,
      cached: true,
    };

  const payload = await fetchJson(
    "/analyze-youtube",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoId, title }),
    },
    185_000,
  );
  const analysis = parseAnalysis(payload.analysis);
  if (typeof payload.threadId !== "string" || !payload.threadId) {
    throw new Error("Invalid analysis thread");
  }
  const threadId = payload.threadId;
  await chrome.storage.local.set({
    [cacheKey]: { schemaVersion: 2, analysis, threadId },
  });
  return { ok: true, analysis, threadId, cached: false };
}

export async function getJobs(): Promise<{ ok: true; jobs: AnalysisJob[] }> {
  const payload = await fetchJson("/jobs", { method: "POST" }, 6_000);
  if (!Array.isArray(payload.jobs)) throw new Error("Invalid analysis jobs");
  return { ok: true, jobs: payload.jobs as AnalysisJob[] };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const run =
    request?.type === "ANALYZE_YOUTUBE"
      ? () => analyze(request.videoId, request.title)
      : request?.type === "GET_LOCAL_HEALTH"
        ? () => fetchJson("/health", { method: "POST" }, 6_000)
        : request?.type === "GET_YOUTUBE_JOBS"
          ? getJobs
        : null;
  if (!run) return false;
  run()
    .then(sendResponse)
    .catch((error: Error & { threadId?: string }) =>
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Local service request failed",
        threadId: error.threadId,
      }),
    );
  return true;
});
