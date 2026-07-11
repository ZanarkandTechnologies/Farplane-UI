import { FileCog } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectModel } from "@/modules/runtime";
import { useAppStore } from "@/store";
import { findConfigFile, getConfigSection, getConfigStringList } from "./config-parsing";
import type { FarplaneProjectConfig } from "./config-types";
import {
  AlertTriangle,
  bulletLines,
  CheckCircle2,
  FileSourceRow,
  Gauge,
  ListChecks,
  MetricTile,
  sourceFreshness,
  statusBadge,
  useOpenSkillSurface,
} from "./shared";

export function ProjectConfigTab({
  config,
  project,
  teamScopeId,
  convexEnabled,
  hasBusinessConfig,
}: {
  config: FarplaneProjectConfig | null;
  project: ProjectModel | null;
  teamScopeId: string | null;
  convexEnabled: boolean;
  hasBusinessConfig: boolean;
}): ReactElement {
  const setIsTelemetryPanelOpen = useAppStore((state) => state.setIsTelemetryPanelOpen);
  const harness = findConfigFile(config, "harness");
  const hooks = findConfigFile(config, "hooks");
  const manifest = findConfigFile(config, "manifest");
  const principles =
    getConfigStringList(harness, ["operating_principles"]).length > 0
      ? getConfigStringList(harness, ["operating_principles"])
      : bulletLines(getConfigSection(harness, "Operating Principles"));
  const nonTradeoffs =
    getConfigStringList(harness, ["constraints", "non_tradeoffs"]).length > 0
      ? getConfigStringList(harness, ["constraints", "non_tradeoffs"])
      : bulletLines(getConfigSection(harness, "Non-Tradeoffs"));
  const openSkillSurface = useOpenSkillSurface();

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricTile
            label="Project"
            value={project?.name ?? "unmapped"}
            detail={config?.projectPath ?? project?.trackingContext ?? "path unavailable"}
          />
          <MetricTile
            label="Config Files"
            value={String(config?.files.filter((file) => file.exists).length ?? 0)}
            detail="loaded Farplane files"
          />
          <MetricTile
            label="Team Scope"
            value={teamScopeId ?? "global"}
            detail={convexEnabled ? "Convex board connected" : "local board fallback"}
          />
          <MetricTile
            label="Business"
            value={hasBusinessConfig ? "ready" : "builder"}
            detail="business config source state"
          />
        </div>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileCog className="h-4 w-4" />
              Manifest and Harness Config
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {statusBadge(manifest)}
                {statusBadge(hooks)}
              </div>
              {(config?.files ?? []).map((file) => (
                <FileSourceRow key={file.path} file={file} />
              ))}
            </div>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Operating Principles
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {principles.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Non-Tradeoffs
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {nonTradeoffs.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openSkillSurface("harness")}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Harness
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSkillSurface("skill-os")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Skills
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSkillSurface("evals")}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Evals
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsTelemetryPanelOpen(true)}>
                  <Gauge className="mr-2 h-4 w-4" />
                  Telemetry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Runtime Sources</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {(config?.runtimeSources ?? []).map((source) => (
              <div key={source.id} className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{source.label}</p>
                  <Badge variant={source.exists ? "outline" : "secondary"}>
                    {source.exists ? "available" : "missing"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{source.path}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {sourceFreshness(source.updatedAtMs)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
