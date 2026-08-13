import { BookOpenText, ChevronLeft, ChevronRight, FileVideo2, Search } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  type StoryLibraryItem,
  statusTone,
  type TimelineDatePage,
  type VideoLibraryItem,
} from "../lib/video-intelligence-model";
import type { VideoIngestJob, VideoIntelligenceProjection } from "../types";

export type LibraryTab = "videos" | "stories";

export function LibraryToolbar({
  activeTab,
  query,
  onTabChange,
  onQueryChange,
}: {
  activeTab: LibraryTab;
  query: string;
  onTabChange: (tab: LibraryTab) => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b bg-muted/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div
        role="tablist"
        aria-label="Video Intelligence library"
        className="grid grid-cols-2 rounded-md border bg-background p-0.5"
      >
        {(["videos", "stories"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={`h-8 min-w-28 touch-manipulation rounded-sm px-4 text-[10px] font-semibold uppercase tracking-[0.15em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="relative sm:w-72">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground"
        />
        <Input
          aria-label={`Search ${activeTab}`}
          name="video-intelligence-search"
          autoComplete="off"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={`Search ${activeTab}…`}
          className="h-8 pl-8 text-xs"
        />
      </div>
    </div>
  );
}

export function VideoLibrary({
  page,
  onPreviousDate,
  onNextDate,
  onOpen,
}: {
  page: TimelineDatePage<VideoLibraryItem>;
  onPreviousDate: () => void;
  onNextDate: () => void;
  onOpen: (job: VideoIngestJob) => void;
}) {
  const group = page.group;
  if (!group) return <FilteredEmpty icon={<FileVideo2 className="size-5" />} />;
  return (
    <div className="space-y-5" data-testid="video-intelligence-videos">
      <TimelineDatePager page={page} onPreviousDate={onPreviousDate} onNextDate={onNextDate} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {group.items.map(({ job, dossier }) => (
          <button
            key={job.id}
            type="button"
            onClick={() => onOpen(job)}
            className="group touch-manipulation overflow-hidden rounded-md border bg-background text-left transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative aspect-video overflow-hidden bg-muted">
              <img
                src={`https://i.ytimg.com/vi/${job.videoId}/mqdefault.jpg`}
                alt=""
                width={320}
                height={180}
                loading="lazy"
                className="size-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-3 pt-8 pb-2">
                <Badge variant={statusTone(job.status)} className="text-[9px] uppercase">
                  {job.status}
                </Badge>
                {dossier?.duplicateIngestCount && dossier.duplicateIngestCount > 1 ? (
                  <span className="text-[9px] text-white/75">
                    Watched {dossier.duplicateIngestCount}×
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 p-3">
              <h3 className="line-clamp-2 text-sm font-semibold leading-5">{job.title}</h3>
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{dossier?.publisher ?? job.videoId}</span>
                <span className="shrink-0">
                  {dossier
                    ? `${dossier.storyIds.length} ${
                        dossier.storyIds.length === 1 ? "story" : "stories"
                      }`
                    : "Awaiting dossier"}
                </span>
              </div>
              {job.error ? (
                <p className="line-clamp-2 text-[10px] text-destructive">{job.error}</p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StoryLibrary({
  projection,
  page,
  selectedTagId,
  onTagChange,
  onPreviousDate,
  onNextDate,
  onOpen,
}: {
  projection: VideoIntelligenceProjection;
  page: TimelineDatePage<StoryLibraryItem>;
  selectedTagId: string | null;
  onTagChange: (tagId: string | null) => void;
  onPreviousDate: () => void;
  onNextDate: () => void;
  onOpen: (storyId: string) => void;
}) {
  const group = page.group;
  return (
    <div data-testid="video-intelligence-stories">
      {projection.tags.length > 0 ? (
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TagFilter
            active={selectedTagId === null}
            label="All stories"
            onClick={() => onTagChange(null)}
          />
          {projection.tags.map((tag) => (
            <TagFilter
              key={tag.id}
              active={selectedTagId === tag.id}
              label={tag.canonicalName}
              onClick={() => onTagChange(tag.id)}
            />
          ))}
        </div>
      ) : null}
      {!group ? (
        <FilteredEmpty icon={<BookOpenText className="size-5" />} />
      ) : (
        <div className="space-y-4">
          <TimelineDatePager page={page} onPreviousDate={onPreviousDate} onNextDate={onNextDate} />
          <div className="space-y-2">
            {group.items.map(({ story, aggregate, tags }) => (
              <button
                key={story.id}
                type="button"
                onClick={() => onOpen(story.id)}
                className="w-full touch-manipulation rounded-md border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{story.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {story.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-[9px]">
                          {tag.canonicalName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-3 text-[10px] text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
                    <span>
                      {aggregate?.sourceCount ?? 0}{" "}
                      {(aggregate?.sourceCount ?? 0) === 1 ? "source" : "sources"}
                    </span>
                    <span>
                      {aggregate?.perspectiveCount ?? 0}{" "}
                      {(aggregate?.perspectiveCount ?? 0) === 1 ? "perspective" : "perspectives"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TagFilter({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 shrink-0 touch-manipulation rounded-full border px-3 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TimelineDatePager<T>({
  page,
  onPreviousDate,
  onNextDate,
}: {
  page: TimelineDatePage<T>;
  onPreviousDate: () => void;
  onNextDate: () => void;
}) {
  const group = page.group;
  if (!group) return null;
  return (
    <div
      data-testid="video-intelligence-date-pager"
      className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 p-1.5"
    >
      <button
        type="button"
        aria-label="Previous date"
        disabled={page.index >= page.pageCount - 1}
        onClick={onPreviousDate}
        className="flex h-8 shrink-0 items-center gap-1 rounded-sm px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Previous</span>
      </button>
      <div className="min-w-0 text-center" aria-live="polite">
        <p className="truncate text-[11px] font-semibold">{group.label}</p>
        <p className="text-[9px] tabular-nums text-muted-foreground">
          {group.items.length} {group.items.length === 1 ? "item" : "items"} · {page.index + 1} of{" "}
          {page.pageCount}
        </p>
      </div>
      <button
        type="button"
        aria-label="Next date"
        disabled={page.index === 0}
        onClick={onNextDate}
        className="flex h-8 shrink-0 items-center gap-1 rounded-sm px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function FilteredEmpty({ icon }: { icon: ReactElement }) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed">
      <div className="text-center text-muted-foreground">
        <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full border">
          {icon}
        </div>
        <p className="text-xs">No matching intelligence.</p>
      </div>
    </div>
  );
}
