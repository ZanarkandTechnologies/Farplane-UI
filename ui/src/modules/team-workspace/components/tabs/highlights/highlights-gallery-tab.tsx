"use client";

/**
 * Dedicated Wins and Failures history surfaces.
 *
 * Wins remain a restrained evidence gallery. Failures group canonical daily
 * records by week without creating a second promotion or voting layer.
 */
import { ArrowUpRight, CircleAlert, Sparkles, Trophy } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildOverviewSummarySurface } from "@/modules/team-workspace/lib/dashboard-projections/overview-summary-surface";
import type {
  OverviewHighlightCard,
  OverviewHighlightLink,
} from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { findProjectUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "../project-config";
import { buildFailureWeekGroups, type FailureWeekGroup } from "./highlight-weekly-model";

type HighlightsGalleryKind = "wins" | "failures";

type HighlightsGalleryTabProps = {
  kind: HighlightsGalleryKind;
  projectConfig: FarplaneProjectConfig | null;
  projectConfigState: ProjectConfigLoadState;
  teamScope: string | null | undefined;
};

export function HighlightsGalleryTab({
  kind,
  projectConfig,
  projectConfigState,
  teamScope,
}: HighlightsGalleryTabProps): ReactElement {
  const surface = useMemo(
    () =>
      projectConfigState === "ready"
        ? buildOverviewSummarySurface({
            projectConfig,
            aiBurn24hUsd: 0,
            teamScope,
          })
        : null,
    [projectConfig, projectConfigState, teamScope],
  );
  const projectionReady = Boolean(findProjectUiSnapshot(projectConfig)?.tabs.highlights);
  const cards = kind === "wins" ? (surface?.wins ?? []) : (surface?.failures ?? []);

  if (projectConfigState === "loading") {
    return <GalleryState title={`Loading ${kind}…`} />;
  }
  if (projectConfigState === "error") {
    return (
      <GalleryState
        title={`${kind === "wins" ? "Wins" : "Failures"} are unavailable`}
        detail="Close and reopen Team Workspace to retry."
      />
    );
  }
  if (kind === "wins") {
    return <WinsGallery cards={cards} projectionReady={projectionReady} />;
  }
  return <FailuresGallery cards={cards} projectionReady={projectionReady} />;
}

function WinsGallery({
  cards,
  projectionReady,
}: {
  cards: OverviewHighlightCard[];
  projectionReady: boolean;
}): ReactElement {
  return (
    <ScrollArea className="h-full pr-3">
      <section
        aria-labelledby="wins-gallery-title"
        className="space-y-5 pb-3 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]"
      >
        <GalleryHeader
          icon={<Trophy aria-hidden="true" className="size-4" />}
          title="Wins"
          description="Exceptional results with evidence."
          count={`${cards.length} ${cards.length === 1 ? "entry" : "entries"}`}
        />
        {cards.length === 0 ? (
          <GalleryState
            title="No wins selected yet"
            detail={
              projectionReady
                ? "The latest interval review did not select an exceptional result."
                : "Wins appear after an interval review."
            }
          />
        ) : (
          <div
            className={`grid gap-px overflow-hidden rounded-md border bg-border ${
              cards.length > 1 ? "md:grid-cols-2" : ""
            }`}
          >
            {cards.map((card) => (
              <article className="flex min-h-52 flex-col bg-background p-5" key={card.id}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{periodLabel(card)}</span>
                  {card.cadence ? <span aria-hidden="true">·</span> : null}
                  {card.cadence ? <span>{cadenceLabel(card.cadence)}</span> : null}
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs font-medium text-primary">
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  Exceptional result
                </div>
                <h3 className="mt-2 text-pretty text-base font-semibold leading-6">
                  {card.summary}
                </h3>
                <HighlightLinks card={card} className="mt-auto pt-5" />
              </article>
            ))}
          </div>
        )}
      </section>
    </ScrollArea>
  );
}

function FailuresGallery({
  cards,
  projectionReady,
}: {
  cards: OverviewHighlightCard[];
  projectionReady: boolean;
}): ReactElement {
  const groups = useMemo(() => buildFailureWeekGroups(cards), [cards]);
  const [selectedWeekId, setSelectedWeekId] = useState(groups[0]?.id ?? "");
  useEffect(() => {
    if (!groups.some((group) => group.id === selectedWeekId)) {
      setSelectedWeekId(groups[0]?.id ?? "");
    }
  }, [groups, selectedWeekId]);
  const selectedGroup = groups.find((group) => group.id === selectedWeekId) ?? groups[0] ?? null;

  return (
    <ScrollArea className="h-full pr-3">
      <section
        aria-labelledby="failures-gallery-title"
        className="space-y-5 pb-3 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]"
      >
        <GalleryHeader
          icon={<CircleAlert aria-hidden="true" className="size-4" />}
          title="Failures"
          description="Daily failures, grouped by review week."
          count={`${cards.length} ${cards.length === 1 ? "day" : "days"}`}
          control={
            groups.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="sr-only">Review week</span>
                <select
                  aria-label="Review week"
                  className="h-9 rounded-md border bg-background px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setSelectedWeekId(event.currentTarget.value)}
                  value={selectedGroup?.id ?? ""}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          }
        />

        {!selectedGroup ? (
          <GalleryState
            title="No daily failures selected yet"
            detail={
              projectionReady
                ? "The latest Daily review did not select a learnable failure."
                : "Daily failures appear after an interval review."
            }
          />
        ) : (
          <FailureWeek group={selectedGroup} />
        )}
      </section>
    </ScrollArea>
  );
}

function FailureWeek({ group }: { group: FailureWeekGroup }): ReactElement {
  return (
    <section aria-labelledby="daily-failures-title">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide" id="daily-failures-title">
          Daily Failures
        </h3>
        <span className="text-xs text-muted-foreground">{group.cards.length} this week</span>
      </div>

      <div className="divide-y">
        {group.cards.map((card) => (
          <article className="grid gap-4 py-5 md:grid-cols-[7rem_minmax(0,1fr)]" key={card.id}>
            <div className="text-xs text-muted-foreground">{periodLabel(card)}</div>
            <div className="min-w-0">
              <h4 className="text-pretty text-sm font-semibold leading-6">
                {card.lesson || card.summary}
              </h4>
              {card.lesson ? (
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{card.summary}</p>
              ) : null}
              <HighlightLinks card={card} className="mt-3" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GalleryHeader({
  icon,
  title,
  description,
  count,
  control,
}: {
  icon: ReactElement;
  title: string;
  description: string;
  count: string;
  control?: ReactElement | null;
}): ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h2
            className="text-lg font-semibold tracking-tight"
            id={`${title.toLowerCase()}-gallery-title`}
          >
            {title}
          </h2>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {control}
    </header>
  );
}

function GalleryState({ title, detail }: { title: string; detail?: string }): ReactElement {
  return (
    <div className="border-y border-dashed px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {detail ? (
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function HighlightLinks({
  card,
  className = "",
}: {
  card: OverviewHighlightCard;
  className?: string;
}): ReactElement | null {
  const links: OverviewHighlightLink[] = card.sourceHref
    ? [{ label: "Source report", href: card.sourceHref }, ...card.links]
    : card.links;
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 ${className}`}>
      {links.map((link) => (
        <a
          className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={link.href}
          key={`${link.label}:${link.href}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {destinationLabel(link)}
          <ArrowUpRight aria-hidden="true" className="size-3" />
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
  } catch {
    // Keep the projected label when a destination is not URL-shaped.
  }
  return link.label;
}

function cadenceLabel(cadence: string): string {
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
