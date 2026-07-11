"use client";

import { Maximize2, X } from "lucide-react";
import type { ReactElement } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TIER_LABELS, tierColor } from "./skill-os-constants";
import type { SkillDoc, SkillGraphEdge, SkillGraphNode } from "./skill-os-types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SkillDetailOverlay({
  doc,
  edges,
  fullPage,
  invocationCount,
  node,
  onClose,
  onOpenFullPage,
  onSelectSkill,
  evalCount,
  evalPath,
}: {
  doc: SkillDoc | null;
  edges: SkillGraphEdge[];
  fullPage: boolean;
  invocationCount: number;
  node: SkillGraphNode;
  onClose: () => void;
  onOpenFullPage: () => void;
  onSelectSkill: (skillId: string) => void;
  evalCount: number;
  evalPath?: string;
}): ReactElement {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const incoming = edges.filter((edge) => edge.target === node.id);
  const frameClass = fullPage
    ? "absolute bottom-4 left-4 right-4 top-4 z-40 grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-background shadow-2xl"
    : "absolute right-4 top-16 z-30 grid h-[72%] w-[min(36rem,48%)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border bg-background/96 shadow-2xl";

  return (
    <div className={frameClass} data-testid="skill-os-detail-overlay">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b bg-muted/25 px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-lg font-semibold">{node.id}</h3>
            <Badge style={{ backgroundColor: tierColor(node.tier), color: "white" }}>
              {TIER_LABELS[node.tier ?? 3] ?? "SKILL"}
            </Badge>
            <Badge variant="outline">{node.source ?? "local"}</Badge>
            <Badge variant="secondary">{invocationCount} invokes</Badge>
            {evalPath ? <Badge variant="secondary">{evalCount} evals</Badge> : null}
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">{node.path}</p>
          {evalPath ? (
            <p className="mt-1 break-all text-xs text-muted-foreground">{evalPath}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={onOpenFullPage}>
            <Maximize2 className="mr-2 h-3.5 w-3.5" />
            Open full page
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close skill detail">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0">
        <div className="min-w-0 space-y-5 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Tier</p>
              <p className="text-2xl font-semibold">{node.tier ?? 3}/3</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Outgoing</p>
              <p className="text-2xl font-semibold">{outgoing.length}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Incoming</p>
              <p className="text-2xl font-semibold">{incoming.length}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Invokes</p>
              <p className="text-2xl font-semibold">{invocationCount}</p>
            </div>
          </div>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Summary</h4>
            <p className="break-words text-sm leading-6">
              {node.description || "No description available."}
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Frontmatter</h4>
            <div className="overflow-hidden rounded-md border">
              {Object.entries(doc?.frontmatter ?? {}).map(([key, value]) => (
                <div
                  key={key}
                  className="grid min-w-0 grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="min-w-0 break-words text-muted-foreground">{key}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-all font-mono text-xs">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Outgoing Links
            </h4>
            <div className="space-y-2">
              {outgoing.slice(0, 16).map((edge) => (
                <button
                  key={`${edge.source}-${edge.target}-${edge.type}-${edge.label}`}
                  type="button"
                  className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
                  onClick={() => onSelectSkill(edge.target)}
                >
                  <span className="min-w-0 break-words">{edge.target_ref ?? edge.target}</span>
                  <Badge variant={edge.type === "common-chain" ? "secondary" : "outline"}>
                    {edge.type === "common-chain" ? "chain" : "ref"}
                  </Badge>
                </button>
              ))}
              {outgoing.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No outgoing skill links.
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">SKILL.md</h4>
            <div className="overflow-hidden rounded-md border bg-muted/10 p-4">
              <Response className="prose prose-invert max-w-none text-sm">
                {doc?.body ?? "Missing embedded skill document. Regenerate skill-docs.json."}
              </Response>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
