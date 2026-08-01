/** Video Intelligence reads its live projection directly from Convex. */
import { useQuery } from "convex/react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { VideoIntelligenceProjection } from "../types";

type LoadState =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "ready"; data: VideoIntelligenceProjection; error: null }
  | { status: "error"; data: null; error: string };

export function useVideoIntelligence(open: boolean): LoadState {
  const convexEnabled = isConvexEnabled();
  const projection = useQuery(
    api.modules.videoIntelligence.projection.getVideoIntelligenceProjection,
    convexEnabled && open ? {} : "skip",
  ) as VideoIntelligenceProjection | undefined;
  if (!open) return { status: "idle", data: null, error: null };
  if (!convexEnabled) {
    return {
      status: "error",
      data: null,
      error: "Convex is not configured for this UI session.",
    };
  }
  if (projection === undefined) return { status: "loading", data: null, error: null };
  return { status: "ready", data: projection, error: null };
}
