"use client";

/**
 * OPERATOR INTELLIGENCE TABS
 * ==========================
 * Ownership: Team Workspace module.
 * Inputs: current project, company tasks, project memory Markdown, and Team Panel scope.
 * Outputs: quick-pass Team Panel views for goals, docs, skills, evals, automations, guard, and hardcases.
 * Side effects: none. These shells intentionally reuse current local data instead of adding backend state.
 */

import {
  BookOpen,
  CalendarClock,
  FileText,
  Goal,
  ListChecks,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CompanyModel, ProjectModel } from "@/modules/runtime";
import { useAppStore } from "@/store";
import type { PanelTask, TeamMemoryRow } from "./team-panel-types";

type IntelligenceTabProps = {
  project: ProjectModel | null;
  companyModel: CompanyModel | null;
  projectTasks: PanelTask[];
  memoryRows: TeamMemoryRow[];
  globalMode: boolean;
};

type MetricCard = {
  label: string;
  value: string;
  detail: string;
};

type SkillCatalogRow = {
  skillId: string;
  displayName?: string;
  description?: string;
  category?: string;
  sourcePath?: string;
  hasManifest?: boolean;
  hasTests?: boolean;
  hasDiagram?: boolean;
  hasSkillMemory?: boolean;
};

function getSkillSourceKind(sourcePath: string | undefined): "local" | "repo" | "global" {
  const normalized = sourcePath ?? "";
  if (normalized.includes(".codex/skills")) return "local";
  if (normalized.startsWith("skills/")) return "repo";
  return "global";
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const keep = Math.max(4, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function taskStatusCount(tasks: PanelTask[], status: PanelTask["status"]): number {
  return tasks.filter((task) => task.status === status).length;
}

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

export function GoalsTab({
  project,
  companyModel,
  projectTasks,
  memoryRows,
  globalMode,
}: IntelligenceTabProps): ReactElement {
  const history = findMemoryByName(memoryRows, "HISTORY.md");
  const activeProjects = companyModel?.projects.filter((entry) => entry.status === "active") ?? [];
  const blockedTasks = taskStatusCount(projectTasks, "blocked");
  const openTasks = projectTasks.filter((task) => task.status !== "done");

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          {
            label: "Active projects",
            value: String(globalMode ? activeProjects.length : project ? 1 : 0),
            detail: globalMode ? "company rollup" : project?.name ?? "no selected project",
          },
          {
            label: "Open work",
            value: String(openTasks.length),
            detail: `${blockedTasks} blocked`,
          },
          {
            label: "KPIs",
            value: String(project?.kpis?.length ?? 0),
            detail: "current phase signals",
          },
          {
            label: "Phase target",
            value: project?.status ?? "unset",
            detail: "project status proxy",
          },
        ])}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SectionCard title="Roadmap" icon={<Goal className="h-4 w-4 text-primary" />}>
            <div className="space-y-3 text-sm">
              <p className="rounded-md border bg-muted/20 p-3">
                {project?.goal?.trim() ||
                  "No explicit goal is set yet. This view is ready to render the roadmap once the project goal files are populated."}
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                {["Now", "Next phase", "Quarter target"].map((label) => (
                  <div key={label} className="rounded-md border p-3">
                    <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm">
                      {label === "Now"
                        ? openTasks[0]?.title || "Define active project target"
                        : "Ready for planning"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Event Timeline"
            icon={<CalendarClock className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-2 text-sm">
              {history ? (
                <Response className="prose prose-sm max-w-none dark:prose-invert line-clamp-[14]">
                  {history.body}
                </Response>
              ) : (
                <p className="text-muted-foreground">
                  HISTORY.md was not loaded for this project yet. The timeline tab still shows live
                  activity; this Goals view will render durable event history when available.
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="KPIs And Active Work" icon={<ListChecks className="h-4 w-4 text-primary" />}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(project?.kpis ?? []).map((kpi) => (
                <Badge key={kpi} variant="outline">
                  {kpi}
                </Badge>
              ))}
              {(project?.kpis ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground">No KPI rows yet.</span>
              ) : null}
            </div>
            <div className="grid gap-2">
              {openTasks.slice(0, 6).map((task) => (
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
              {openTasks.length === 0 ? (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No open work found for this scope.
                </p>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}

export function DocsTab({ project, memoryRows }: IntelligenceTabProps): ReactElement {
  const docs = memoryRows.length > 0 ? memoryRows : [];
  const activeDoc = docs[0] ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-full rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            Files / Docs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3">
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>Project: {project?.name ?? "none"}</p>
            <p className="break-all">Path: {project?.trackingContext ?? "not set"}</p>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.title ?? doc.sourcePath ?? doc.id}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {doc.sourcePath ?? "memory source"}
                  </p>
                </div>
              ))}
              {docs.length === 0 ? (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No docs loaded yet. Generated files will appear here when project memory indexes
                  them.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="h-full rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{activeDoc?.title ?? "Project Docs Preview"}</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-3rem)] min-h-0">
          <ScrollArea className="h-full rounded-md border p-4">
            {activeDoc ? (
              <Response className="prose prose-sm max-w-none dark:prose-invert">
                {activeDoc.body}
              </Response>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a project memory/doc source after files load.
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function SkillsReadinessTab({ project, projectTasks }: IntelligenceTabProps): ReactElement {
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const [catalog, setCatalog] = useState<SkillCatalogRow[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const proofTasks = projectTasks.filter((task) =>
    `${task.title} ${task.notes ?? ""}`.toLowerCase().includes("skill"),
  );
  const openGlobalSkills = (skillId?: string): void => {
    setSelectedSkillStudioSkillId(skillId ?? null);
    setSkillStudioFocusAgentId(null);
    setIsSkillsPanelOpen(true);
  };
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog(): Promise<void> {
      setLoadState("loading");
      try {
        const response = await fetch("/openclaw/skills/catalog");
        if (!response.ok) throw new Error(`skills_catalog_${response.status}`);
        const payload = (await response.json()) as { skills?: SkillCatalogRow[] };
        if (cancelled) return;
        const nextCatalog = (payload.skills ?? []).sort((a, b) =>
          a.skillId.localeCompare(b.skillId),
        );
        setCatalog(nextCatalog);
        setSelectedSkillId((current) => current ?? nextCatalog[0]?.skillId ?? null);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);
  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter((row) =>
      `${row.skillId} ${row.displayName ?? ""} ${row.description ?? ""} ${row.category ?? ""} ${row.sourcePath ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [catalog, search]);
  const selectedSkill =
    catalog.find((row) => row.skillId === selectedSkillId) ?? filteredCatalog[0] ?? null;
  const localCount = catalog.filter((row) => getSkillSourceKind(row.sourcePath) === "local").length;
  const repoCount = catalog.filter((row) => getSkillSourceKind(row.sourcePath) === "repo").length;

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          { label: "Catalog skills", value: String(catalog.length), detail: loadState },
          {
            label: "Local / repo",
            value: `${localCount}/${repoCount}`,
            detail: "override and project packages",
          },
          { label: "Skill tasks", value: String(proofTasks.length), detail: "local work evidence" },
          {
            label: "Project",
            value: truncateMiddle(project?.name ?? "global", 18),
            detail: "team entrypoint scope",
          },
        ])}
        <SectionCard title="Skill Graph" icon={<Workflow className="h-4 w-4 text-primary" />}>
          <div className="grid min-h-[44rem] gap-3 text-sm xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <div className="flex min-h-0 flex-col rounded-md border">
              <div className="border-b p-3">
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search skills"
                />
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-1 p-2">
                  {filteredCatalog.map((row) => (
                    <button
                      key={row.skillId}
                      type="button"
                      onClick={() => setSelectedSkillId(row.skillId)}
                      className={`block w-full rounded-md border px-3 py-2 text-left transition ${
                        selectedSkill?.skillId === row.skillId
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{row.displayName ?? row.skillId}</span>
                        <Badge variant="outline">{getSkillSourceKind(row.sourcePath)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {row.description || row.sourcePath || row.skillId}
                      </p>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 ? (
                    <p className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                      No skills match this search.
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="min-h-[44rem] overflow-hidden rounded-md border bg-background">
              <iframe
                title="Skill maintenance graph"
                src="/codex/skill-maintenance-graph/index.html"
                className="h-[44rem] w-full border-0"
              />
            </div>

            <div className="rounded-md border p-4">
              {selectedSkill ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 text-lg font-semibold">
                        {selectedSkill.displayName ?? selectedSkill.skillId}
                      </h3>
                      <Badge>{getSkillSourceKind(selectedSkill.sourcePath)}</Badge>
                      {selectedSkill.hasTests ? <Badge variant="outline">tests</Badge> : null}
                      {selectedSkill.hasDiagram ? <Badge variant="outline">diagram</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedSkill.description || "No description provided."}
                    </p>
                    <p className="mt-3 break-all rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                      {selectedSkill.sourcePath || "source path unavailable"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Category</p>
                      <p className="mt-1 truncate">{selectedSkill.category ?? "workflow"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Memory</p>
                      <p className="mt-1">{selectedSkill.hasSkillMemory ? "yes" : "no"}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => openGlobalSkills(selectedSkill.skillId)}>
                    Open Full Skill
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {loadState === "error"
                    ? "Skill catalog failed to load from the local bridge."
                    : "Loading skill catalog..."}
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}

export { AutomationsTab, EvalsQaTab, GuardTab, HardcasesTab } from "./operator-intelligence-secondary-tabs";
