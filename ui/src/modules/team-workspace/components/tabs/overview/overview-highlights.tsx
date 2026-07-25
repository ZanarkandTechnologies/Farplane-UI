"use client";

/**
 * Interval highlight galleries.
 * Inputs are render-safe, active-team cards from the project UI snapshot; output
 * is read-only win and failure evidence with no backend or board dependency.
 */

import { ExternalLink, Lightbulb, Sparkles, TriangleAlert, Trophy } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  OverviewHighlightCard,
  OverviewHighlightLink,
} from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";

export function OverviewHighlights({
  failures,
  projectionReady,
  wins,
}: {
  failures: OverviewHighlightCard[];
  projectionReady: boolean;
  wins: OverviewHighlightCard[];
}): ReactElement {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <HighlightGallery
        cards={wins}
        emptyText={
          projectionReady
            ? "No exceptional metric win was selected for this interval."
            : "Eligible metric wins will appear after an interval review."
        }
        icon={<Trophy aria-hidden="true" className="h-4 w-4 text-primary" />}
        kind="win"
        title="Wins"
      />
      <HighlightGallery
        cards={failures}
        emptyText={
          projectionReady
            ? "No learnable failure was selected for this interval."
            : "Learnable failures will appear after an interval review."
        }
        icon={<TriangleAlert aria-hidden="true" className="h-4 w-4 text-destructive" />}
        kind="failure"
        title="Failures"
      />
    </div>
  );
}

function HighlightGallery({
  cards,
  emptyText,
  icon,
  kind,
  title,
}: {
  cards: OverviewHighlightCard[];
  emptyText: string;
  icon: ReactNode;
  kind: "win" | "failure";
  title: string;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const visibleCards = expanded ? cards : cards.slice(0, 3);
  const hiddenCount = cards.length - visibleCards.length;

  return (
    <Card
      className={kind === "win" ? "rounded-md border-primary/25 bg-primary/[0.025]" : "rounded-md"}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {icon}
            {title}
          </CardTitle>
          <Badge variant={cards.length > 0 ? "outline" : "secondary"}>
            {cards.length > 0 ? `${cards.length} recent` : "none selected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {cards.length > 0 ? (
          <div className="space-y-3">
            {visibleCards.map((card) => (
              <HighlightCard key={card.id} card={card} />
            ))}
            {cards.length > 3 ? (
              <button
                aria-expanded={expanded}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => setExpanded((value) => !value)}
                type="button"
              >
                {expanded
                  ? "Show fewer"
                  : `View ${hiddenCount} more ${kind === "win" ? "wins" : "failures"}`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HighlightCard({ card }: { card: OverviewHighlightCard }): ReactElement {
  const period = periodLabel(card);
  const isWin = card.kind === "win";
  return (
    <article
      className={
        isWin
          ? "space-y-3 rounded-md border border-primary/35 bg-gradient-to-br from-primary/10 via-background/60 to-background/30 p-4 shadow-[inset_3px_0_0_0_var(--color-primary)]"
          : "space-y-3 rounded-md border bg-background/40 p-3"
      }
    >
      {isWin ? (
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          Exceptional result
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {card.cadence ? <Badge variant="secondary">{cadenceLabel(card.cadence)}</Badge> : null}
        {period ? <span className="text-xs text-muted-foreground">{period}</span> : null}
        {card.sourceGapIds.length > 0 ? <Badge variant="outline">source gap</Badge> : null}
      </div>
      <p
        className={
          isWin
            ? "break-words text-base font-semibold leading-7 text-foreground [overflow-wrap:anywhere]"
            : "break-words text-sm font-medium leading-6 [overflow-wrap:anywhere]"
        }
      >
        {card.summary}
      </p>
      {card.lesson ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-destructive">
            <Lightbulb aria-hidden="true" className="h-3.5 w-3.5" />
            Lesson
          </p>
          <p className="mt-1.5 break-words text-sm leading-6 [overflow-wrap:anywhere]">
            {card.lesson}
          </p>
        </div>
      ) : null}
      <HighlightLinks card={card} />
    </article>
  );
}

function HighlightLinks({ card }: { card: OverviewHighlightCard }): ReactElement | null {
  const links: OverviewHighlightLink[] = card.sourceHref
    ? [{ label: "Source report", href: card.sourceHref }, ...card.links]
    : card.links;
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {links.map((link) => (
        <a
          key={`${link.label}:${link.href}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-sm px-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {destinationLabel(link)}
          <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

function destinationLabel(link: OverviewHighlightLink): string {
  if (link.label === "Source report") return link.label;
  try {
    const url = new URL(link.href, "http://farplane.local");
    const ref = url.searchParams.get("ref") ?? url.pathname;
    const ticketMatch = ref.match(/(?:^|\/)(TASK-\d+)\/ticket\.md$/i);
    if (ticketMatch) return ticketMatch[1].toUpperCase();
    const fileName = ref.split(/[\\/]/).filter(Boolean).at(-1);
    if (fileName && /^(?:ticket|index)\.md$/i.test(link.label)) return fileName;
  } catch {
    // Keep the projected label when a destination is not URL-shaped.
  }
  return link.label;
}

function cadenceLabel(cadence: string | undefined): string {
  if (!cadence) return "";
  return cadence
    .replace(/_interval$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (value) => value.toUpperCase());
}

function periodLabel(card: OverviewHighlightCard): string {
  if (card.period) return card.period;
  if (!card.createdAt) return "";
  const timestamp = Date.parse(card.createdAt);
  if (!Number.isFinite(timestamp)) return card.createdAt;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(timestamp);
}
