import { FolderGit2 } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSkillSourceKind, metricCards, SectionCard, truncateMiddle } from "./shared";
import type { IntelligenceTabProps, SkillCatalogRow } from "./types";

type SkillDetailPayload = {
  skill?: {
    overviewMarkdown?: string;
    sourcePath?: string;
  };
};

export function SkillsReadinessTab({ project, projectTasks }: IntelligenceTabProps): ReactElement {
  const [catalog, setCatalog] = useState<SkillCatalogRow[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState("");
  const [search, setSearch] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const proofTasks = projectTasks.filter((task) =>
    `${task.title} ${task.notes ?? ""}`.toLowerCase().includes("skill"),
  );
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
        setSelectedSkillId(
          (current) =>
            current ??
            nextCatalog.find((row) => getSkillSourceKind(row.sourcePath) === "project")
              ?.skillId ??
            null,
        );
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
    const projectSkills = catalog.filter((row) => getSkillSourceKind(row.sourcePath) === "project");
    if (!query) return projectSkills;
    return projectSkills.filter((row) =>
      `${row.skillId} ${row.displayName ?? ""} ${row.description ?? ""} ${row.category ?? ""} ${row.sourcePath ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [catalog, search]);
  const selectedSkill =
    filteredCatalog.find((row) => row.skillId === selectedSkillId) ?? filteredCatalog[0] ?? null;
  const projectSkills = useMemo(
    () => catalog.filter((row) => getSkillSourceKind(row.sourcePath) === "project"),
    [catalog],
  );
  const testedCount = projectSkills.filter((row) => row.hasTests).length;
  const diagramCount = projectSkills.filter((row) => row.hasDiagram).length;

  useEffect(() => {
    let cancelled = false;
    async function loadSelectedSkill(): Promise<void> {
      if (!selectedSkill?.skillId) {
        setSelectedMarkdown("");
        setDetailState("idle");
        return;
      }
      setDetailState("loading");
      try {
        const response = await fetch(`/openclaw/skills/${encodeURIComponent(selectedSkill.skillId)}`);
        if (!response.ok) throw new Error(`skill_detail_${response.status}`);
        const payload = (await response.json()) as SkillDetailPayload;
        if (cancelled) return;
        setSelectedMarkdown(payload.skill?.overviewMarkdown ?? "");
        setDetailState("ready");
      } catch {
        if (!cancelled) {
          setSelectedMarkdown("");
          setDetailState("error");
        }
      }
    }
    void loadSelectedSkill();
    return () => {
      cancelled = true;
    };
  }, [selectedSkill?.skillId]);

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        {metricCards([
          {
            label: "Project skills",
            value: String(projectSkills.length),
            detail: loadState,
          },
          { label: "With tests", value: String(testedCount), detail: "local proof hooks" },
          { label: "With diagrams", value: String(diagramCount), detail: "visual docs" },
          { label: "Skill tasks", value: String(proofTasks.length), detail: "local work evidence" },
        ])}
        <SectionCard
          title="Project Skill Sources"
          icon={<FolderGit2 className="h-4 w-4 text-primary" />}
        >
          <div className="grid min-h-[34rem] gap-3 text-sm xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
            <div className="flex min-h-0 flex-col rounded-md border">
              <div className="flex items-center gap-2 border-b p-3">
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search project skills"
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
                        <span className="min-w-0 truncate font-medium">
                          {row.displayName ?? row.skillId}
                        </span>
                        <Badge variant="outline">project</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {row.description || row.sourcePath || row.skillId}
                      </p>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 ? (
                    <p className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                      {loadState === "error"
                        ? "Project skill catalog failed to load."
                        : "No project skills from .agents/skills match this view."}
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="min-h-0 overflow-hidden rounded-md border">
              {selectedSkill ? (
                <div className="flex h-full min-h-[34rem] flex-col">
                  <div className="border-b p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 text-lg font-semibold">
                        {selectedSkill.displayName ?? selectedSkill.skillId}
                      </h3>
                      <Badge>project</Badge>
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
                  <div className="grid grid-cols-2 gap-2 border-b p-4">
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Category</p>
                      <p className="mt-1 truncate">{selectedSkill.category ?? "workflow"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Memory</p>
                      <p className="mt-1">{selectedSkill.hasSkillMemory ? "yes" : "no"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Source</p>
                      <p className="mt-1 truncate">.agents/skills</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Project</p>
                      <p className="mt-1 truncate">
                        {truncateMiddle(project?.name ?? "global", 24)}
                      </p>
                    </div>
                  </div>
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="p-4">
                      {detailState === "loading" ? (
                        <p className="text-sm text-muted-foreground">Loading SKILL.md...</p>
                      ) : detailState === "error" ? (
                        <p className="text-sm text-destructive">SKILL.md failed to load.</p>
                      ) : selectedMarkdown.trim() ? (
                        <Response className="prose prose-sm max-w-none dark:prose-invert text-sm">
                          {selectedMarkdown}
                        </Response>
                      ) : (
                        <p className="text-sm text-muted-foreground">No SKILL.md content found.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {loadState === "error"
                      ? "Project skill catalog failed to load."
                      : "Loading project skills..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </ScrollArea>
  );
}
