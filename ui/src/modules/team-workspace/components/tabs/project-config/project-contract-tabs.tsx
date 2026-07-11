/**
 * Farplane 1.8 project-contract surfaces.
 * Inputs are snapshot charter/objective projections; stale and missing metric
 * cards never reuse historical series values as current readings.
 */

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  findProjectUiSnapshot,
  type ProjectUiMetricCard,
} from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "./config-types";
import { ConfigLoadingState } from "./shared";

type ContractTabProps = {
  config: FarplaneProjectConfig | null;
  error: string | null;
  state: ProjectConfigLoadState;
};

export function ProjectCharterTab({ config, error, state }: ContractTabProps): ReactElement {
  const charter = findProjectUiSnapshot(config)?.tabs.overview.charter;
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <TabHeader
          title="Charter"
          subtitle="Human mission, thesis, principles, and hard constraints."
          state={state}
          error={error}
        />
        {charter?.mission ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <ContractCard title="Mission" values={[charter.mission]} />
            <ContractCard title="North Star" values={[charter.northStar]} />
            <ContractCard title="Human Thesis" values={[charter.humanThesis]} />
            <ContractCard title="Operating Principles" values={charter.operatingPrinciples} />
            <ContractCard title="Non-Tradeoffs" values={charter.nonTradeoffs} />
            <ContractCard title="Stable Capabilities" values={charter.stableCapabilities} />
          </div>
        ) : (
          <GapCard text="tabs.overview.charter is missing from the project snapshot." />
        )}
      </div>
    </ScrollArea>
  );
}

export function ProjectObjectivesTab({ config, error, state }: ContractTabProps): ReactElement {
  const snapshot = findProjectUiSnapshot(config);
  const objectives = snapshot?.tabs.objectives;
  const definitionById = new Map(
    (snapshot?.metrics.definitions ?? []).map((definition) => [definition.metricId, definition]),
  );
  const cardById = new Map((objectives?.metricCards ?? []).map((card) => [card.metricId, card]));

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <TabHeader
          title="Objectives"
          subtitle="Optimization objectives, hard guards, and freshness-aware readings."
          state={state}
          error={error}
        />
        {!objectives ? (
          <GapCard text="tabs.objectives is missing from the project snapshot." />
        ) : null}
        {(objectives?.sourceGapIds ?? []).map((id) => (
          <GapCard
            key={id}
            text={snapshot?.sourceGaps.find((gap) => gap.id === id)?.message ?? id}
          />
        ))}

        <MetricSection
          title="Objectives"
          rows={(objectives?.objectives ?? []).map((selection) => ({
            card: cardById.get(selection.metricId),
            definition: definitionById.get(selection.metricId),
            sourceGaps: snapshot?.sourceGaps ?? [],
            metricId: selection.metricId,
            meta: [
              selection.scope,
              selection.priority === null ? "" : `priority ${selection.priority}`,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
        <MetricSection
          title="Hard Guards"
          hardGuard
          rows={(objectives?.guards ?? []).map((selection) => ({
            card: cardById.get(selection.metricId),
            definition: definitionById.get(selection.metricId),
            sourceGaps: snapshot?.sourceGaps ?? [],
            metricId: selection.metricId,
            meta: selection.scope,
          }))}
        />
      </div>
    </ScrollArea>
  );
}

function MetricSection({
  hardGuard = false,
  rows,
  title,
}: {
  hardGuard?: boolean;
  rows: Array<{
    card?: ProjectUiMetricCard;
    definition?: ProjectUiMetricCard;
    metricId: string;
    meta: string;
    sourceGaps: Array<{ id: string; message: string }>;
  }>;
  title: string;
}): ReactElement {
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {rows.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ card, definition, metricId, meta, sourceGaps }) => (
            <MetricStatusCard
              key={metricId}
              card={card}
              definition={definition}
              hardGuard={hardGuard}
              meta={meta}
              metricId={metricId}
              sourceGaps={sourceGaps}
            />
          ))}
        </div>
      ) : (
        <Badge variant="secondary">none projected</Badge>
      )}
    </section>
  );
}

function MetricStatusCard({
  card,
  definition,
  hardGuard,
  meta,
  metricId,
  sourceGaps,
}: {
  card?: ProjectUiMetricCard;
  definition?: ProjectUiMetricCard;
  hardGuard: boolean;
  meta: string;
  metricId: string;
  sourceGaps: Array<{ id: string; message: string }>;
}): ReactElement {
  const status = card?.status || "missing";
  const usable = status === "available" || status === "not_applicable";
  const value =
    usable && card?.current !== null && card?.current !== undefined
      ? `${card.current} ${card.unit}`.trim()
      : status;
  const gaps = card?.sourceGaps.map((gap) => gap.reason) ?? [];
  const definitionGaps = card?.sourceGapIds ?? [];
  const guard = definition?.guard;
  const freshness =
    definition?.maxAgeDays === null || definition?.maxAgeDays === undefined
      ? "freshness not bounded"
      : `max age ${definition.maxAgeDays}d`;

  return (
    <Card
      className={
        hardGuard && !usable ? "rounded-md border-destructive/60 bg-destructive/5" : "rounded-md"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">
              {card?.label || definition?.label || metricId}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
          </div>
          <Badge variant={usable ? "outline" : "destructive"}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p
          className={usable ? "text-xl font-semibold" : "text-base font-semibold text-destructive"}
        >
          {value}
        </p>
        {!usable && card?.series.length ? (
          <p className="text-xs text-muted-foreground">
            Historical observations exist but are not current.
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {definition?.description || card?.description || "Definition not projected."}
        </p>
        <p className="text-xs text-muted-foreground">
          Direction: {definition?.direction || card?.direction || "unspecified"} · {freshness}
        </p>
        {guard ? (
          <p className="text-xs font-medium">
            Guard: {humanizeGuard(guard.operator)} {guard.threshold ?? "threshold missing"}
          </p>
        ) : null}
        {gaps.map((gap) => (
          <p key={gap} className="text-xs text-destructive">
            {gap}
          </p>
        ))}
        {definitionGaps.map((gap) => (
          <p key={gap} className="text-xs text-destructive">
            {sourceGaps.find((row) => row.id === gap)?.message ?? gap}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function humanizeGuard(operator: string): string {
  if (operator === "greater_than_or_equal") return "≥";
  if (operator === "less_than_or_equal") return "≤";
  return operator.replace(/_/g, " ");
}

function TabHeader({
  title,
  subtitle,
  state,
  error,
}: {
  title: string;
  subtitle: string;
  state: ProjectConfigLoadState;
  error: string | null;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ConfigLoadingState state={state} error={error} />
    </div>
  );
}

function GapCard({ text }: { text: string }): ReactElement {
  return (
    <Card className="rounded-md border-dashed">
      <CardContent className="p-4 text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function ContractCard({ title, values }: { title: string; values: string[] }): ReactElement {
  const visible = values.filter(Boolean);
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.length ? (
          visible.map((value) => (
            <p key={value} className="text-sm leading-6 text-muted-foreground">
              {value}
            </p>
          ))
        ) : (
          <Badge variant="secondary">not projected</Badge>
        )}
      </CardContent>
    </Card>
  );
}
