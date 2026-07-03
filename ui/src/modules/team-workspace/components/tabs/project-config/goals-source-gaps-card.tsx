"use client";

/**
 * Goal source-gap card.
 * Inputs are compiled project UI snapshot gaps; output is a compact operator-facing
 * summary that names affected KPIs and SMART goals when the snapshot links them.
 */

import { AlertTriangle } from "lucide-react";
import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  sourceGapsById,
  type ProjectUiSnapshot,
} from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";

type GoalSourceGapCard = {
  affectedKpis: Array<{ goalId: string; label: string; metricId: string }>;
  id: string;
  message: string;
  owner: string;
  path?: string;
};

function genericGapMessage(message: string): boolean {
  return /no available observation for metric|missing:farplane\/bindings\.yaml#metrics/i.test(message);
}

function displayGapMessage(gap: GoalSourceGapCard): string {
  if (gap.affectedKpis.length === 0) return gap.message;
  const labels = gap.affectedKpis
    .map((kpi) => `${kpi.label} (${kpi.metricId})`)
    .join(", ");
  if (genericGapMessage(gap.message)) {
    return `Missing KPI reading: ${labels}`;
  }
  return `${gap.message}: ${labels}`;
}

export function buildGoalSourceGapCards(snapshot: ProjectUiSnapshot | null): GoalSourceGapCard[] {
  if (!snapshot) return [];
  const gaps = sourceGapsById(snapshot);
  const cards = new Map<string, GoalSourceGapCard>();
  const ensureCard = (id: string): GoalSourceGapCard => {
    const existing = cards.get(id);
    if (existing) return existing;
    const gap = gaps.get(id);
    const next = {
      affectedKpis: [],
      id,
      message: gap?.message || id,
      owner: gap?.owner || "source",
      path: gap?.sourceRef?.path,
    };
    cards.set(id, next);
    return next;
  };

  snapshot.tabs.goals.sourceGapIds.forEach((id) => {
    ensureCard(id);
  });
  snapshot.tabs.goals.axes.forEach((axis) => {
    axis.smartGoals.forEach((goal) => {
      goal.kpis.forEach((kpi) => {
        kpi.sourceGapIds.forEach((id) => {
          ensureCard(id).affectedKpis.push({
            goalId: goal.id,
            label: kpi.label,
            metricId: kpi.metricId,
          });
        });
      });
    });
  });

  return Array.from(cards.values());
}

export function GoalSourceGapsCard({
  gaps,
}: {
  gaps: GoalSourceGapCard[];
}): ReactElement | null {
  if (gaps.length === 0) return null;
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Goal Source Gaps
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {gaps.map((gap) => (
          <div key={gap.id} className="rounded-md border bg-muted/20 p-3">
            <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
              {displayGapMessage(gap)}
            </p>
            <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {gap.path ?? gap.owner}
            </p>
            {gap.affectedKpis.length > 0 ? (
              <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                SMART goal:{" "}
                {Array.from(new Set(gap.affectedKpis.map((kpi) => kpi.goalId))).join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
