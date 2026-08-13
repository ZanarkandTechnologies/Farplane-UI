"use client";

/**
 * Read-only AI Office library for durable video and story intelligence.
 * Navigation stays module-local so drill-down and Back preserve library context.
 */

import { AlertTriangle, Cloud, FileVideo2, GitCompareArrows, Loader2 } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { OfficeWorkspaceDialog } from "@/components/office-workspace-dialog";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVideoIntelligence } from "../hooks/use-video-intelligence";
import {
  groupStoriesByTimeline,
  groupVideosByTimeline,
  resolveTimelineDatePage,
} from "../lib/video-intelligence-model";
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
  const [videoDateKey, setVideoDateKey] = useState<string | null>(null);
  const [storyDateKey, setStoryDateKey] = useState<string | null>(null);
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
  const videoDatePage = useMemo(
    () => resolveTimelineDatePage(videoGroups, videoDateKey),
    [videoDateKey, videoGroups],
  );
  const storyDatePage = useMemo(
    () => resolveTimelineDatePage(storyGroups, storyDateKey),
    [storyDateKey, storyGroups],
  );

  function selectVideoDate(dateKey: string): void {
    setVideoDateKey(dateKey);
    libraryScrollRef.current?.scrollTo({ top: 0 });
  }

  function selectStoryDate(dateKey: string): void {
    setStoryDateKey(dateKey);
    libraryScrollRef.current?.scrollTo({ top: 0 });
  }

  return (
    <OfficeWorkspaceDialog
        data-testid="video-intelligence-panel"
        open={open}
        onOpenChange={onOpenChange}
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
            <Badge variant="outline" className="gap-1 text-[9px] uppercase tracking-wide">
              <Cloud className="size-3" /> Convex live
            </Badge>
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
                onQueryChange={(nextQuery) => {
                  setQuery(nextQuery);
                  setVideoDateKey(null);
                  setStoryDateKey(null);
                  libraryScrollRef.current?.scrollTo({ top: 0 });
                }}
              />
              <div
                ref={libraryScrollRef}
                data-testid="video-intelligence-library-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
              >
                {activeTab === "videos" ? (
                  <VideoLibrary
                    page={videoDatePage}
                    onPreviousDate={() => {
                      const previousDate = videoGroups[videoDatePage.index + 1];
                      if (previousDate) selectVideoDate(previousDate.key);
                    }}
                    onNextDate={() => {
                      const nextDate = videoGroups[videoDatePage.index - 1];
                      if (nextDate) selectVideoDate(nextDate.key);
                    }}
                    onOpen={(job) => setView({ kind: "dossier", jobId: job.id })}
                  />
                ) : (
                  <StoryLibrary
                    projection={projection}
                    page={storyDatePage}
                    selectedTagId={selectedTagId}
                    onTagChange={(tagId) => {
                      setSelectedTagId(tagId);
                      setStoryDateKey(null);
                      libraryScrollRef.current?.scrollTo({ top: 0 });
                    }}
                    onPreviousDate={() => {
                      const previousDate = storyGroups[storyDatePage.index + 1];
                      if (previousDate) selectStoryDate(previousDate.key);
                    }}
                    onNextDate={() => {
                      const nextDate = storyGroups[storyDatePage.index - 1];
                      if (nextDate) selectStoryDate(nextDate.key);
                    }}
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
    </OfficeWorkspaceDialog>
  );
}

function PanelState({
  icon,
  title,
  detail,
}: {
  icon: ReactElement;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border bg-muted/30">
          {icon}
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
