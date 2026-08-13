import { ExternalLink, FileText, FileVideo2, Globe2, ImageIcon } from "lucide-react";
import { type ReactNode, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { contentThumbnailUrl, groupContentByObservedDate } from "../lib/content-intelligence-model";
import type { ContentIntelligenceItem } from "../types";
import type { ContentIntelligenceRuntime } from "./content-intelligence-data-controller";
import { displayDate, State, TimelineEndSentinel } from "./content-intelligence-view-primitives";
import { EditorialNewsBriefing } from "./editorial-news-briefing";

export function LibraryLayer({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <div
      className={
        hidden ? "pointer-events-none absolute inset-0 invisible flex" : "flex min-h-0 flex-1"
      }
    >
      {children}
    </div>
  );
}

export function ContentWorkspace({
  content,
  onOpenSource,
  onOpenDossier,
}: {
  content: ContentIntelligenceRuntime["content"];
  onOpenSource: (item: ContentIntelligenceItem) => void;
  onOpenDossier: (dossierId: string, preview: ContentIntelligenceItem) => void;
}) {
  const setResourceBankOpen = useAppStore((state) => state.setIsResourceBankPanelOpen);
  return (
    <ContentTabView
      content={content}
      onOpenResourceBank={() => setResourceBankOpen(true)}
      onOpenSource={onOpenSource}
      onOpenDossier={onOpenDossier}
    />
  );
}

export function NewsWorkspace({
  news,
  onOpenNews,
}: {
  news: ContentIntelligenceRuntime["news"];
  onOpenNews: (storyId: string) => void;
}) {
  return <EditorialNewsBriefing timeline={news} onOpenNews={onOpenNews} />;
}

export function ConceptsWorkspace({ content }: { content: ContentIntelligenceRuntime["content"] }) {
  const concepts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of content.items) {
      for (const tag of item.latestDiscovery?.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, sources]) => ({ name, sources }))
      .sort((left, right) => right.sources - left.sources || left.name.localeCompare(right.name));
  }, [content.items]);

  if (!concepts.length)
    return <State label="Concepts will appear as external-content tags accumulate." />;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      <div className="mx-auto grid max-w-[1460px] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {concepts.map((concept) => (
          <article key={concept.name} className="rounded-md border bg-card p-4">
            <h3 className="text-sm font-semibold">{concept.name}</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {concept.sources} source{concept.sources === 1 ? "" : "s"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ContentTabView({
  content,
  onOpenResourceBank,
  onOpenSource,
  onOpenDossier,
}: {
  content: ContentIntelligenceRuntime["content"];
  onOpenResourceBank: () => void;
  onOpenSource: (item: ContentIntelligenceItem) => void;
  onOpenDossier: (dossierId: string, preview: ContentIntelligenceItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const groups = groupContentByObservedDate(content.items);

  if (content.status === "loading") return <State label="Loading external content…" />;
  if (content.status === "error")
    return <State label={content.error ?? "Content Intelligence unavailable"} />;
  if (!content.items.length) return <State label="No external content has been ingested yet." />;
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {groups.map((group) => (
          <section key={group.date} className="space-y-3">
            <h2 className="border-b border-border/70 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {displayDate(group.date)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {group.items.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onOpenResourceBank={onOpenResourceBank}
                  onOpenSource={onOpenSource}
                  onOpenDossier={onOpenDossier}
                />
              ))}
            </div>
          </section>
        ))}
        <TimelineEndSentinel
          scrollRoot={scrollRef}
          canLoadMore={content.hasMore}
          isLoading={content.isLoadingMore}
          onLoadMore={content.loadMore}
          label="Loading earlier content…"
        />
      </div>
    </div>
  );
}

function ContentCard({
  item,
  onOpenResourceBank,
  onOpenSource,
  onOpenDossier,
}: {
  item: ContentIntelligenceItem;
  onOpenResourceBank: () => void;
  onOpenSource: (item: ContentIntelligenceItem) => void;
  onOpenDossier: (dossierId: string, preview: ContentIntelligenceItem) => void;
}) {
  const thumbnailUrl = contentThumbnailUrl(item);
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-md border bg-card shadow-sm transition-colors motion-reduce:transition-none hover:border-primary/40 hover:bg-muted/10">
      <button
        type="button"
        onClick={() => (item.dossierId ? onOpenDossier(item.dossierId, item) : onOpenSource(item))}
        className="flex min-h-0 flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Open ${item.title}`}
      >
        <div className="relative aspect-video overflow-hidden bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              width={480}
              height={270}
              loading="lazy"
              className="size-full object-cover opacity-85 transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.02]"
            />
          ) : (
            <ContentFallbackVisual item={item} />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 pt-10 pb-2">
            <span className="truncate text-[10px] font-medium text-white/85">
              {item.platform ?? item.sourceKind}
            </span>
            {item.jobs[0] ? (
              <Badge
                variant="secondary"
                className="bg-black/45 text-[9px] text-white hover:bg-black/45"
              >
                {item.jobs[0].status}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <div>
            <p className="text-[10px] text-muted-foreground">
              {displayDate(item.lastObservedAt)}
              {item.latestDiscovery ? ` · ${item.latestDiscovery.entityGroupId}` : ""}
            </p>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{item.title}</h3>
          </div>
          {item.summary ? (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {item.summary}
            </p>
          ) : (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {item.jobs[0]?.kind.replaceAll("_", " ") ?? "External source"}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1">
            {item.projectIds.map((projectId) => (
              <Badge key={projectId} variant="secondary" className="text-[9px]">
                {projectId}
              </Badge>
            ))}
            {item.latestDiscovery?.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[9px]">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2 px-3 pt-1 pb-3 sm:px-4 sm:pb-4">
        <a
          href={item.canonicalRef}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Source <ExternalLink className="size-3" />
        </a>
        {item.resourceAssetId ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={onOpenResourceBank}
          >
            Resource Bank
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function ContentFallbackVisual({ item }: { item: ContentIntelligenceItem }) {
  const Icon =
    item.sourceKind === "image" || item.sourceKind === "screenshot"
      ? ImageIcon
      : item.sourceKind === "video"
        ? FileVideo2
        : item.sourceKind === "url"
          ? Globe2
          : FileText;
  return (
    <div className="flex size-full flex-col justify-between bg-gradient-to-br from-primary/20 via-muted to-background p-4">
      <Icon aria-hidden="true" className="size-7 text-primary/75" />
      <p className="line-clamp-2 max-w-[20rem] text-xs font-medium text-foreground/75">
        {item.title}
      </p>
    </div>
  );
}
