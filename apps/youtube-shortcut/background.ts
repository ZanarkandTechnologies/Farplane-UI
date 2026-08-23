/**
 * Startup-safe service-worker relay for local Farplane requests.
 * Keep runtime imports out so message registration cannot be blocked by analysis code.
 */
import type { RuntimeRequest } from "./runtime-protocol.js";

const LOCAL_AGENT = "http://127.0.0.1:47893";

type RelayTarget = {
  path: "/analyze-youtube" | "/health" | "/jobs" | "/projects";
  body?: Record<string, unknown>;
  timeoutMs: number;
};

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  return [
    "ANALYZE_YOUTUBE",
    "GET_LOCAL_HEALTH",
    "GET_YOUTUBE_JOBS",
    "GET_FARPLANE_PROJECTS",
  ].includes(value.type as string);
}

function relayTarget(request: RuntimeRequest): RelayTarget {
  switch (request.type) {
    case "GET_LOCAL_HEALTH":
      return { path: "/health", timeoutMs: 6_000 };
    case "GET_YOUTUBE_JOBS":
      return { path: "/jobs", timeoutMs: 6_000 };
    case "GET_FARPLANE_PROJECTS":
      return { path: "/projects", timeoutMs: 6_000 };
    case "ANALYZE_YOUTUBE":
      return {
        path: "/analyze-youtube",
        timeoutMs: 185_000,
        body: {
          videoId: typeof request.videoId === "string" ? request.videoId : "",
          title: typeof request.title === "string" ? request.title : "",
          channelId: typeof request.channelId === "string" ? request.channelId : undefined,
          reAnalyze: request.reAnalyze === true,
          projectId: typeof request.projectId === "string" ? request.projectId : undefined,
          instruction: typeof request.instruction === "string" ? request.instruction : undefined,
        },
      };
  }
}

async function forwardRuntimeRequest(rawRequest: unknown) {
  if (!isRuntimeRequest(rawRequest)) {
    return { ok: false, error: "Unsupported Farplane runtime request" };
  }
  const target = relayTarget(rawRequest);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs);
  try {
    const response = await fetch(`${LOCAL_AGENT}${target.path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-farplane-client": "youtube-shortcut",
        "x-farplane-request-id": createRequestId(),
      },
      body: target.body ? JSON.stringify(target.body) : undefined,
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null) return payload;
    return { ok: false, error: `Local service returned HTTP ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Local service request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function relayResponse(request: unknown, respond: (response: unknown) => void) {
  void forwardRuntimeRequest(request).then(respond);
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  relayResponse(request, sendResponse);
  return true;
});

// Supports the immediately previous unpacked build while Brave reloads the new one.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "farplane-youtube") return;
  port.onMessage.addListener((request) => relayResponse(request, (response) => {
    try {
      port.postMessage(response);
    } catch {
      // The popup or content script closed before the bridge completed.
    }
  }));
});

export { forwardRuntimeRequest };
