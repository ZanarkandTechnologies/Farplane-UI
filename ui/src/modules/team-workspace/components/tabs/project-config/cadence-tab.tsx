import { Activity, CalendarClock, Link2 } from "lucide-react";
import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findConfigFile, getConfigSection, parseMarkdownTable } from "./config-parsing";
import type { FarplaneProjectConfig } from "./config-types";
import { InlineStat, statusBadge } from "./shared";

export function ProjectCadenceTab({
  config,
}: {
  config: FarplaneProjectConfig | null;
}): ReactElement {
  const automations = findConfigFile(config, "automations");
  const pm = findConfigFile(config, "pm");
  const pulse = parseMarkdownTable(getConfigSection(automations, "Pulse")).slice(1);
  const daily = parseMarkdownTable(getConfigSection(automations, "Daily Interval")).slice(1);
  const weekly = parseMarkdownTable(getConfigSection(automations, "Weekly Interval")).slice(1);
  const pmJson =
    pm?.parsedJson && typeof pm.parsedJson === "object"
      ? (pm.parsedJson as Record<string, unknown>)
      : {};
  const threads =
    pmJson.threads && typeof pmJson.threads === "object"
      ? (pmJson.threads as Record<string, unknown>)
      : {};
  const automationThreads = Array.isArray(threads.automations)
    ? threads.automations.map(String)
    : [];
  const sections = [
    { title: "Pulse", icon: <Activity className="h-4 w-4" />, rows: pulse },
    { title: "Daily Interval", icon: <CalendarClock className="h-4 w-4" />, rows: daily },
    { title: "Weekly Interval", icon: <CalendarClock className="h-4 w-4" />, rows: weekly },
  ];

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Cadence Console</h3>
          <div className="flex items-center gap-2">
            {statusBadge(automations)}
            {statusBadge(pm)}
          </div>
        </div>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4" />
              Project PM
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InlineStat
              label="PM"
              value={String(pmJson.name ?? "missing")}
              detail={String(pmJson.role ?? "role unavailable")}
            />
            <InlineStat
              label="Automation Threads"
              value={String(automationThreads.length)}
              detail={automationThreads[0] ?? "no PM thread linked"}
            />
            <InlineStat
              label="Runtime Reports"
              value={String(
                config?.runtimeSources.find((source) => source.id === "reports")?.childCount ?? 0,
              )}
              detail=".farplane/reports availability"
            />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.title} className="rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {section.icon}
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.rows.length > 0 ? (
                  section.rows.map((row) => (
                    <div
                      key={`${section.title}-${row[0]}`}
                      className="rounded-md border bg-muted/20 p-2"
                    >
                      <p className="text-xs font-medium text-muted-foreground">{row[0]}</p>
                      <p className="break-words text-sm">{row[1]}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No cadence table found.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
