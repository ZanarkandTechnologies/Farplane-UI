import { Workflow } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store";
import { getSkillSourceKind, metricCards, SectionCard, truncateMiddle } from "./shared";
import type { IntelligenceTabProps, SkillCatalogRow } from "./types";

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
                        <span className="min-w-0 truncate font-medium">
                          {row.displayName ?? row.skillId}
                        </span>
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
