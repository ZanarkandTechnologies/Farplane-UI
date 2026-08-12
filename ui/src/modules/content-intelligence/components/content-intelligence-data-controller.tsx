"use client";

/**
 * Keeps the small, date-scoped Convex subscriptions mounted after the first
 * Content Intelligence visit. The dialog itself is intentionally allowed to
 * unmount while closed without throwing away the warm result set.
 */
import { useEffect, useState } from "react";
import { useNewsTimeline } from "../hooks/use-editorial-intelligence";
import {
  type ContentTimelineState,
  useContentIntelligenceTimeline,
} from "../hooks/use-content-intelligence-timeline";

export type ContentIntelligenceRuntime = {
  content: ContentTimelineState;
  news: ReturnType<typeof useNewsTimeline>;
};

export function ContentIntelligenceDataController({
  open,
  children,
}: {
  open: boolean;
  children: (runtime: ContentIntelligenceRuntime) => React.ReactNode;
}): React.JSX.Element {
  const [activated, setActivated] = useState(open);
  useEffect(() => {
    if (open) setActivated(true);
  }, [open]);

  const content = useContentIntelligenceTimeline(activated);
  const news = useNewsTimeline(activated);

  return <>{children({ content, news })}</>;
}
