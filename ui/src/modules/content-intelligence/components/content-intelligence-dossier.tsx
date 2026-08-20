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
  type RelatedCoverageProjection,
  useDossierRelatedCoverage,
} from "../hooks/use-editorial-intelligence";
import { relatedCoverageReceiptView } from "../lib/content-intelligence-model";
import type { ContentIntelligenceItem } from "../types";
import { displayDate } from "./content-intelligence-view-primitives";
import { ContentJobProgress } from "./content-job-progress";

export function DossierShell({
  title,
  canonicalUrl,
  thumbnailUrl,
  backLabel,
  onBack,
  children,
  "data-testid": testId,
}: {
  title: string;
  canonicalUrl?: string;
  thumbnailUrl?: string;
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
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {backLabel}
        </Button>
        {canonicalUrl ? (
          <a
            href={canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open source <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
          <header className="space-y-4">
            {thumbnailUrl ? <DossierThumbnailBanner thumbnailUrl={thumbnailUrl} /> : null}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Video dossier
              </p>
              <h1 className="mt-2 text-pretty text-xl font-semibold leading-7 sm:text-2xl">
                {title}
              </h1>
            </div>
          </header>
          {children}
        </article>
      </div>
    </div>
  );
}

export function DossierThumbnailBanner({ thumbnailUrl }: { thumbnailUrl: string }) {
  return (
    <div
      className="relative h-28 w-full overflow-hidden border bg-muted sm:aspect-[16/5] sm:h-auto"
      data-testid="dossier-thumbnail-banner"
    >
      <img
        src={thumbnailUrl}
        alt=""
        width={640}
        height={360}
        fetchPriority="high"
        className="size-full object-cover opacity-90"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/65 via-transparent to-black/10"
        aria-hidden="true"
      />
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
    <DossierBodyContent
      dossier={dossier}
      relatedCoverage={relatedCoverage}
      onOpenDossier={onOpenDossier}
    />
  );
}

export function DossierBodyContent({
  dossier,
  relatedCoverage,
  onOpenDossier,
}: {
  dossier: VideoDossierDetail;
  relatedCoverage: RelatedCoverageProjection | undefined;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {dossier.publisher ? <Badge variant="secondary">{dossier.publisher}</Badge> : null}
        <Badge variant="outline">{sourceStatusLabel(dossier.sourceStatus)}</Badge>
        {dossier.publishedAt ? (
          <Badge variant="outline">{displayDate(dossier.publishedAt)}</Badge>
        ) : null}
      </div>
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
      <section className="space-y-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Summary
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{dossier.summary}</p>
        <details className="group border-t border-border/70 pt-2 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer select-none font-medium text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Source notes
          </summary>
          <p className="mt-2 leading-5">{dossier.sourceNote}</p>
        </details>
      </section>
      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Key points
        </h2>
        <ol className="divide-y divide-border/80 border-y border-border/80">
          {dossier.keyPoints.map((point, index) => (
            <li
              key={`${point.finding}-${point.detail ?? ""}-${point.timestamp ?? ""}`}
              className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-4 text-sm"
            >
              <span className="pt-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 font-medium">{point.finding}</p>
                  {point.timestamp ? (
                    <p className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {point.timestamp}
                    </p>
                  ) : null}
                </div>
                {point.detail ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{point.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
      <DossierCitations stories={dossier.stories} />
      <RelatedCoverageSection
        projection={relatedCoverage}
        parentTitle={dossier.title}
        onOpenDossier={onOpenDossier}
      />
      <DossierIntelligenceReceipt dossier={dossier} projection={relatedCoverage} />
    </>
  );
}

export function DossierCitations({ stories }: { stories: VideoDossierDetail["stories"] }) {
  return (
    <section className="space-y-3" aria-labelledby="dossier-citations-heading">
      <div className="space-y-1">
        <h2
          id="dossier-citations-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Citations
        </h2>
        <p className="text-xs text-muted-foreground">
          Original sources used to verify developments in this dossier.
        </p>
      </div>
      {stories.length ? (
        <ul className="divide-y divide-border/80 border-y border-border/80">
          {stories.map((story) => (
            <li key={story.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <a
                  href={story.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-pretty">{story.title}</span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                </a>
              </div>
              {story.eventDate ? (
                <time
                  dateTime={story.eventDate}
                  className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                >
                  {displayDate(story.eventDate)}
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          No external citations were extracted.
        </p>
      )}
    </section>
  );
}

export function DossierIntelligenceReceipt({
  dossier,
  projection,
}: {
  dossier: Pick<VideoDossierDetail, "sourceStatus" | "stories">;
  projection: RelatedCoverageProjection | undefined;
}) {
  const comparison = projection ? relatedCoverageReceiptView(projection) : null;

  return (
    <section
      className="space-y-3 rounded-md border border-primary/20 bg-primary/[0.035] p-3"
      aria-labelledby="intelligence-receipt-heading"
      data-testid="dossier-intelligence-receipt"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="intelligence-receipt-heading" className="text-sm font-semibold">
            Intelligence receipt
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            What this analysis produced and checked.
          </p>
        </div>
        <Badge variant="secondary">Ready</Badge>
      </div>
      <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        <ReceiptMetric label="Source" value={sourceStatusLabel(dossier.sourceStatus)} />
        <ReceiptMetric
          label="Citations"
          value={
            dossier.stories.length
              ? `${dossier.stories.length} source${dossier.stories.length === 1 ? "" : "s"}`
              : "None extracted"
          }
        />
        <ReceiptMetric
          label="Comparison"
          value={
            comparison
              ? `${comparison.acceptedLabel} accepted / ${comparison.candidateLabel} checked`
              : "Loading receipt"
          }
        />
      </dl>
    </section>
  );
}

function sourceStatusLabel(status: VideoDossierDetail["sourceStatus"]): string {
  switch (status) {
    case "TRANSCRIPT_USED":
      return "Transcript used";
    case "SUMMARY_ONLY":
      return "Summary only";
    case "TRANSCRIPT_UNAVAILABLE":
      return "No transcript";
  }
}

export function RelatedCoverageSection({
  projection,
  parentTitle,
  onOpenDossier,
}: {
  projection: RelatedCoverageProjection | undefined;
  parentTitle: string;
  onOpenDossier: (dossierId: string, fromDossierTitle?: string) => void;
}) {
  const view = projection ? relatedCoverageReceiptView(projection) : null;

  return (
    <section className="space-y-3" aria-labelledby="related-coverage-heading">
      <div className="space-y-1">
        <h2
          id="related-coverage-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Related coverage
        </h2>
        <p className="text-xs text-muted-foreground">
          Recent videos from other creators covering the same development or active discussion.
        </p>
      </div>
      {view && projection ? (
        <>
          <div
            className="min-w-0 space-y-3 rounded-md border bg-muted/20 p-3"
            data-testid="related-coverage-receipt"
            data-state={view.state}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-pretty">{view.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{view.summary}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2">
              <ReceiptMetric label="Horizon" value={view.horizonLabel} />
              <ReceiptMetric label="Candidates" value={view.candidateLabel} />
              <ReceiptMetric label="Accepted" value={view.acceptedLabel} />
            </dl>
            <p className="break-words text-[11px] leading-4 text-muted-foreground">
              <span className="font-medium text-foreground/80">Window: </span>
              {view.windowLabel}
            </p>
            {view.limitation ? (
              <p className="break-words text-[11px] leading-4 text-muted-foreground">
                <span className="font-medium text-foreground/80">Limitation: </span>
                {view.limitation}
              </p>
            ) : null}
          </div>
          {projection.items.length ? (
            <RelatedCoverageList
              items={projection.items}
              parentTitle={parentTitle}
              onOpenDossier={onOpenDossier}
            />
          ) : null}
        </>
      ) : (
        <output
          className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"
          aria-live="polite"
        >
          Loading comparison receipt…
        </output>
      )}
    </section>
  );
}

function ReceiptMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded border bg-background/60 px-2 py-1.5">
      <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs font-medium tabular-nums">{value}</dd>
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
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to content
        </Button>
        <a
          href={item.canonicalRef}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open source <ExternalLink className="size-3" aria-hidden="true" />
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
