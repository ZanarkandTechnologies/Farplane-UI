"use client";

/**
 * Overview section cards.
 * Keeps tab orchestration separate from repeated card markup and loading states.
 */

import { AlertTriangle, Flag, Gauge, Loader2, Target } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalCard } from "./overview-cards";

export type OverviewPinnedSignal = {
  label: string;
  value: string;
  description?: string;
  detail: string;
  target: string;
  provider: string;
};

export type OverviewAttentionSignal = {
  id: string;
  label: string;
  detail: string;
};

export function OverviewPinnedSignals({
  loading,
  onRefresh,
  projectionBadge,
  projectionReady,
  signals,
}: {
  loading: boolean;
  onRefresh: () => void;
  projectionBadge: string;
  projectionReady: boolean;
  signals: OverviewPinnedSignal[];
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4" />
            Pinned Signals
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant={projectionReady ? "outline" : "secondary"}>{projectionBadge}</Badge>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ProjectionLoadingState label="Loading pinned signals..." />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {signals.slice(0, 4).map((signal) => (
              <SignalCard
                key={signal.label}
                label={signal.label}
                value={signal.value}
                description={signal.description}
                detail={signal.detail}
                target={signal.target}
                provider={signal.provider}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewAttentionCard({
  items,
  loading,
  projectionBadge,
  projectionReady,
}: {
  items: OverviewAttentionSignal[];
  loading: boolean;
  projectionBadge: string;
  projectionReady: boolean;
}): ReactElement | null {
  if (!loading && items.length === 0) return null;
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention
          </CardTitle>
          <Badge variant={projectionReady ? "outline" : "secondary"}>{projectionBadge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <ProjectionLoadingState label="Loading overview signals..." />
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-md border bg-muted/20 p-3">
                <p className="break-words text-xs font-medium [overflow-wrap:anywhere]">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewCeoSummary({
  configBadge,
  currentBet,
  evalsFileExists,
  goalsFileExists,
  harnessFileExists,
  hasBusinessConfig,
  mission,
  northStar,
  principles,
  projectStatus,
  projectConfigReady,
}: {
  configBadge: string;
  currentBet: string;
  evalsFileExists: boolean;
  goalsFileExists: boolean;
  harnessFileExists: boolean;
  hasBusinessConfig: boolean;
  mission: string;
  northStar: string;
  principles: string[];
  projectStatus: string;
  projectConfigReady: boolean;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4" />
            Team Focus
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasBusinessConfig ? (
              <Badge variant="outline">Business configured</Badge>
            ) : (
              <Badge variant="secondary">Builder mode</Badge>
            )}
            <Badge variant="secondary">{projectStatus}</Badge>
            <Badge variant={projectConfigReady ? "outline" : "secondary"}>{configBadge}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              Current Focus
            </p>
          </div>
          <p className="text-base font-medium leading-6">{northStar}</p>
          <div className="rounded-md border bg-background/50 p-3">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                Current Bet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{currentBet}</p>
          </div>
        </div>
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              Active Milestone
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{mission}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={harnessFileExists ? "outline" : "secondary"}>snapshot</Badge>
            <Badge variant={goalsFileExists ? "outline" : "secondary"}>goals</Badge>
            <Badge variant={evalsFileExists ? "outline" : "secondary"}>products</Badge>
          </div>
          {principles.length > 0 ? (
            <div className="space-y-1">
              {principles.map((principle) => (
                <p key={principle} className="text-xs text-muted-foreground">
                  - {principle}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectScopeCard({
  projects,
  selectedProjectId,
  setSelectedProjectId,
}: {
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string;
  setSelectedProjectId: (id: string | null) => void;
}): ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Project Scope</CardTitle>
      </CardHeader>
      <CardContent>
        <select
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value || null)}
        >
          {projects.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}

function ProjectionLoadingState({ label }: { label: string }): ReactElement {
  return (
    <div className="flex min-h-[7rem] items-center justify-center rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
