/** Owns the extension's narrow local-service calls and validated analysis cache. */
import {
  ANALYSIS_SCHEMA_VERSION,
  parseAnalysis,
} from "./analysis-contract.js";

const LOCAL_AGENT = "http://127.0.0.1:47893";

export type AnalysisJob = {
  id: string;
  videoId: string;
  title: string;
  status: "queued" | "running" | "succeeded" | "failed";
  threadId?: string;
  error?: string;
  progress?: {
    stage:
      | "queued"
      | "preparing"
      | "analyzing"
      | "persistence"
      | "complete"
      | "failed"
      | "needs_review";
    message: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

function parseCacheEntry(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== ANALYSIS_SCHEMA_VERSION ||
    !("threadId" in value) ||
    typeof value.threadId !== "string" ||
    !value.threadId ||
    !("analysis" in value)
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

export async function analyze(videoId: string, title: string, channelId?: string) {
  const cacheKey = `farplane-youtube-analysis-v${ANALYSIS_SCHEMA_VERSION}:${videoId}`;
  const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
  const parsed = parseCacheEntry(cached);
  if (parsed) {
    await fetchJson(
      "/ingest-cached",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoId,
          title,
          channelId,
          analysis: parsed.analysis,
          threadId: parsed.threadId,
        }),
      },
      10_000,
    );
    return {
      ok: true,
      analysis: parsed.analysis,
      threadId: parsed.threadId,
      cached: true,
    };
  }

  const payload = await fetchJson(
    "/analyze-youtube",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, title, channelId }),
    },
    185_000,
  );
  if (payload.reused) {
    return {
      ok: true,
      reused: true,
      dossierId: typeof payload.dossierId === "string" ? payload.dossierId : undefined,
      threadId: typeof payload.threadId === "string" ? payload.threadId : undefined,
      cached: false,
    };
  }
  const analysis = parseAnalysis(payload.analysis);
  if (typeof payload.threadId !== "string" || !payload.threadId) {
    throw new Error("Invalid analysis thread");
  }
  const threadId = payload.threadId;
  await chrome.storage.local.set({
    [cacheKey]: { schemaVersion: ANALYSIS_SCHEMA_VERSION, analysis, threadId },
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
      ? () => analyze(request.videoId, request.title, request.channelId)
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
