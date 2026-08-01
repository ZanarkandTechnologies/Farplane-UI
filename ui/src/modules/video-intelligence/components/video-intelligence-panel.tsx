"use client";

/**
 * Read-only AI Office library for durable video and story intelligence.
 * Navigation stays module-local so drill-down and Back preserve library context.
 */

import { AlertTriangle, FileVideo2, GitCompareArrows, Loader2, RefreshCw } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import { useVideoIntelligence } from "../hooks/use-video-intelligence";
import { groupStoriesByTimeline, groupVideosByTimeline } from "../lib/video-intelligence-model";
import type { VideoIntelligencePanelProps } from "../types";
import { StoryIntelligenceView } from "./story-intelligence-view";
import { VideoDossierView } from "./video-dossier-view";
import {
  type LibraryTab,
  LibraryToolbar,
  StoryLibrary,
  VideoLibrary,
} from "./video-intelligence-library";

type ViewState =
  | { kind: "library" }
  | { kind: "dossier"; jobId: string; fromStoryId?: string }
  | { kind: "story"; storyId: string; fromJobId?: string; fromStoryId?: string };

export function VideoIntelligencePanel({
  open,
  onOpenChange,
  initialVideoId,
}: VideoIntelligencePanelProps): ReactElement {
  const loadState = useVideoIntelligence(open);
  const [activeTab, setActiveTab] = useState<LibraryTab>("videos");
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>({ kind: "library" });
  const libraryScrollRef = useRef<HTMLDivElement>(null);
  const projection = loadState.data;

  useEffect(() => {
    if (!open || !projection || !initialVideoId) return;
    const job = projection.jobs.find((candidate) => candidate.videoId === initialVideoId);
    if (job) setView({ kind: "dossier", jobId: job.id });
  }, [initialVideoId, open, projection]);

  const videoGroups = useMemo(
    () => (projection ? groupVideosByTimeline(projection, query) : []),
    [projection, query],
  );
  const storyGroups = useMemo(
    () => (projection ? groupStoriesByTimeline(projection, query, selectedTagId) : []),
    [projection, query, selectedTagId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="video-intelligence-panel"
        className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-md p-0 sm:h-[94dvh] sm:w-[94vw] sm:max-w-6xl"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="shrink-0 border-b px-3 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <GitCompareArrows className="size-4 text-primary" />
                Video Intelligence
              </DialogTitle>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Videos, events, and cited reporting
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-[11px]"
              onClick={() => void loadState.refresh()}
              disabled={loadState.status === "loading"}
            >
              <RefreshCw
                className={`size-3.5 ${loadState.status === "loading" ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {loadState.status === "loading" || loadState.status === "idle" ? (
          <PanelState
            icon={<Loader2 className="size-5 animate-spin" />}
            title="Reading video memory"
            detail="Loading videos, stories, and reporting evidence."
          />
        ) : loadState.status === "error" ? (
          <PanelState
            icon={<AlertTriangle className="size-5 text-destructive" />}
            title="Video Intelligence unavailable"
            detail={loadState.error}
            action={
              <Button size="sm" variant="outline" onClick={() => void loadState.refresh()}>
                Try again
              </Button>
            }
          />
        ) : !projection || projection.jobs.length === 0 ? (
          <PanelState
            icon={<FileVideo2 className="size-5" />}
            title="No videos ingested yet"
            detail="Use the Farplane control on a YouTube video. It will appear here before analysis finishes."
          />
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 flex min-h-0 flex-col ${
                view.kind === "library" ? "visible opacity-100" : "invisible opacity-0"
              }`}
              aria-hidden={view.kind !== "library"}
            >
              <LibraryToolbar
                activeTab={activeTab}
                query={query}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setSelectedTagId(null);
                }}
                onQueryChange={setQuery}
              />
              <div
                ref={libraryScrollRef}
                data-testid="video-intelligence-library-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
              >
                {activeTab === "videos" ? (
                  <VideoLibrary
                    groups={videoGroups}
                    onOpen={(job) => setView({ kind: "dossier", jobId: job.id })}
                  />
                ) : (
                  <StoryLibrary
                    projection={projection}
                    groups={storyGroups}
                    selectedTagId={selectedTagId}
                    onTagChange={setSelectedTagId}
                    onOpen={(storyId) => setView({ kind: "story", storyId })}
                  />
                )}
              </div>
            </div>

            {view.kind === "dossier" ? (
              <VideoDossierView
                projection={projection}
                jobId={view.jobId}
                backLabel={view.fromStoryId ? "Back to story" : "All videos"}
                onBack={() =>
                  view.fromStoryId
                    ? setView({ kind: "story", storyId: view.fromStoryId })
                    : setView({ kind: "library" })
                }
                onOpenStory={(storyId) =>
                  setView({
                    kind: "story",
                    storyId,
                    fromJobId: view.jobId,
                  })
                }
              />
            ) : null}

            {view.kind === "story" ? (
              <StoryIntelligenceView
                projection={projection}
                storyId={view.storyId}
                onBack={() =>
                  view.fromStoryId
                    ? setView({ kind: "story", storyId: view.fromStoryId })
                    : view.fromJobId
                      ? setView({ kind: "dossier", jobId: view.fromJobId })
                      : setView({ kind: "library" })
                }
                onAllStories={() => {
                  setActiveTab("stories");
                  setView({ kind: "library" });
                }}
                onOpenVideo={(dossierId) => {
                  const job = projection.jobs.find(
                    (candidate) => candidate.dossierId === dossierId,
                  );
                  if (job) {
                    setView({
                      kind: "dossier",
                      jobId: job.id,
                      fromStoryId: view.storyId,
                    });
                  }
                }}
                onOpenStory={(storyId) =>
                  setView({
                    kind: "story",
                    storyId,
                    fromStoryId: view.storyId,
                  })
                }
              />
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PanelState({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactElement;
  title: string;
  detail: string;
  action?: ReactElement;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border bg-muted/30">
          {icon}
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
