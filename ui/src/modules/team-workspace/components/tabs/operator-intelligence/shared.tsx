import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PanelTask } from "../../team-panel-types";
import type { MetricCard } from "./types";

export function getSkillSourceKind(sourcePath: string | undefined): "local" | "repo" | "global" {
  const normalized = sourcePath ?? "";
  if (normalized.includes(".codex/skills")) return "local";
  if (normalized.startsWith("skills/")) return "repo";
  return "global";
}

export function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const keep = Math.max(4, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

export function taskStatusCount(tasks: PanelTask[], status: PanelTask["status"]): number {
  return tasks.filter((task) => task.status === status).length;
}

export function metricCards(cards: MetricCard[]): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 rounded-md py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-2xl font-semibold tabular-nums">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactElement;
  children: ReactElement;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
