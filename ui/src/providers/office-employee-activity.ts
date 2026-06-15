"use client";

/**
 * Office employee activity mapping.
 *
 * Ownership: provider-side conversion from runtime live status into employee overlay state.
 * Inputs: runtime `AgentLiveStatus` rows from Codex, OpenClaw, or Convex.
 * Outputs: compact employee activity state, label, and detail for office overlays.
 * Side effects: none; this file is pure data shaping.
 */

import type { EmployeeActivityState } from "@/modules/office/lib/types";
import type { AgentLiveStatus } from "@/modules/runtime";

export type EmployeeActivitySummary = {
  state: EmployeeActivityState;
  label?: string;
  detail?: string;
};

function hasLiveStatusHint(liveStatus: AgentLiveStatus | undefined, pattern: RegExp): boolean {
  if (!liveStatus) return false;
  return [
    liveStatus.statusText,
    liveStatus.currentSkillId,
    ...liveStatus.bubbles.map((bubble) => bubble.label),
  ].some((value) => typeof value === "string" && pattern.test(value));
}

function firstLiveBubbleLabel(liveStatus: AgentLiveStatus | undefined): string | undefined {
  return liveStatus?.bubbles.find((bubble) => bubble.label.trim().length > 0)?.label;
}

export function deriveEmployeeActivity(liveStatus?: AgentLiveStatus): EmployeeActivitySummary {
  if (!liveStatus) return { state: "idle" };

  if (
    (liveStatus.state === "idle" || liveStatus.state === "no_work") &&
    liveStatus.bubbles.length === 0
  ) {
    return { state: "idle", detail: liveStatus.statusText };
  }

  if (hasLiveStatusHint(liveStatus, /\b(review|reviewing|reviewer)\b/i)) {
    return { state: "review", label: "Review", detail: liveStatus.statusText };
  }

  if (hasLiveStatusHint(liveStatus, /\b(waiting|approval|blocked|needs input|confirm)\b/i)) {
    return { state: "waiting", label: "Waiting", detail: liveStatus.statusText };
  }

  if (liveStatus.state === "error") {
    return { state: "failed", label: "Failed", detail: liveStatus.statusText };
  }

  if (liveStatus.state === "blocked") {
    return { state: "waiting", label: "Waiting", detail: liveStatus.statusText };
  }

  if (
    liveStatus.state === "running" ||
    liveStatus.state === "planning" ||
    liveStatus.state === "executing"
  ) {
    return {
      state: "running",
      label: firstLiveBubbleLabel(liveStatus) ?? "Running",
      detail: liveStatus.statusText,
    };
  }

  if (liveStatus.state === "done" || liveStatus.state === "ok") {
    const isReadyForReview = hasLiveStatusHint(liveStatus, /\b(update ready|response ready)\b/i);
    return {
      state: "done",
      label: isReadyForReview ? "Ready" : "Done",
      detail: liveStatus.statusText,
    };
  }

  return { state: "idle", detail: liveStatus.statusText };
}
