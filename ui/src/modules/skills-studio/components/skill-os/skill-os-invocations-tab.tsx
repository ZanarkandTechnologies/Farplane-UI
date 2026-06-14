"use client";

import { Activity, BookOpen, Clock, Terminal } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import {
  compactSkillPath,
  formatInvocationTime,
} from "../../../skill-invocations/skill-invocations-types";
import type { SkillInvocationCountState } from "./use-skill-invocation-counts";

function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  detail: string;
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

export function SkillOsInvocationsTab({
  invocationState,
}: {
  invocationState: SkillInvocationCountState;
}): ReactElement {
  if (!invocationState.available) {
    return (
      <div className="grid h-full place-items-center rounded-md border border-dashed p-6 text-center">
        <div>
          <div className="text-sm font-semibold">Invocation telemetry unavailable</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Convex is not configured for this UI session.
          </div>
        </div>
      </div>
    );
  }
  if (invocationState.loading || !invocationState.data) {
    return (
      <div className="grid h-full place-items-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Loading skill invocation telemetry...
      </div>
    );
  }

  const { data } = invocationState;
  if (data.totals.invocationCount === 0) {
    return (
      <div className="grid h-full place-items-center rounded-md border border-dashed p-6 text-center">
        <div>
          <div className="text-sm font-semibold">No skill reads yet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Install and trust the Codex hook, then read a SKILL.md file.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile
          icon={<Activity className="size-4" />}
          label="Invocations"
          value={String(data.totals.invocationCount)}
          detail="30 day window"
        />
        <MetricTile
          icon={<BookOpen className="size-4" />}
          label="Skills"
          value={String(data.totals.skillCount)}
          detail="Unique parent folders"
        />
        <MetricTile
          icon={<Terminal className="size-4" />}
          label="Tools"
          value={String(data.totals.sourceToolCount)}
          detail="Source tool names"
        />
        <MetricTile
          icon={<Clock className="size-4" />}
          label="Last Seen"
          value={formatInvocationTime(data.totals.lastSeenAt)}
          detail="Most recent SKILL.md read"
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="min-h-0 rounded-md border bg-card">
          <div className="border-b px-4 py-3 text-sm font-semibold">Top Skills</div>
          <div className="max-h-[52vh] overflow-auto">
            {data.bySkill.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    Last {formatInvocationTime(row.lastSeenAt)}
                  </div>
                </div>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-0 rounded-md border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="text-sm font-semibold">Recent Reads</div>
            <Badge variant="outline">Read skill MD</Badge>
          </div>
          <div className="max-h-[52vh] overflow-auto">
            {data.recentEvents.map((row) => (
              <div
                key={row._id ?? row.stepKey ?? `${row.skillId}:${row.occurredAt}`}
                className="grid gap-2 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="truncate text-sm font-medium">{row.skillId}</div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatInvocationTime(row.occurredAt)}
                  </div>
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {compactSkillPath(row.skillPath)}
                </div>
                <Badge variant="outline" className="w-fit">
                  {row.sourceTool}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
