"use client";

/**
 * Employee activity visibility state.
 *
 * Ownership: local "done activity seen" persistence for one employee.
 * Inputs: employee id plus current activity labels/state/timestamp.
 * Outputs: visible activity values and a marker for user acknowledgement.
 * Side effects: reads/writes localStorage for seen activity timestamps.
 */

import { useCallback, useMemo, useState } from "react";
import type { EmployeeActivityState } from "@/modules/office/lib/types";

const SEEN_ACTIVITY_STORAGE_KEY = "farplane.office.seen-activity.v1";

function readSeenActivityTimestamp(employeeId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SEEN_ACTIVITY_STORAGE_KEY) ?? "{}",
    ) as Record<string, unknown>;
    const value = parsed[employeeId];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function markActivitySeen(employeeId: string, updatedAt?: number): void {
  if (typeof window === "undefined" || typeof updatedAt !== "number") return;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SEEN_ACTIVITY_STORAGE_KEY) ?? "{}",
    ) as Record<string, unknown>;
    window.localStorage.setItem(
      SEEN_ACTIVITY_STORAGE_KEY,
      JSON.stringify({ ...parsed, [employeeId]: updatedAt }),
    );
  } catch {
    window.localStorage.setItem(
      SEEN_ACTIVITY_STORAGE_KEY,
      JSON.stringify({ [employeeId]: updatedAt }),
    );
  }
}

export function useEmployeeActivityVisibility(input: {
  employeeId: string;
  activityState?: EmployeeActivityState;
  activityLabel?: string;
  activityDetail?: string;
  activityUpdatedAt?: number;
}): {
  visibleActivityState?: EmployeeActivityState;
  visibleActivityLabel?: string;
  visibleActivityDetail?: string;
  markVisibleActivitySeen: () => void;
} {
  const { employeeId, activityState, activityLabel, activityDetail, activityUpdatedAt } = input;
  const [seenActivityUpdatedAt, setSeenActivityUpdatedAt] = useState(() =>
    readSeenActivityTimestamp(employeeId),
  );

  const hasSeenDoneActivity =
    activityState === "done" &&
    typeof activityUpdatedAt === "number" &&
    seenActivityUpdatedAt >= activityUpdatedAt;

  const markVisibleActivitySeen = useCallback(() => {
    if (activityState !== "done" || typeof activityUpdatedAt !== "number") return;
    markActivitySeen(employeeId, activityUpdatedAt);
    setSeenActivityUpdatedAt(activityUpdatedAt);
  }, [activityState, activityUpdatedAt, employeeId]);

  return useMemo(
    () => ({
      visibleActivityState: hasSeenDoneActivity ? "idle" : activityState,
      visibleActivityLabel: hasSeenDoneActivity ? undefined : activityLabel,
      visibleActivityDetail: hasSeenDoneActivity ? undefined : activityDetail,
      markVisibleActivitySeen,
    }),
    [
      activityDetail,
      activityLabel,
      activityState,
      hasSeenDoneActivity,
      markVisibleActivitySeen,
    ],
  );
}
