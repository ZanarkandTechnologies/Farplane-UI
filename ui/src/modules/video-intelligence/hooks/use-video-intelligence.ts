import { useCallback, useEffect, useState } from "react";
import type { VideoIntelligenceProjection } from "../types";

type LoadState =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "ready"; data: VideoIntelligenceProjection; error: null }
  | { status: "error"; data: null; error: string };

export function useVideoIntelligence(open: boolean) {
  const [state, setState] = useState<LoadState>({
    status: "idle",
    data: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((current) =>
      current.status === "ready" ? current : { status: "loading", data: null, error: null },
    );
    try {
      const response = await fetch("/farplane/video-intelligence");
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.projection) {
        throw new Error(payload.error || "Video Intelligence is unavailable.");
      }
      setState({ status: "ready", data: payload.projection, error: null });
    } catch (error) {
      setState({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "Video Intelligence is unavailable.",
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [open, refresh]);

  return { ...state, refresh };
}
