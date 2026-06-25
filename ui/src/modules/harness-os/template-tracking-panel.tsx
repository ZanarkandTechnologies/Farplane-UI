"use client";

/**
 * Ownership: Harness OS template registry surface.
 * Inputs: registry-backed template tracking payload plus project adoption pins.
 * Outputs: structural-parameter table with a focused detail inspector.
 * Side effects: none.
 */

import { AlertTriangle, FileText, Search } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  HarnessAdoptionPayload,
  HarnessTemplateTrackingFamily,
  HarnessTemplateTrackingPayload,
} from "./harness-os-types";

type TemplateFilter = "all" | "project" | "skill" | "prompt" | "runtime" | "scanner-gap";

type TemplateRegistryRow = HarnessTemplateTrackingFamily & {
  currentConsumers: number;
  latestVersion: string;
  staleConsumers: number;
  totalConsumers: number;
};

function EmptyState({ error }: { error: string | null }): ReactElement {
  return (
    <div className="grid h-full min-h-[20rem] place-items-center rounded-md border border-dashed bg-muted/10">
      <div className="max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-semibold">Template registry unavailable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "No template registry payload has been loaded yet."}
        </p>
      </div>
    </div>
  );
}

function normalize(value?: string): string {
  return value?.trim() || "--";
}

function filterMatches(row: TemplateRegistryRow, filter: TemplateFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scanner-gap") return row.status === "scanner-gap";
  const haystack = [
    row.consumerScope,
    row.scope,
    row.installTarget,
    row.owner,
    row.familyId,
    row.registryPath,
  ]
    .join(" ")
    .toLowerCase();
  if (filter === "project") return haystack.includes("project") || haystack.includes("harness");
  if (filter === "skill") return haystack.includes("skill");
  if (filter === "prompt") return haystack.includes("agent") || haystack.includes("goal");
  if (filter === "runtime") {
    return haystack.includes("runtime") || haystack.includes("codex-global");
  }
  return true;
}

function buildRows({
  adoption,
  templateTracking,
}: {
  adoption: HarnessAdoptionPayload | null;
  templateTracking: HarnessTemplateTrackingPayload;
}): TemplateRegistryRow[] {
  return templateTracking.families
    .map((family) => {
      const latestVersion =
        family.templateVersion ??
        family.currentVersion ??
        adoption?.globalTemplateUses?.[family.familyId] ??
        "--";
      const currentConsumers = family.status === "tracked" ? (family.consumerCount ?? 0) : 0;
      const totalConsumers = family.consumerCount ?? currentConsumers;
      const staleConsumers = family.status === "stale" ? Math.max(1, totalConsumers) : 0;
      return {
        ...family,
        currentConsumers,
        latestVersion,
        staleConsumers,
        totalConsumers,
      };
    })
    .sort((a, b) => {
      const debtA = a.staleConsumers + (a.status === "missing" ? 1 : 0);
      const debtB = b.staleConsumers + (b.status === "missing" ? 1 : 0);
      return debtB - debtA || a.familyId.localeCompare(b.familyId);
    });
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "tracked") return "secondary";
  if (status === "missing") return "destructive";
  return "outline";
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background"
      }`}
    >
      {children}
    </button>
  );
}

function TemplateTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: TemplateRegistryRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <div className="min-h-0 rounded-md border bg-card">
      <div className="grid grid-cols-[minmax(13rem,1fr)_7rem_9rem_9rem_8rem_7rem] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Template ID</span>
        <span>Version</span>
        <span>Scope</span>
        <span>Owner</span>
        <span>Install</span>
        <span>Status</span>
      </div>
      <ScrollArea className="h-[62vh]">
        {rows.map((row) => (
          <button
            key={row.familyId}
            type="button"
            onClick={() => onSelect(row.familyId)}
            className={`grid w-full grid-cols-[minmax(13rem,1fr)_7rem_9rem_9rem_8rem_7rem] gap-3 border-b px-4 py-2 text-left text-sm transition last:border-b-0 hover:bg-muted/30 ${
              selectedId === row.familyId ? "bg-muted/40" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{row.familyId}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {row.registryPath ?? row.paths?.[0] ?? "--"}
              </p>
            </div>
            <Badge variant="secondary" className="w-fit">
              {row.latestVersion}
            </Badge>
            <span className="truncate text-muted-foreground">
              {normalize(row.consumerScope ?? row.scope)}
            </span>
            <span className="truncate text-muted-foreground">{normalize(row.owner)}</span>
            <span className="truncate text-muted-foreground">{normalize(row.installTarget)}</span>
            <Badge variant={statusVariant(row.status)} className="w-fit">
              {row.status}
            </Badge>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}

