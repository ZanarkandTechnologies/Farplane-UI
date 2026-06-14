"use client";

/**
 * SKILL INVOCATIONS PANEL
 * =======================
 * Ownership: Skill Invocations module.
 * Inputs: Convex skill invocation dashboard query.
 * Outputs: compact operator dashboard for skill-read telemetry.
 * Side effects: none beyond Convex subscriptions.
 * Invariants: only compact invocation metadata is rendered.
 */

import { useQuery } from "convex/react";
import { Activity, BookOpen, Clock, Terminal } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { api } from "../../../../convex/_generated/api";
import {
  compactSkillPath,
  formatInvocationTime,
  type SkillInvocationDashboard,
} from "./skill-invocations-types";

type SkillInvocationsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RangeDays = 7 | 30 | 90;

const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function MetricTile(props: {
  icon: ReactElement;
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{props.value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{props.detail}</div>
    </div>
  );
}

function StatePanel(props: { title: string; detail: string }): ReactElement {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center">
      <div className="max-w-md rounded-md border bg-card px-5 py-4 text-center">
        <div className="text-sm font-semibold">{props.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{props.detail}</div>
      </div>
    </div>
  );
}

export function SkillInvocationsPanel({
  open,
  onOpenChange,
}: SkillInvocationsPanelProps): ReactElement {
  const { isPublic } = useOfficeAccessMode();
  const convexEnabled = isConvexEnabled();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const queryArgs = useMemo(() => ({ rangeDays, limit: 60 }), [rangeDays]);
  const data = useQuery(
    api.modules.skillInvocations.queries.getSkillInvocationDashboard,
    convexEnabled && open ? queryArgs : "skip",
  ) as SkillInvocationDashboard | undefined;

  const content = (() => {
    if (!convexEnabled) {
      return (
        <StatePanel
          title="Skill telemetry unavailable"
          detail="Convex is not configured for this UI session."
        />
      );
    }
    if (data === undefined) {
      return <StatePanel title="Loading skill reads" detail="Reading invocation telemetry..." />;
    }
    if (data.totals.invocationCount === 0) {
      return (
        <StatePanel
          title="No skill reads yet"
          detail="Install and trust the Codex hook, then read a SKILL.md file."
        />
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile
            icon={<Activity className="size-4" />}
            label="Invocations"
            value={String(data.totals.invocationCount)}
            detail={`${rangeDays} day window`}
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
            <div className="max-h-[48vh] overflow-auto">
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
              {!isPublic ? <Badge variant="outline">Read skill MD</Badge> : null}
            </div>
            <div className="max-h-[48vh] overflow-auto">
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
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{row.sourceTool}</Badge>
                    {row.sessionId ? <Badge variant="secondary">{row.sessionId}</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] min-w-[82vw] max-w-none flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle>Skill Invocations</DialogTitle>
            <Select
              value={String(rangeDays)}
              onValueChange={(value) => setRangeDays(Number(value) as RangeDays)}
            >
              <SelectTrigger size="sm" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
