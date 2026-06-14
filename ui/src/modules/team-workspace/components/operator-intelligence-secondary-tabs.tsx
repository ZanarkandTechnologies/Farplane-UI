"use client";

/**
 * OPERATOR INTELLIGENCE SECONDARY TABS
 * ====================================
 * Ownership: Team Workspace module.
 * Inputs: project tasks and memory rows.
 * Outputs: advisory shells for automations, guard, and hardcase surfaces.
 * Side effects: none.
 */

import { AlertTriangle, BadgeCheck, CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CompanyModel, ProjectModel } from "@/modules/runtime";
import type { PanelTask, TeamMemoryRow } from "./team-panel-types";

type MetricCard = {
  label: string;
  value: string;
  detail: string;
};

type IntelligenceTabProps = {
  project?: ProjectModel | null;
  companyModel?: CompanyModel | null;
  projectTasks: PanelTask[];
  memoryRows: TeamMemoryRow[];
  globalMode?: boolean;
};

function findMemoryByName(rows: TeamMemoryRow[], name: string): TeamMemoryRow | null {
  const lowerName = name.toLowerCase();
  return (
    rows.find((row) => row.sourcePath?.toLowerCase().endsWith(lowerName)) ??
    rows.find((row) => row.title?.toLowerCase().includes(lowerName.replace(".md", ""))) ??
    null
  );
}

function metricCards(cards: MetricCard[]): ReactElement {
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

function SectionCard({
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

export function AutomationsTab(): ReactElement {
  return (
    <QuickStateTab
      icon={<CalendarClock className="h-4 w-4 text-primary" />}
      title="Automations"
      cards={[
        { label: "Active", value: "0", detail: "source not exposed in browser" },
        { label: "Due soon", value: "0", detail: "waiting on Codex automation adapter" },
        { label: "Failing", value: "0", detail: "no local rows" },
        { label: "State", value: "unavailable", detail: "honest first-pass state" },
      ]}
      body="Codex automation state appears tool-backed rather than repo-backed in this UI session. This tab intentionally renders a source-unavailable state instead of inventing fake schedules."
    />
  );
}

export function EvalsQaTab({ projectTasks }: IntelligenceTabProps): ReactElement {
  const evalTasks = projectTasks.filter((task) => {
    const text = `${task.title} ${task.notes ?? ""}`.toLowerCase();
    return text.includes("eval") || text.includes("qa") || text.includes("proof");
  });
  const failing = evalTasks.filter((task) => task.status === "blocked" || task.status === "review");

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          { label: "Proof rows", value: String(evalTasks.length), detail: "eval/QA related work" },
          { label: "Needs attention", value: String(failing.length), detail: "blocked or review" },
          { label: "Hardcase candidates", value: String(failing.length), detail: "sellable-data filter source" },
          { label: "Source UI", value: "reuse", detail: "eval viewer pattern" },
        ])}
        <SectionCard title="Eval / QA Evidence" icon={<BadgeCheck className="h-4 w-4 text-primary" />}>
          <div className="grid gap-2">
            {evalTasks.slice(0, 8).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <span className="min-w-0 truncate">{task.title}</span>
                <Badge variant={task.status === "blocked" ? "destructive" : "secondary"}>
                  {task.status}
                </Badge>
              </div>
            ))}
            {evalTasks.length === 0 ? (
              <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No eval/QA task rows found for this scope yet. The first-pass shell is ready for
                the eval viewer data adapter.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}

export function GuardTab({ projectTasks, memoryRows }: IntelligenceTabProps): ReactElement {
  const blocked = projectTasks.filter((task) => task.status === "blocked");
  const trouble = findMemoryByName(memoryRows, "TROUBLES.md");
  return (
    <QuickStateTab
      icon={<ShieldCheck className="h-4 w-4 text-primary" />}
      title="Mighty Guard"
      cards={[
        { label: "Critical", value: String(blocked.length), detail: "blocked work proxy" },
        { label: "Warnings", value: trouble ? "1" : "0", detail: "trouble memory source" },
        {
          label: "Missing proof",
          value: String(projectTasks.filter((task) => task.status === "review").length),
          detail: "review queue proxy",
        },
        { label: "Mode", value: "advisory", detail: "no auto-repair" },
      ]}
      body="Mighty Guard is intentionally advisory in this pass. It surfaces blockers, trouble memory, and missing proof signals without claiming enforcement semantics."
    />
  );
}

export function HardcasesTab({ projectTasks, memoryRows }: IntelligenceTabProps): ReactElement {
  const candidates = projectTasks.filter((task) => {
    const text = `${task.title} ${task.notes ?? ""}`.toLowerCase();
    return task.status === "blocked" || text.includes("eval") || text.includes("qa") || text.includes("trouble");
  });
  const troubles = findMemoryByName(memoryRows, "TROUBLES.md");
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          {
            label: "Cases",
            value: String(candidates.length + (troubles ? 1 : 0)),
            detail: "eval/QA/trouble candidates",
          },
          { label: "Ready", value: "0", detail: "redaction not reviewed" },
          { label: "Needs redaction", value: String(candidates.length), detail: "safe default" },
          { label: "Export", value: "blocked", detail: "policy gate" },
        ])}
        <SectionCard title="Sellability Filter" icon={<Sparkles className="h-4 w-4 text-primary" />}>
          <div className="space-y-2">
            {candidates.slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{task.title}</span>
                  <Badge variant="outline">{task.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Export disabled until redaction/provenance policy exists.
                </p>
              </div>
            ))}
            {candidates.length === 0 ? (
              <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                No hardcase candidates found yet.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}

function QuickStateTab({
  icon,
  title,
  cards,
  body,
}: {
  icon: ReactElement;
  title: string;
  cards: MetricCard[];
  body: string;
}): ReactElement {
  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards(cards)}
        <SectionCard title={title} icon={icon}>
          <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">{body}</p>
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}
