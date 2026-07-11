import { Activity, CalendarClock } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { findProjectUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";
import { findConfigFile } from "./config-parsing";
import type { FarplaneProjectConfig } from "./config-types";
import { statusBadge } from "./shared";

type AutomationEntry = {
  id: string;
  title: string;
  name: string;
  kind: string;
  schedule: string;
  target: string;
  source: string;
  status: string;
};

export function ProjectAutomationsTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const automations = findConfigFile(config, "automations");
  const snapshot = findProjectUiSnapshot(config);
  const entries = useMemo(
    () =>
      (snapshot?.tabs.cadence.automations ?? []).map((automation) => ({
        id: automation.id,
        title: automation.name,
        name: automation.name,
        kind: automation.kind,
        schedule: "schedule not projected",
        target: automation.kind,
        source: automation.sourceRef?.path ?? ".farplane/project/ui/latest.json",
        status: automation.status,
      })),
    [snapshot],
  );
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;

  useEffect(() => {
    if (!entries.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(entries[0].id);
    }
  }, [entries, selectedId]);

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Automations</h3>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">
              farplane/automations.toml
            </span>
            {statusBadge(automations)}
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="grid min-h-[520px] min-w-0 grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-2">
              {entries.map((entry) => (
                <Button
                  key={entry.id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-auto w-full min-w-0 justify-start rounded-md border bg-card p-3 text-left hover:bg-muted/50",
                    selected?.id === entry.id && "border-primary/50 bg-muted/50",
                  )}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <AutomationListItem entry={entry} />
                </Button>
              ))}
            </div>

            <Card className="min-w-0 rounded-md">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{selected?.name}</CardTitle>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{selected?.id}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge variant="secondary">{selected?.kind}</Badge>
                    <Badge variant="outline">{selected?.status}</Badge>
                    <Badge variant="outline">{selected?.schedule}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selected?.source ? (
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="mb-2 text-sm font-medium">Projected kind</p>
                    <p className="text-sm text-muted-foreground">{selected.target}</p>
                    <p className="mt-3 text-xs text-muted-foreground">Source: {selected.source}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Schedule, prompt, and target details are not projected by the current
                      snapshot.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-sm text-muted-foreground">
                      No TOML config found for this automation.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="rounded-md">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                No automations are available in the project UI snapshot.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

export const ProjectCadenceTab = ProjectAutomationsTab;

function AutomationListItem({ entry }: { entry: AutomationEntry }): ReactElement {
  const Icon = entry.kind === "heartbeat" ? Activity : CalendarClock;
  return (
    <div className="flex w-full min-w-0 items-start gap-3 overflow-hidden">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold">{entry.title}</p>
          <Badge variant="secondary" className="shrink-0">
            {entry.kind}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{entry.schedule}</p>
        <p className="mt-2 truncate text-xs text-muted-foreground" title={entry.target}>
          {entry.target}
        </p>
      </div>
    </div>
  );
}
