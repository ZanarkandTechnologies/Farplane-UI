import { Activity, CalendarClock } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
};

export function ProjectAutomationsTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const automations = findConfigFile(config, "automations");
  const entries = useMemo(() => parseAutomationEntries(automations?.content ?? ""), [automations]);
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
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {selected?.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge variant="secondary">{selected?.kind}</Badge>
                    <Badge variant="outline">{selected?.schedule}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selected?.source ? (
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="mb-2 text-sm font-medium">Automation config</p>
                    <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                      {selected.source}
                    </pre>
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
                No automation configs found in farplane/automations.toml.
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

function parseAutomationEntries(toml: string): AutomationEntry[] {
  return splitAutomationBlocks(toml).map((block) => {
    const config = parseAutomationTomlConfig(block);
    const source = `[[automations]]\n${block.trim()}`;
      return {
        id: config.id ?? config.name ?? "automation",
        title: config.name ?? config.id ?? "Automation",
        name: config.name ?? config.id ?? "Automation",
        kind: config.kind ?? "kind missing",
        schedule: humanizeRrule(config.rrule ?? "", config),
        target: config.targetThread ?? config.workspace ?? "target missing",
        source,
      };
    });
}

function splitAutomationBlocks(toml: string): string[] {
  return toml
    .split(/^\s*\[\[automations\]\]\s*$/m)
    .slice(1)
    .map((block) => block.trim())
    .filter(Boolean);
}

type AutomationTomlConfig = {
  id?: string;
  name?: string;
  kind?: string;
  rrule?: string;
  targetThread?: string;
  workspace?: string;
  intervalMinutes?: string;
  scheduleType?: string;
  timezone?: string;
  time?: string;
  days?: string;
};

function parseAutomationTomlConfig(toml: string): AutomationTomlConfig {
  const readString = (key: string): string | undefined =>
    toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"))?.[1]?.trim();
  const readNumber = (key: string): string | undefined =>
    toml.match(new RegExp(`^${key}\\s*=\\s*(\\d+)`, "m"))?.[1]?.trim();
  const readArray = (key: string): string | undefined =>
    toml.match(new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m"))?.[1]?.replace(/"/g, "").trim();
  return {
    id: readString("id"),
    name: readString("name"),
    kind: readString("kind"),
    rrule: readString("rrule"),
    targetThread: readString("thread_id") ?? readString("target_thread"),
    workspace: readString("workspace"),
    intervalMinutes: readNumber("interval_minutes"),
    scheduleType: readString("type"),
    timezone: readString("timezone"),
    time: readString("time"),
    days: readArray("days"),
  };
}

function humanizeRrule(rrule: string, config?: AutomationTomlConfig): string {
  if (!rrule && config?.scheduleType) return humanizeScheduleConfig(config);
  if (!rrule) return "schedule missing";
  const interval = rrule.match(/INTERVAL=(\d+)/)?.[1];
  if (rrule.includes("FREQ=MINUTELY")) return interval ? `every ${interval}m` : "minutely";
  const hour = rrule.match(/BYHOUR=(\d+)/)?.[1]?.padStart(2, "0");
  const minute = rrule.match(/BYMINUTE=(\d+)/)?.[1]?.padStart(2, "0");
  const time = hour && minute ? `${hour}:${minute}` : "time unavailable";
  if (rrule.includes("FREQ=DAILY")) return `daily ${time}`;
  if (rrule.includes("FREQ=WEEKLY")) {
    const day = rrule.match(/BYDAY=([^;]+)/)?.[1] ?? "weekly";
    return `${day} ${time}`;
  }
  return rrule;
}

function humanizeScheduleConfig(config: AutomationTomlConfig): string {
  if (config.scheduleType === "interval" && config.intervalMinutes) {
    return `every ${config.intervalMinutes}m`;
  }
  if (config.scheduleType === "active_hours_interval" && config.intervalMinutes) {
    return `active hours every ${config.intervalMinutes}m`;
  }
  if (config.scheduleType === "daily" && config.time) return `daily ${config.time}`;
  if (config.scheduleType === "weekly" && config.time) {
    const days = config.days ? `${config.days} ` : "";
    return `${days}${config.time}`;
  }
  if (config.scheduleType === "monthly" && config.time) return `monthly ${config.time}`;
  return config.scheduleType ?? "schedule missing";
}
