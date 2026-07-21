"use client";

import { Search } from "lucide-react";
import type { ReactElement } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tierColor } from "./skill-os-constants";
import type { SkillGraphNode } from "./skill-os-types";

export type SkillGraphFilter = "all" | "needs-care" | "evaluated";

export function SkillSidebar({
  activeFilter,
  activeTiers,
  edgeCount,
  graphNodeCount,
  totalNodeCount,
  getInvocationCount,
  nodes,
  onQueryChange,
  onFilterChange,
  onSelectSkill,
  onShowChainsChange,
  onShowExternalChange,
  onShowRefsChange,
  onToggleTier,
  query,
  selectedSkillId,
  showChains,
  showExternal,
  showRefs,
}: {
  activeFilter: SkillGraphFilter;
  activeTiers: Set<number>;
  edgeCount: number;
  getInvocationCount: (skillId: string) => number;
  graphNodeCount: number;
  totalNodeCount: number;
  nodes: SkillGraphNode[];
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: SkillGraphFilter) => void;
  onSelectSkill: (skillId: string) => void;
  onShowChainsChange: (enabled: boolean) => void;
  onShowExternalChange: (enabled: boolean) => void;
  onShowRefsChange: (enabled: boolean) => void;
  onToggleTier: (tier: number) => void;
  query: string;
  selectedSkillId: string;
  showChains: boolean;
  showExternal: boolean;
  showRefs: boolean;
}): ReactElement {
  return (
    <aside className="flex min-h-0 flex-col border-r bg-muted/15">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills"
            name="skill-search"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["needs-care", "Needs care"],
              ["evaluated", "Evaluated"],
            ] as const
          ).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${activeFilter === filter ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground"}`}
              onClick={() => onFilterChange(filter)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {[1, 2, 3].map((tier) => (
            <button
              key={tier}
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${activeTiers.has(tier) ? "bg-primary/10" : "opacity-45"}`}
              onClick={() => onToggleTier(tier)}
            >
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: tierColor(tier) }}
              />
              T{tier}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${showExternal ? "bg-primary/10" : "opacity-45"}`}
            onClick={() => onShowExternalChange(!showExternal)}
          >
            external
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${showRefs ? "bg-primary/10" : "opacity-45"}`}
            onClick={() => onShowRefsChange(!showRefs)}
          >
            refs
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${showChains ? "bg-primary/10" : "opacity-45"}`}
            onClick={() => onShowChainsChange(!showChains)}
          >
            chains
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-2">
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`grid w-full min-w-0 gap-1 rounded-md border px-3 py-2.5 text-left text-sm hover:bg-muted/40 ${
                selectedSkillId === node.id ? "border-primary bg-primary/10" : "border-transparent"
              }`}
              onClick={() => onSelectSkill(node.id)}
            >
              <span className="flex min-w-0 items-start justify-between gap-2">
                <span className="min-w-0 break-words font-medium leading-5">{node.id}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {getInvocationCount(node.id) > 0 ? (
                    <span className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {getInvocationCount(node.id)}
                    </span>
                  ) : null}
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tierColor(node.tier) }}
                  />
                </span>
              </span>
              <span className="block whitespace-normal break-words text-xs leading-5 text-muted-foreground">
                {node.description || "No description available."}
              </span>
            </button>
          ))}
          {nodes.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No skills match the current search.
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <p className="uppercase text-muted-foreground">nodes</p>
            <p className="text-lg font-semibold">
              {graphNodeCount}
              <span className="text-xs font-normal text-muted-foreground"> / {totalNodeCount}</span>
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="uppercase text-muted-foreground">edges</p>
            <p className="text-lg font-semibold">{edgeCount}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
