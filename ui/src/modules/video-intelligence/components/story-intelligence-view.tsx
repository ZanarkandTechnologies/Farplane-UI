import { ArrowLeft, ExternalLink, GitBranch, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deriveInformationFlow,
  evidenceUrl,
  formatCalendarDate,
} from "../lib/video-intelligence-model";
import type {
  EvidenceAnchor,
  StoryContribution,
  VideoDossier,
  VideoIntelligenceProjection,
} from "../types";

export function StoryIntelligenceView({
  projection,
  storyId,
  onBack,
  onAllStories,
  onOpenVideo,
  onOpenStory,
}: {
  projection: VideoIntelligenceProjection;
  storyId: string;
  onBack: () => void;
  onAllStories: () => void;
  onOpenVideo: (dossierId: string) => void;
  onOpenStory: (storyId: string) => void;
}) {
  const story = projection.stories.find((candidate) => candidate.id === storyId);
  const aggregate = projection.aggregates.find((candidate) => candidate.storyId === storyId);
  if (!story || !aggregate) return null;
  const contributions = projection.contributions
    .filter((contribution) => contribution.storyId === storyId)
    .sort((left, right) => {
      const leftDossier = projection.dossiers.find((dossier) => dossier.id === left.dossierId);
      const rightDossier = projection.dossiers.find((dossier) => dossier.id === right.dossierId);
      return (
        Date.parse(leftDossier?.publishedAt ?? leftDossier?.createdAt ?? "") -
        Date.parse(rightDossier?.publishedAt ?? rightDossier?.createdAt ?? "")
      );
    });
  const tags = story.tagIds
    .map((tagId) => projection.tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  const relations = projection.relations.filter(
    (relation) => relation.fromStoryId === story.id || relation.toStoryId === story.id,
  );
  const flow = deriveInformationFlow(story.id, projection);

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
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-[11px]"
          onClick={onAllStories}
        >
          All stories
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article
          className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-8 sm:py-8"
          data-testid="video-intelligence-story"
        >
          <header>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[9px] uppercase">
                Event
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatCalendarDate(story.eventDate)} · {aggregate.sourceCount}{" "}
                {aggregate.sourceCount === 1 ? "source" : "sources"}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-7 sm:text-2xl">{story.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{story.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[9px]">
                  {tag.canonicalName}
                </Badge>
              ))}
            </div>
          </header>

          <section>
            <SectionLabel icon={<Layers3 className="size-3.5" />}>Reporting timeline</SectionLabel>
            <div className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-border">
              {contributions.map((contribution) => {
                const dossier = projection.dossiers.find(
                  (candidate) => candidate.id === contribution.dossierId,
                );
                return (
                  <button
                    key={contribution.id}
                    type="button"
                    onClick={() => onOpenVideo(contribution.dossierId)}
                    className="relative block w-full touch-manipulation rounded-md pl-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="absolute top-2 left-0 size-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="rounded-md border p-3 hover:border-primary/40 hover:bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {dossier?.publisher ?? dossier?.title ?? "Unknown source"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {dossier?.publishedAt
                            ? formatCalendarDate(dossier.publishedAt)
                            : "Publication date unknown"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {contribution.frame}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionLabel>Perspectives</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {contributions.map((contribution) => (
                <PerspectiveCard
                  key={contribution.id}
                  contribution={contribution}
                  dossier={projection.dossiers.find(
                    (candidate) => candidate.id === contribution.dossierId,
                  )}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionLabel>Shared reporting</SectionLabel>
            {aggregate.sharedClaims.length === 0 ? (
              <EmptyBlock>No claim is independently repeated across linked sources yet.</EmptyBlock>
            ) : (
              <div className="space-y-3">
                {aggregate.sharedClaims.map((claim) => (
                  <div key={claim.statement} className="rounded-md border p-3">
                    <p className="text-xs font-medium leading-5">{claim.statement}</p>
                    <div className="mt-2 space-y-1.5">
                      {claim.evidence.map((evidence) => (
                        <EvidenceLink
                          key={`${evidence.videoId}-${evidence.timestamp}-${evidence.excerpt}`}
                          evidence={evidence}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Source-specific reporting</SectionLabel>
            {aggregate.distinctClaims.length === 0 ? (
              <EmptyBlock>No source-specific claims remain.</EmptyBlock>
            ) : (
              <div className="space-y-3">
                {aggregate.distinctClaims.map((claim) => (
                  <div
                    key={`${claim.dossierId}-${claim.statement}`}
                    className="rounded-md border p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[9px]">
                        {sourceLabel(projection, claim.dossierId)}
                      </Badge>
                      <span className="text-[9px] uppercase text-muted-foreground">
                        {claim.stance}
                      </span>
                    </div>
                    <p className="text-xs leading-5">{claim.statement}</p>
                    <EvidenceLink evidence={claim.evidence} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel icon={<GitBranch className="size-3.5" />}>Information flow</SectionLabel>
            <p className="mb-3 text-[10px] leading-4 text-muted-foreground">
              “Contributes” means the video reports this event. “Related” means shared tags and
              entities—not citation or causality.
            </p>
            <div className="rounded-md border bg-muted/10 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {flow.nodes
                  .filter((node) => node.kind === "source")
                  .map((node) => (
                    <div
                      key={node.id}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"
                    >
                      <FlowNode label={node.title} detail="Source" />
                      <span className="text-[9px] text-muted-foreground" aria-hidden="true">
                        →
                      </span>
                      <FlowNode label={story.title} detail="Current event" primary />
                    </div>
                  ))}
              </div>
              {relations.length > 0 ? (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    Related events
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {relations.map((relation) => {
                      const relatedId =
                        relation.fromStoryId === story.id
                          ? relation.toStoryId
                          : relation.fromStoryId;
                      const related = projection.stories.find(
                        (candidate) => candidate.id === relatedId,
                      );
                      if (!related) return null;
                      return (
                        <button
                          key={relation.id}
                          type="button"
                          onClick={() => onOpenStory(related.id)}
                          className="touch-manipulation rounded-md border bg-background px-3 py-2 text-left hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block text-[10px] font-semibold">{related.title}</span>
                          <span className="mt-0.5 block text-[9px] text-muted-foreground">
                            related · {Math.round(relation.confidence * 100)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}

function FlowNode({
  label,
  detail,
  primary = false,
}: {
  label: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border px-3 py-2 ${
        primary ? "border-primary/50 bg-primary/10" : "bg-background"
      }`}
    >
      <span className="line-clamp-2 text-[10px] font-semibold">{label}</span>
      <span className="mt-1 block text-[9px] uppercase text-muted-foreground">{detail}</span>
    </div>
  );
}

function PerspectiveCard({
  contribution,
  dossier,
}: {
  contribution: StoryContribution;
  dossier?: VideoDossier;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="line-clamp-1 text-[11px] font-semibold">
        {dossier?.publisher ?? dossier?.title ?? "Unknown source"}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{contribution.frame}</p>
    </div>
  );
}

function EvidenceLink({ evidence }: { evidence: EvidenceAnchor }) {
  return (
    <a
      href={evidenceUrl(evidence)}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block border-l-2 border-primary/40 pl-2 text-[10px] leading-4 text-muted-foreground hover:text-foreground"
    >
      <span className="font-mono text-primary">{evidence.timestamp ?? "source"}</span>
      {" · "}
      {evidence.excerpt}
      <ExternalLink className="ml-1 inline size-2.5" />
    </a>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed p-3 text-[11px] leading-4 text-muted-foreground">
      {children}
    </p>
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

function sourceLabel(projection: VideoIntelligenceProjection, dossierId: string): string {
  const dossier = projection.dossiers.find((candidate) => candidate.id === dossierId);
  return dossier?.publisher ?? dossier?.title ?? dossierId;
}
