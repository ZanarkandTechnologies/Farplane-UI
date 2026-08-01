import { AlertTriangle, ArrowLeft, Clock3, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCalendarDate } from "../lib/video-intelligence-model";
import type { VideoDossier, VideoIntelligenceProjection } from "../types";

export function VideoDossierView({
  projection,
  jobId,
  backLabel,
  onBack,
  onOpenStory,
}: {
  projection: VideoIntelligenceProjection;
  jobId: string;
  backLabel: string;
  onBack: () => void;
  onOpenStory: (storyId: string) => void;
}) {
  const job = projection.jobs.find((candidate) => candidate.id === jobId);
  const dossier =
    projection.dossiers.find(
      (candidate) => candidate.id === job?.dossierId || candidate.videoId === job?.videoId,
    ) ?? null;

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col bg-background">
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
        {dossier ? (
          <a
            href={dossier.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            Watch source <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!dossier ? (
          <PendingDossier status={job?.status} error={job?.error} />
        ) : (
          <DossierArticle dossier={dossier} projection={projection} onOpenStory={onOpenStory} />
        )}
      </div>
    </div>
  );
}

function PendingDossier({
  status,
  error,
}: {
  status?: "queued" | "running" | "succeeded" | "failed";
  error?: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        {status === "failed" ? (
          <AlertTriangle className="mx-auto mb-3 size-7 text-destructive" />
        ) : (
          <Clock3 className="mx-auto mb-3 size-7 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold">
          {status === "failed" ? "Analysis failed" : "Dossier is not ready yet"}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {error ??
            "This video is safely in the queue. Its dossier will appear when analysis completes."}
        </p>
      </div>
    </div>
  );
}

function DossierArticle({
  dossier,
  projection,
  onOpenStory,
}: {
  dossier: VideoDossier;
  projection: VideoIntelligenceProjection;
  onOpenStory: (storyId: string) => void;
}) {
  const stories = dossier.storyIds
    .map((storyId) => projection.stories.find((story) => story.id === storyId))
    .filter((story): story is NonNullable<typeof story> => Boolean(story));
  return (
    <article
      className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:px-8 sm:py-8"
      data-testid="video-intelligence-dossier"
    >
      <header>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[9px] uppercase">
            {dossier.sourceStatus.replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline" className="text-[9px] uppercase">
            {dossier.recommendation.decision}
          </Badge>
          {dossier.duplicateIngestCount > 1 ? (
            <Badge variant="outline" className="text-[9px]">
              Watched {dossier.duplicateIngestCount}×
            </Badge>
          ) : null}
          {dossier.relatedStoryIds.length > 0 ? (
            <Badge className="text-[9px]">Same story seen before</Badge>
          ) : null}
        </div>
        <h1 className="text-xl font-semibold leading-7 sm:text-2xl">{dossier.title}</h1>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {dossier.publisher ?? "Unknown publisher"}
          {dossier.publishedAt ? ` · ${formatCalendarDate(dossier.publishedAt)}` : ""}
        </p>
      </header>

      <section>
        <SectionLabel icon={<Sparkles className="size-3.5" />}>Executive read</SectionLabel>
        <p className="text-sm leading-6">{dossier.summary}</p>
        <p className="mt-3 border-l-2 border-border pl-3 text-[11px] leading-5 text-muted-foreground">
          {dossier.sourceNote}
        </p>
      </section>

      <section>
        <SectionLabel>Stories covered</SectionLabel>
        <div className="space-y-2">
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpenStory(story.id)}
              className="w-full touch-manipulation rounded-md border p-3 text-left hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold">{story.title}</span>
                <span className="shrink-0 text-[10px] text-primary">Open story →</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {story.summary}
              </p>
            </button>
          ))}
        </div>
      </section>

      {dossier.projectRelevance.length > 0 ? (
        <section>
          <SectionLabel>Project relevance</SectionLabel>
          <div className="space-y-2">
            {dossier.projectRelevance.map((item) => (
              <div key={item.project} className="rounded-md border bg-muted/20 p-3">
                <div className="flex justify-between gap-3 text-xs font-semibold">
                  <span>{item.project}</span>
                  <span>{Math.round(item.confidence * 100)}%</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionLabel>Why watch or skip</SectionLabel>
        <p className="text-xs leading-5">{dossier.recommendation.rationale}</p>
      </section>

      <section>
        <SectionLabel>Key points</SectionLabel>
        <div className="space-y-3">
          {dossier.keyPoints.map((point) => (
            <div key={`${point.timestamp}-${point.finding}`} className="flex gap-3 text-xs">
              <span className="w-10 shrink-0 font-mono text-[10px] text-primary">
                {point.timestamp ?? "—"}
              </span>
              <div>
                <p className="font-medium">{point.finding}</p>
                {point.detail ? (
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{point.detail}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}
