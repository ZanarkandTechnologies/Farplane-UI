/**
 * News is a compact evidence list for current, cited developments. It keeps
 * filters and chronological pagination intact, while story details own the
 * fuller editorial explanation and related coverage.
 */

import { ArrowUpRight, Newspaper, SlidersHorizontal } from "lucide-react";
import { useMemo, useRef } from "react";
import type { EditorialTimeline, NewsFilters, NewsItem } from "../hooks/use-editorial-intelligence";
import { contentThumbnailUrl } from "../lib/content-intelligence-model";
import { groupEditorialNewsByDay } from "../lib/editorial-news-layout";
import { displayDate, State, TimelineEndSentinel } from "./content-intelligence-view-primitives";

type EditorialNewsBriefingProps = {
  timeline: EditorialTimeline<NewsItem> & {
    filters: NewsFilters;
    setFilters: (next: NewsFilters) => void;
  };
  onOpenNews: (storyId: string) => void;
};

export function EditorialNewsBriefing({ timeline, onOpenNews }: EditorialNewsBriefingProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupEditorialNewsByDay(timeline.items), [timeline.items]);
  const topicFilters = useMemo(
    () =>
      [...new Set(timeline.items.flatMap((story) => story.tags))]
        .sort((left, right) => left.localeCompare(right))
        .slice(0, 6),
    [timeline.items],
  );
  const updateFilters = (next: Partial<NewsFilters>) =>
    timeline.setFilters({ ...timeline.filters, ...next });

  if (timeline.status === "loading") return <State label="Loading editorial News…" />;
  if (timeline.status === "error")
    return <State label={timeline.error ?? "News is temporarily unavailable."} />;

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      data-testid="editorial-news-briefing"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <header className="border-b border-border/80 pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                Intelligence / News
              </p>
              <h2 className="mt-0.5 [font-family:Inter,sans-serif] text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                Current reporting
              </h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="tabular-nums">
                {timeline.items.length} report{timeline.items.length === 1 ? "" : "s"}
              </span>
              <details className="relative">
                <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 border border-border/80 px-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <SlidersHorizontal className="size-3" /> Filters
                </summary>
                <div className="absolute right-0 z-10 mt-2 grid w-[min(23rem,calc(100vw-3rem))] gap-2 border bg-popover p-3 shadow-lg sm:grid-cols-2">
                  <select
                    aria-label="News status"
                    name="news-status"
                    value={timeline.filters.status}
                    onChange={(event) =>
                      updateFilters({ status: event.target.value as NewsFilters["status"] })
                    }
                    className="h-8 rounded-none border bg-background px-2 text-xs"
                  >
                    <option value="all">All statuses</option>
                    <option value="aggregated">Aggregated</option>
                    <option value="developing">Developing</option>
                  </select>
                  <input
                    aria-label="Filter News by project"
                    autoComplete="off"
                    name="news-project"
                    value={timeline.filters.projectId}
                    onChange={(event) => updateFilters({ projectId: event.target.value })}
                    placeholder="Project…"
                    className="h-8 rounded-none border bg-background px-2 text-xs"
                  />
                  <input
                    aria-label="Filter News by source"
                    autoComplete="off"
                    name="news-source"
                    value={timeline.filters.source}
                    onChange={(event) => updateFilters({ source: event.target.value })}
                    placeholder="Creator or source…"
                    className="h-8 rounded-none border bg-background px-2 text-xs"
                  />
                  <input
                    aria-label="Filter News by topic"
                    autoComplete="off"
                    name="news-topic"
                    value={timeline.filters.topic}
                    onChange={(event) => updateFilters({ topic: event.target.value })}
                    placeholder="Topic…"
                    className="h-8 rounded-none border bg-background px-2 text-xs"
                  />
                </div>
              </details>
            </div>
          </div>

          {topicFilters.length ? (
            <nav className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="News topics">
              {topicFilters.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  aria-pressed={timeline.filters.topic.toLowerCase() === topic.toLowerCase()}
                  onClick={() =>
                    updateFilters({
                      topic:
                        timeline.filters.topic.toLowerCase() === topic.toLowerCase() ? "" : topic,
                    })
                  }
                  className="h-6 border border-border/80 px-2 text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-foreground"
                >
                  {topic}
                </button>
              ))}
            </nav>
          ) : null}
        </header>

        {!groups.length ? (
          <State
            label={
              timeline.hasMore
                ? "No matching News is in this range yet. Keep scrolling to check earlier coverage."
                : "No current, reportable News is available for this date."
            }
          />
        ) : (
          <div className="pt-1">
            {groups.map((group) => (
              <NewsDateGroup
                key={group.day}
                day={group.day}
                items={group.items}
                onOpenNews={onOpenNews}
              />
            ))}
          </div>
        )}
        <TimelineEndSentinel
          scrollRoot={scrollRef}
          canLoadMore={timeline.hasMore}
          isLoading={timeline.isLoadingMore}
          onLoadMore={timeline.loadMore}
          label="Loading earlier News…"
        />
      </div>
    </div>
  );
}

