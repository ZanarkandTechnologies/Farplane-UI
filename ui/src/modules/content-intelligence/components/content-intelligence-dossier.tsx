import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  VideoDossierDetail,
  VideoStoryDetail,
} from "@/modules/video-intelligence/hooks/use-video-intelligence-timeline";
import { useDossierRelatedCoverage } from "../hooks/use-editorial-intelligence";
import type { ContentIntelligenceItem } from "../types";
import { displayDate } from "./content-intelligence-view-primitives";

export function DossierShell({
  title,
  canonicalUrl,
  backLabel,
  onBack,
  children,
  "data-testid": testId,
}: {
  title: string;
  canonicalUrl?: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
  "data-testid": string;
}) {
  return (
    <div className="absolute inset-0 flex min-h-0 flex-col bg-background" data-testid={testId}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 sm:px-5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-[11px]"
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Button>
        {canonicalUrl ? (
          <a
            href={canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            Open source <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
          <header>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Video dossier
            </p>
            <h1 className="mt-2 text-xl font-semibold leading-7 sm:text-2xl">{title}</h1>
          </header>
          {children}
        </article>
      </div>
    </div>
  );
}

export function DossierLoading({ preview }: { preview?: ContentIntelligenceItem }) {
  return (
    <div className="space-y-4" aria-live="polite">
      {preview?.summary ? (
        <p className="text-sm leading-6 text-muted-foreground">{preview.summary}</p>
      ) : null}
      <div className="h-5 w-full animate-pulse rounded bg-muted" />
      <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-md border bg-muted/30" />
      <p className="text-xs text-muted-foreground">Loading the analyzed dossier…</p>
    </div>
  );
}

export function DossierBody({
  dossier,
  onOpenStory,
  onOpenDossier,
  onOpenWorld,
}: {
  dossier: VideoDossierDetail;
  onOpenStory: (storyId: string) => void;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
  onOpenWorld: () => void;
}) {
  const relatedCoverage = useDossierRelatedCoverage(dossier.id);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {dossier.publisher ? <Badge variant="secondary">{dossier.publisher}</Badge> : null}
        <Badge variant="outline">{dossier.sourceStatus.replaceAll("_", " ")}</Badge>
        {dossier.publishedAt ? (
          <Badge variant="outline">{displayDate(dossier.publishedAt)}</Badge>
        ) : null}
      </div>
      <section className="space-y-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Dossier
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{dossier.summary}</p>
        <p className="text-xs text-muted-foreground">{dossier.sourceNote}</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Key points
        </h2>
        <ol className="space-y-3">
          {dossier.keyPoints.map((point) => (
            <li
              key={`${point.finding}-${point.detail ?? ""}-${point.timestamp ?? ""}`}
              className="rounded-md border p-3 text-sm"
            >
              <p className="font-medium">{point.finding}</p>
              {point.detail ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{point.detail}</p>
              ) : null}
              {point.timestamp ? (
                <p className="mt-2 text-[10px] text-muted-foreground">{point.timestamp}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {relatedCoverage?.length ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Related coverage
            </h2>
            <p className="text-xs text-muted-foreground">
              Other current sources covering the same recurring lens.
            </p>
          </div>
          {relatedCoverage.map((topic) => (
            <div key={topic.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium">{topic.title}</h3>
                <p className="text-[10px] text-muted-foreground">
                  {topic.coverageCount} other perspective{topic.coverageCount === 1 ? "" : "s"} ·{" "}
                  {topic.creatorCount} creator{topic.creatorCount === 1 ? "" : "s"}
                </p>
              </div>
              {topic.curatedWorldMarkdown ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-6 px-0 font-mono text-[10px] text-primary"
                  onClick={onOpenWorld}
                >
                  {topic.curatedWorldMarkdown}
                </Button>
              ) : null}
              <div className="mt-3 space-y-2">
                {topic.coverage.map((coverage) => (
                  <button
                    key={coverage.id}
                    type="button"
                    onClick={() => onOpenDossier(coverage.dossierId, dossier.title)}
                    className="block w-full rounded border p-2.5 text-left hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="text-xs font-medium">{coverage.publisher ?? coverage.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {coverage.frame} · {displayDate(coverage.timelineDay)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {coverage.summary}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      {dossier.stories.length ? (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Cited stories
          </h2>
          {dossier.stories.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpenStory(story.id)}
              className="block w-full rounded-md border p-3 text-left hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="text-[10px] text-muted-foreground">
                {story.eventDate ?? "Undated story"}
              </p>
              <p className="mt-1 text-sm font-medium">{story.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{story.summary}</p>
            </button>
          ))}
        </section>
      ) : null}
    </>
  );
}

export function StoryBody({
  story,
  onAllStories,
  onOpenDossier,
}: {
  story: VideoStoryDetail;
  onAllStories: () => void;
  onOpenDossier: (dossierId: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {story.eventDate ? <Badge variant="outline">{displayDate(story.eventDate)}</Badge> : null}
        {story.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary">
            #{tag.name}
          </Badge>
        ))}
      </div>
      <section className="space-y-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Summary
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{story.summary}</p>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Creator coverage
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onAllStories}
          >
            All stories
          </Button>
        </div>
        {story.contributions.map((contribution) => (
          <button
            key={contribution.id}
            type="button"
            onClick={() => onOpenDossier(contribution.dossierId)}
            className="block w-full rounded-md border p-3 text-left hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-sm font-medium">{contribution.source?.title ?? "Source dossier"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {contribution.frame} · {contribution.claimCount} claims
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{contribution.summary}</p>
          </button>
        ))}
      </section>
      {story.entities.length ? (
        <p className="text-xs text-muted-foreground">{story.entities.join(" · ")}</p>
      ) : null}
    </>
  );
}

export function ContentSourceDetailView({
  item,
  onBack,
  onOpenDossier,
}: {
  item: ContentIntelligenceItem;
  onBack: () => void;
  onOpenDossier?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col bg-background"
      data-testid="content-source-detail"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 sm:px-5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-[11px]"
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5" />
          Back to content
        </Button>
        <a
          href={item.canonicalRef}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Open source <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
          <header>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.platform ?? item.sourceKind} · observed {displayDate(item.lastObservedAt)}
            </p>
            <h1 className="mt-2 text-xl font-semibold leading-7 sm:text-2xl">{item.title}</h1>
            {item.summary ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
            ) : null}
          </header>
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Intake
            </h2>
            <div className="rounded-md border p-3 text-xs">
              <p>
                {item.jobs.length
                  ? item.jobs.map((job) => job.kind.replaceAll("_", " ")).join(" · ")
                  : "External source"}
              </p>
              {item.latestDiscovery ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Observed {item.latestDiscovery.observedDate} from{" "}
                  {item.latestDiscovery.entityGroupId}
                </p>
              ) : null}
            </div>
          </section>
          {item.projectIds.length || item.latestDiscovery?.tags.length ? (
            <section className="space-y-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Context
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {item.projectIds.map((projectId) => (
                  <Badge key={projectId} variant="secondary" className="text-[9px]">
                    {projectId}
                  </Badge>
                ))}
                {item.latestDiscovery?.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[9px]">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
          {onOpenDossier ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenDossier}>
              Open video dossier
            </Button>
          ) : null}
        </article>
      </div>
    </div>
  );
}