function TemplateInspector({ row }: { row: TemplateRegistryRow | null }): ReactElement {
  if (!row) {
    return (
      <div className="rounded-md border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
        Select a template to inspect registry metadata.
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-card">
      <div className="border-b p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-xl font-semibold">{row.familyId}</p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {row.registryPath ?? row.paths?.[0] ?? "--"}
            </p>
          </div>
          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
        </div>
      </div>
      <ScrollArea className="min-h-0">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Latest</p>
              <p className="text-lg font-semibold">{row.latestVersion}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Used</p>
              <p className="text-lg font-semibold">{row.usedVersion ?? row.observedVersion ?? "--"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Install</p>
              <p className="truncate text-lg font-semibold">{normalize(row.installTarget)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">History</p>
              <p className="truncate text-lg font-semibold">{normalize(row.historyPolicy)}</p>
            </div>
          </div>

          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Applies To</h4>
            <p className="mt-2 rounded-md border bg-muted/10 p-3 font-mono text-xs text-muted-foreground">
              {normalize(row.consumerScope ?? row.scope)}
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Feature Refs</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {(row.featureRefs ?? []).length ? (
                row.featureRefs?.map((ref) => (
                  <Badge key={ref} variant="outline">
                    {ref}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">none</span>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Consumers</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              {row.currentConsumers}/{row.totalConsumers || 0} current
              {row.staleConsumers ? `, ${row.staleConsumers} stale` : ""}
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Versions</h4>
            <div className="mt-2 space-y-2">
              <div className="rounded-md border px-3 py-2 text-sm">
                <span className="font-mono">{row.latestVersion}</span>
                <span className="ml-2 text-muted-foreground">latest in registry</span>
              </div>
              {row.usedVersion && row.usedVersion !== row.latestVersion ? (
                <div className="rounded-md border px-3 py-2 text-sm">
                  <span className="font-mono">{row.usedVersion}</span>
                  <span className="ml-2 text-muted-foreground">used by current project</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

export function TemplateTrackingPanel({
  adoption,
  error,
  templateTracking,
}: {
  adoption: HarnessAdoptionPayload | null;
  error: string | null;
  templateTracking: HarnessTemplateTrackingPayload | null;
}): ReactElement {
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    if (!templateTracking) return [];
    return buildRows({ adoption, templateTracking });
  }, [adoption, templateTracking]);
  const filteredRows = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!filterMatches(row, filter)) return false;
      if (!lowerQuery) return true;
      return [row.familyId, row.registryPath, row.owner, row.installTarget, row.consumerScope]
        .join(" ")
        .toLowerCase()
        .includes(lowerQuery);
    });
  }, [filter, query, rows]);
  const [selectedId, setSelectedId] = useState("");
  const selectedRow =
    filteredRows.find((row) => row.familyId === selectedId) ?? filteredRows[0] ?? null;
  const selectedRowId = selectedRow?.familyId ?? "";

  if (!templateTracking) return <EmptyState error={error} />;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["project", "Project"],
            ["skill", "Skill"],
            ["prompt", "Prompt"],
            ["runtime", "Runtime"],
            ["scanner-gap", "Scanner gaps"],
          ].map(([id, label]) => (
            <FilterButton
              key={id}
              active={filter === id}
              onClick={() => setFilter(id as TemplateFilter)}
            >
              {label}
            </FilterButton>
          ))}
        </div>
        <label className="flex min-w-[14rem] items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Search templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <TemplateTable rows={filteredRows} selectedId={selectedRowId} onSelect={setSelectedId} />
        <TemplateInspector row={selectedRow} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-4" />
        <span>
          Source: {templateTracking.registryStatus === "loaded" ? "Farplane template registry" : "UI fallback"}
        </span>
      </div>
    </div>
  );
}
