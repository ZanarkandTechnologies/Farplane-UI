import { AlertTriangle, CheckCircle2, Gauge, ListChecks } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/store";
import type { FarplaneConfigFile, ProjectConfigLoadState } from "./config-types";

export function bulletLines(markdown: string, limit = 6): string[] {
  return markdown
    .split(/\r?\n/g)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function shortText(value: string, fallback: string, limit = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

export function statusBadge(file: FarplaneConfigFile | null): ReactElement {
  if (!file) return <Badge variant="destructive">provider_missing</Badge>;
  if (file.error) return <Badge variant="destructive">{file.error}</Badge>;
  return file.exists ? (
    <Badge variant="outline">loaded</Badge>
  ) : (
    <Badge variant="secondary">missing</Badge>
  );
}

export function sourceFreshness(updatedAtMs: number | null): string {
  if (!updatedAtMs) return "no file timestamp";
  const days = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 86_400_000));
  if (days === 0) return "updated today";
  if (days === 1) return "updated yesterday";
  return `updated ${days}d ago`;
}

export function ConfigLoadingState({
  state,
  error,
}: {
  state: ProjectConfigLoadState;
  error: string | null;
}): ReactElement | null {
  if (state === "loading") return <Badge variant="secondary">loading project config</Badge>;
  if (state === "error")
    return <Badge variant="destructive">{error ?? "config unavailable"}</Badge>;
  return null;
}

export function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="break-words text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function InlineStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function SparkBars({
  seed,
  active = false,
}: {
  seed: string;
  active?: boolean;
}): ReactElement {
  const code = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  const bars = [0, 1, 2, 3, 4, 5, 6, 7].map((offset) => ({
    key: `${seed}-${offset}`,
    height: 24 + ((code + offset * 17) % 54),
  }));
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden="true">
      {bars.map((bar) => (
        <span
          key={bar.key}
          className={
            active ? "w-2 rounded-sm bg-primary/70" : "w-2 rounded-sm bg-muted-foreground/25"
          }
          style={{ height: `${bar.height}%` }}
        />
      ))}
    </div>
  );
}

export function FileSourceRow({ file }: { file: FarplaneConfigFile }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{file.title}</p>
        <p className="truncate text-xs text-muted-foreground">{file.path}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary">{file.format}</Badge>
        {statusBadge(file)}
      </div>
    </div>
  );
}

export function useOpenSkillSurface(): (surface: "skill-os" | "evals" | "harness") => void {
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSkillStudioSurface = useAppStore((state) => state.setSkillStudioSurface);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  return (surface: "skill-os" | "evals" | "harness") => {
    setSelectedSkillStudioSkillId(null);
    setSkillStudioFocusAgentId(null);
    setSkillStudioSurface(surface);
    setIsSkillsPanelOpen(true);
  };
}

export { AlertTriangle, CheckCircle2, Gauge, ListChecks };
