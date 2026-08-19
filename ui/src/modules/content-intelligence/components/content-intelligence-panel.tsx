"use client";

/** Unified, read-only external-data workspace for Content, News, Concepts, and World. */
import { BookOpenText, Globe2, Network, Newspaper, PanelTopOpen } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { OfficeWorkspaceDialog } from "@/components/office-workspace-dialog";
import { Badge } from "@/components/ui/badge";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useVideoDossierDetail,
  useVideoStoryDetail,
} from "@/modules/video-intelligence/hooks/use-video-intelligence-timeline";
import { WorldMapBody } from "@/modules/world-map/components/world-map-panel";
import { useNewsDetail } from "../hooks/use-editorial-intelligence";
import {
  type ContentIntelligencePrimaryTab,
  contentIntelligencePrimaryTabs,
  dossierBackLabel,
} from "../lib/content-intelligence-model";
import type { ContentIntelligenceItem, ContentIntelligencePanelProps } from "../types";
import type { ContentIntelligenceRuntime } from "./content-intelligence-data-controller";
import {
  ContentSourceDetailView,
  DossierBody,
  DossierLoading,
  DossierShell,
  StoryBody,
} from "./content-intelligence-dossier";
import {
  ConceptsWorkspace,
  ContentWorkspace,
  LibraryLayer,
  NewsWorkspace,
} from "./content-intelligence-library";
import { displayDate, State } from "./content-intelligence-view-primitives";
import { OriginalSourceLink } from "./editorial-news-briefing";

type ContentTab = ContentIntelligencePrimaryTab;

type DetailView =
  | { kind: "source"; sourceId: string; preview: ContentIntelligenceItem }
  | {
      kind: "dossier";
      dossierId: string;
      preview?: ContentIntelligenceItem;
      fromStoryId?: string;
      fromTab?: ContentTab;
      fromDossierId?: string;
      fromDossierTitle?: string;
    }
  | { kind: "story"; storyId: string; fromDossierId?: string }
  | { kind: "news"; storyId: string };

class ContentProjectionBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[content-intelligence] projection failed", {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(previousProps: Readonly<{ children: ReactNode; resetKey: string }>): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <State label="Content data is temporarily unavailable. Retry after the Content Intelligence backend is available." />
      );
    }
    return this.props.children;
  }
}

