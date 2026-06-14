"use client";

/**
 * SKILL STUDIO PANEL
 * ==================
 * Dedicated viewer/workbench for repo-local skills, demos, metadata, and files.
 *
 * KEY CONCEPTS:
 * - Global catalog lives on the left; selected skill details render on the right.
 * - Per-agent runtime context is optional and merged from `skills.status` when available.
 * - Metadata edits are limited to `skill.config.yaml`; `SKILL.md` remains read-only.
 *
 * MEMORY REFERENCES:
 * - MEM-0160
 * - MEM-0166
 * - MEM-0188
 * - MEM-0203
 * - MEM-0205
 */

import { Network } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import { useSkillsPanelController } from "@/modules/office/components/use-skills-panel-controller";
import { SkillOsMiniApp } from "@/modules/skills-studio/components/skill-os";

type SkillGraphNode = {
  id: string;
  label: string;
  tier?: number;
  group?: string;
  source?: string;
  description?: string;
};

type SkillGraphEdge = {
  source: string;
  target: string;
  type?: string;
};

type SkillGraphPayload = {
  counts?: { nodes?: number; edges?: number };
  edges: SkillGraphEdge[];
  nodes: SkillGraphNode[];
};

function panelTitle(
  surface: "skill-os" | "evals" | "harness",
  focusAgentId: string | null,
): string {
  if (focusAgentId) return "Agent Skills";
  if (surface === "evals") return "Evals";
  if (surface === "harness") return "Harness";
  return "Skill OS";
}

function panelDescription(
  surface: "skill-os" | "evals" | "harness",
  focusAgentId: string | null,
): string {
  if (focusAgentId) {
    return "Codex adapter mode hides per-agent skill equip controls; this panel stays available as a read-first adapter surface.";
  }
  if (surface === "evals") {
    return "Eval OS mini app for latest runs, health, history, task drilldown, and report artifacts.";
  }
  if (surface === "harness") {
    return "Harness map entrypoint for skills, docs, agents, templates, validators, and policies.";
  }
  return "Graph-first Skill OS: skill backlinks, Markdown-ref edges, common chains, and overlay skill docs.";
}

function HarnessSurface(): ReactElement {
  const [graph, setGraph] = useState<SkillGraphPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/codex/skill-maintenance-graph/harness-graph.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SkillGraphPayload | null) => {
        if (!cancelled) setGraph(payload);
      })
      .catch(() => {
        if (!cancelled) setGraph(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const nodeKinds = Object.entries(
    (graph?.counts as { node_kinds?: Record<string, number> } | undefined)?.node_kinds ?? {},
  ).slice(0, 8);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Map</p>
          <p className="text-2xl font-semibold">Harness</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Nodes</p>
          <p className="text-2xl font-semibold">{graph?.counts?.nodes ?? "loading"}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Edges</p>
          <p className="text-2xl font-semibold">{graph?.counts?.edges ?? "loading"}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-muted/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Harness Graph</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Harness uses the same graph-rendering direction as Skill OS, but a different data source:
          skills, docs, agents, templates, validators, and policies.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {nodeKinds.map(([kind, count]) => (
            <div key={kind} className="rounded-md border bg-background p-3">
              <p className="text-[11px] uppercase text-muted-foreground">{kind}</p>
              <p className="text-xl font-semibold">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvalsSurfacePlaceholder(): ReactElement {
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed p-6 text-center">
      <div>
        <div className="text-sm font-semibold">Eval OS is prepared as a separate module.</div>
        <div className="mt-1 max-w-md text-xs text-muted-foreground">
          Skill OS now links skills to invocation and rollout state. The eval run workbench should
          land with its own ticket and proof bundle.
        </div>
      </div>
    </div>
  );
}

export function SkillsPanel(): ReactElement {
  const { errorText, focusAgentId, isOpen, setIsOpen, surface } = useSkillsPanelController();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="flex h-[92vh] min-w-[88vw] max-w-none flex-col gap-0 overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{panelTitle(surface, focusAgentId)}</DialogTitle>
          <p className="text-xs text-muted-foreground">{panelDescription(surface, focusAgentId)}</p>
          {focusAgentId ? (
            <p className="text-xs text-muted-foreground">Focused agent: {focusAgentId}</p>
          ) : null}
          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {surface === "skill-os" ? <SkillOsMiniApp /> : null}
          {surface === "evals" ? <EvalsSurfacePlaceholder /> : null}
          {surface === "harness" ? <HarnessSurface /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