function NewsDateGroup({
  day,
  items,
  onOpenNews,
}: {
  day: string;
  items: NewsItem[];
  onOpenNews: (storyId: string) => void;
}) {
  return (
    <section className="border-b border-border/80 py-3 last:border-b-0" aria-label={day}>
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {day === "Earlier reporting" ? day : displayDate(day)}
        </h3>
        <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {items.length} report{items.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="border-y border-border/80">
        {items.map((story, index) => (
          <NewsListRow
            key={story.id}
            story={story}
            priority={index === 0}
            onOpenNews={onOpenNews}
          />
        ))}
      </div>
    </section>
  );
}

function NewsListRow({
  story,
  priority,
  onOpenNews,
}: {
  story: NewsItem;
  priority: boolean;
  onOpenNews: (storyId: string) => void;
}) {
  const consequence = story.whyItMatters ?? story.summary;
  return (
    <button
      type="button"
      onClick={() => onOpenNews(story.id)}
      data-testid="news-list-row"
      className="group grid w-full grid-cols-[7.03125rem_minmax(0,1fr)] gap-3 border-b border-border/80 px-0 py-3 text-left last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[7.03125rem_minmax(0,1fr)_5.5rem_1rem] sm:items-center sm:gap-4"
    >
      <NewsVisual story={story} priority={priority} />
      <div className="min-w-0">
        <ReportKicker story={story} />
        <h4 className="mt-0.5 line-clamp-2 [font-family:Inter,sans-serif] text-[15px] font-semibold leading-[1.18] tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary sm:text-base">
          {story.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
          <span className="text-foreground/75">Why now: </span>
          {consequence}
        </p>
      </div>
      <CoverageCounts story={story} />
      <ArrowUpRight
        className="hidden size-4 text-muted-foreground transition-colors group-hover:text-primary sm:block"
        aria-hidden="true"
      />
    </button>
  );
}

function CoverageCounts({ story }: { story: NewsItem }) {
  return (
    <div className="hidden border-l border-border/80 pl-3 text-right text-[9px] leading-4 text-muted-foreground sm:block">
      <p className="tabular-nums text-foreground">
        {story.sourceCount} source{story.sourceCount === 1 ? "" : "s"}
      </p>
      <p className="tabular-nums">
        {story.claimCount} claim{story.claimCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function ReportKicker({ story }: { story: NewsItem }) {
  const status = story.editorialStatus === "aggregated" ? "Aggregated" : "Developing";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
      <span className={story.editorialStatus === "aggregated" ? "text-primary" : undefined}>
        {status}
      </span>
      {story.featuredSource?.publisher ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate normal-case tracking-normal">
            {story.featuredSource.publisher}
          </span>
        </>
      ) : null}
      {story.eventDate ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{displayDate(story.eventDate)}</span>
        </>
      ) : null}
    </div>
  );
}

function NewsVisual({ story, priority }: { story: NewsItem; priority: boolean }) {
  const thumbnailUrl = story.featuredSource
    ? contentThumbnailUrl({ canonicalRef: story.featuredSource.canonicalUrl, sourceKind: "video" })
    : undefined;
  return (
    <div className="relative size-[7.03125rem] overflow-hidden border border-border/80 bg-muted">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          width={144}
          height={144}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Newspaper className="size-5" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
