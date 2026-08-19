import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  VideoDossierDetail,
  VideoStoryDetail,
} from "@/modules/video-intelligence/hooks/use-video-intelligence-timeline";
import {
  type RelatedCoverageItem,
  useDossierRelatedCoverage,
} from "../hooks/use-editorial-intelligence";
import type { ContentIntelligenceItem } from "../types";
import { displayDate } from "./content-intelligence-view-primitives";
import { ContentJobProgress } from "./content-job-progress";

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
      <div className="h-5 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-5 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-md border bg-muted/30 motion-reduce:animate-none" />
      <p className="text-xs text-muted-foreground">Loading the analyzed dossier…</p>
    </div>
  );
}

export function DossierBody({
  dossier,
  onOpenDossier,
}: {
  dossier: VideoDossierDetail;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
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
      {dossier.concepts?.length ? (
        <section className="space-y-2" aria-label="Dossier concepts">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Concepts
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {dossier.concepts.map((concept) => (
              <Badge key={concept} variant="secondary">
                #{concept}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
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
              Recent creator takes linked to the same development or active discussion.
            </p>
          </div>
          <RelatedCoverageList
            items={relatedCoverage}
            parentTitle={dossier.title}
            onOpenDossier={onOpenDossier}
          />
        </section>
      ) : null}
      {dossier.stories.length ? (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Citations
          </h2>
          <CitationList stories={dossier.stories} />
        </section>
      ) : null}
    </>
  );
}

export function CitationList({ stories }: { stories: VideoDossierDetail["stories"] }) {
  return (
    <div className="space-y-2">
      {stories.map((story) => (
        <a
          key={story.id}
          href={story.referenceUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md border p-3 hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-[10px] text-muted-foreground">{story.eventDate ?? "Undated source"}</p>
          <p className="mt-1 text-sm font-medium">{story.title}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
            Original source <ExternalLink className="size-3" aria-hidden="true" />
          </span>
        </a>
      ))}
    </div>
  );
}

export function RelatedCoverageList({
  items,
  parentTitle,
  onOpenDossier,
}: {
  items: RelatedCoverageItem[];
  parentTitle: string;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
}) {
  return (
    <div className="space-y-2" data-testid="related-coverage-list">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-md border p-3 transition-colors hover:border-primary/40 hover:bg-muted/20 focus-within:border-primary/40"
        >
          <button
            type="button"
            onClick={() => onOpenDossier(item.dossierId, parentTitle)}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open comparable take: ${item.title}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{item.publisher ?? item.title}</p>
              <time dateTime={item.timelineDay} className="text-[10px] text-muted-foreground">
                {displayDate(item.timelineDay)}
              </time>
            </div>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary">
              {item.relationship === "same_development"
                ? "Same development"
                : "Same active discussion"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground/80">Creator take: </span>
              {item.summary}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              <span className="font-medium text-foreground/80">Why comparable: </span>
              {item.rationale}
            </p>
          </button>
          <a
            href={item.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-7 items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open creator source <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
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
            <ContentJobProgress item={item} />
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