export function ContentIntelligencePanel({
  open,
  onOpenChange,
  initialTab = "content",
  companyWorldSource,
  runtime,
}: ContentIntelligencePanelProps & { runtime: ContentIntelligenceRuntime }): React.JSX.Element {
  const [tab, setTab] = useState<ContentTab>(initialTab);
  const [detail, setDetail] = useState<DetailView | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setDetail(null);
    }
  }, [initialTab, open]);

  const returnToLibrary = () => setDetail(null);
  const openLibraryTab = (nextTab: ContentTab) => {
    setTab(nextTab);
    returnToLibrary();
  };
  const openDossier = (
    dossierId: string,
    preview?: ContentIntelligenceItem,
    fromStoryId?: string,
    fromTab?: ContentTab,
    fromDossierId?: string,
    fromDossierTitle?: string,
  ) =>
    setDetail({
      kind: "dossier",
      dossierId,
      preview,
      fromStoryId,
      fromTab,
      fromDossierId,
      fromDossierTitle,
    });
  const openStory = (storyId: string, fromDossierId?: string) =>
    setDetail({ kind: "story", storyId, fromDossierId });
  const openNews = (storyId: string) => setDetail({ kind: "news", storyId });
  return (
    <OfficeWorkspaceDialog
      data-testid="content-intelligence-panel"
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <PanelTopOpen className="size-4 text-primary" />
              Content Intelligence
            </DialogTitle>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              External sources, cited stories, connected concepts, and your read-only world
            </p>
          </div>
          <Badge variant="outline" className="gap-1 text-[9px] uppercase tracking-wide">
            <Globe2 className="size-3" /> external data
          </Badge>
        </div>
      </DialogHeader>
      <Tabs
        value={tab}
        onValueChange={(value) => openLibraryTab(value as ContentTab)}
        className="min-h-0 flex flex-1 flex-col"
      >
        <div className="relative shrink-0 border-b">
          <TabsList
            aria-label="Content Intelligence navigation"
            className="h-auto w-full justify-start overflow-x-auto rounded-none bg-transparent px-3 py-2 sm:px-5"
          >
            {contentIntelligencePrimaryTabs.map((primaryTab) => (
              <TabsTrigger
                key={primaryTab}
                value={primaryTab}
                onClick={returnToLibrary}
                className="shrink-0 gap-1.5"
              >
                {primaryTab === "content" ? <BookOpenText className="size-3.5" /> : null}
                {primaryTab === "news" ? <Newspaper className="size-3.5" /> : null}
                {primaryTab === "concepts" ? <Network className="size-3.5" /> : null}
                {primaryTab === "world" ? <Globe2 className="size-3.5" /> : null}
                {primaryTab === "content"
                  ? "Content"
                  : primaryTab === "news"
                    ? "News"
                    : primaryTab === "concepts"
                      ? "Concepts"
                      : "World"}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="relative min-h-0 flex flex-1">
          {detail ? (
            <ContentIntelligenceDetail
              detail={detail}
              contentItems={runtime.content.items}
              onBack={() => {
                if (detail.kind === "story" && detail.fromDossierId) {
                  openDossier(detail.fromDossierId);
                  return;
                }
                if (detail.kind === "dossier" && detail.fromStoryId) {
                  openStory(detail.fromStoryId);
                  return;
                }
                if (detail.kind === "dossier" && detail.fromDossierId) {
                  openDossier(detail.fromDossierId);
                  return;
                }
                returnToLibrary();
              }}
              onAllStories={() => {
                openLibraryTab("news");
              }}
              onOpenDossier={openDossier}
              onOpenStory={openStory}
            />
          ) : null}
          {tab === "content" ? (
            <LibraryLayer hidden={Boolean(detail)}>
              <ContentProjectionBoundary resetKey={tab}>
                <ContentWorkspace
                  content={runtime.content}
                  onOpenSource={(item) =>
                    setDetail({ kind: "source", sourceId: item.id, preview: item })
                  }
                  onOpenDossier={(dossierId, preview) =>
                    openDossier(dossierId, preview, undefined, "content")
                  }
                />
              </ContentProjectionBoundary>
            </LibraryLayer>
          ) : null}
          {tab === "news" ? (
            <LibraryLayer hidden={Boolean(detail)}>
              <NewsWorkspace news={runtime.news} onOpenNews={openNews} />
            </LibraryLayer>
          ) : null}
          {tab === "concepts" ? (
            <LibraryLayer hidden={Boolean(detail)}>
              <ContentProjectionBoundary resetKey={tab}>
                <ConceptsWorkspace content={runtime.content} />
              </ContentProjectionBoundary>
            </LibraryLayer>
          ) : null}
          {tab === "world" ? (
            <LibraryLayer hidden={Boolean(detail)}>
              <WorldMapBody
                active={open && tab === "world"}
                companyWorldSource={companyWorldSource}
              />
            </LibraryLayer>
          ) : null}
        </div>
      </Tabs>
    </OfficeWorkspaceDialog>
  );
}

function ContentIntelligenceDetail({
  detail,
  contentItems,
  onBack,
  onAllStories,
  onOpenDossier,
  onOpenStory,
}: {
  detail: DetailView;
  contentItems: ContentIntelligenceItem[];
  onBack: () => void;
  onAllStories: () => void;
  onOpenDossier: (
    dossierId: string,
    preview?: ContentIntelligenceItem,
    fromStoryId?: string,
    fromTab?: ContentTab,
    fromDossierId?: string,
    fromDossierTitle?: string,
  ) => void;
  onOpenStory: (storyId: string, fromDossierId?: string) => void;
}) {
  if (detail.kind === "source") {
    const item =
      contentItems.find((candidate) => candidate.id === detail.sourceId) ?? detail.preview;
    const dossierId = item.dossierId;
    return (
      <ContentSourceDetailView
        item={item}
        onBack={onBack}
        onOpenDossier={dossierId ? () => onOpenDossier(dossierId, item) : undefined}
      />
    );
  }
  if (detail.kind === "story") {
    return (
      <VideoStoryDetailView
        storyId={detail.storyId}
        onBack={onBack}
        onAllStories={onAllStories}
        onOpenDossier={(dossierId) => onOpenDossier(dossierId, undefined, detail.storyId)}
      />
    );
  }
  if (detail.kind === "news") {
    return (
      <EditorialNewsDetailView
        storyId={detail.storyId}
        onBack={onBack}
        onOpenDossier={(dossierId) => onOpenDossier(dossierId, undefined, undefined, "news")}
      />
    );
  }
  return (
    <VideoDossierDetailView
      dossierId={detail.dossierId}
      preview={detail.preview}
      backLabel={dossierBackLabel(detail)}
      onBack={onBack}
      onOpenStory={(storyId) => onOpenStory(storyId, detail.dossierId)}
      onOpenDossier={(dossierId, fromDossierTitle) =>
        onOpenDossier(
          dossierId,
          undefined,
          undefined,
          undefined,
          detail.dossierId,
          fromDossierTitle,
        )
      }
    />
  );
}

function EditorialNewsDetailView({
  storyId,
  onBack,
  onOpenDossier,
}: {
  storyId: string;
  onBack: () => void;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
}) {
  const news = useNewsDetail(storyId);
  return (
    <DossierShell
      title={news?.title ?? "Opening News report"}
      backLabel="Back to News"
      onBack={onBack}
      data-testid="content-news-detail"
    >
      {news === undefined ? (
        <DossierLoading />
      ) : news === null ? (
        <State label="This editorial report is no longer available." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={news.editorialStatus === "aggregated" ? "default" : "outline"}>
              {news.editorialStatus === "aggregated" ? "Aggregated" : "Developing"}
            </Badge>
            {news.eventDate ? <Badge variant="outline">{displayDate(news.eventDate)}</Badge> : null}
          </div>
          <OriginalSourceLink referenceUrl={news.referenceUrl} />
          <section className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              What changed
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{news.summary}</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Why it matters
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{news.whyItMatters}</p>
            <p className="text-xs text-muted-foreground">Why now: {news.whyNow}</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Creator coverage
            </h2>
            {news.contributors.map((contributor) => (
              <button
                key={contributor.id}
                type="button"
                onClick={() => onOpenDossier(contributor.dossierId)}
                className="block w-full rounded-md border p-3 text-left hover:border-primary/40 hover:bg-muted/20"
              >
                <p className="text-sm font-medium">
                  {contributor.publisher ?? contributor.sourceTitle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {contributor.frame} · {contributor.claimCount} claims
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {contributor.summary}
                </p>
              </button>
            ))}
          </section>
        </>
      )}
    </DossierShell>
  );
}

function VideoDossierDetailView({
  dossierId,
  preview,
  backLabel,
  onBack,
  onOpenStory,
  onOpenDossier,
}: {
  dossierId: string;
  preview?: ContentIntelligenceItem;
  backLabel: string;
  onBack: () => void;
  onOpenStory: (storyId: string) => void;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
}) {
  const dossier = useVideoDossierDetail(dossierId);
  const title = dossier?.title ?? preview?.title ?? "Opening dossier";
  return (
    <DossierShell
      title={title}
      canonicalUrl={dossier?.canonicalUrl ?? preview?.canonicalRef}
      backLabel={backLabel}
      onBack={onBack}
      data-testid="content-video-dossier-detail"
    >
      {dossier === undefined ? (
        <DossierLoading preview={preview} />
      ) : dossier === null ? (
        <State label="The source dossier is no longer available." />
      ) : (
        <DossierBody dossier={dossier} onOpenStory={onOpenStory} onOpenDossier={onOpenDossier} />
      )}
    </DossierShell>
  );
}

function VideoStoryDetailView({
  storyId,
  onBack,
  onAllStories,
  onOpenDossier,
}: {
  storyId: string;
  onBack: () => void;
  onAllStories: () => void;
  onOpenDossier: (dossierId: string) => void;
}) {
  const story = useVideoStoryDetail(storyId);
  return (
    <DossierShell
      title={story?.title ?? "Opening story"}
      backLabel="Back to stories"
      onBack={onBack}
      data-testid="content-story-detail"
    >
      {story === undefined ? (
        <DossierLoading />
      ) : story === null ? (
        <State label="This cited story is no longer available." />
      ) : (
        <StoryBody story={story} onAllStories={onAllStories} onOpenDossier={onOpenDossier} />
      )}
    </DossierShell>
  );
}
