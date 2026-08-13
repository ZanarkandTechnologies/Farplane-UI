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

import type { ReactElement } from "react";
import { useShallow } from "zustand/react/shallow";
import { OfficeWorkspaceDialog } from "@/components/office-workspace-dialog";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EvalOsPanel } from "@/modules/evals";
import { HarnessOsPanel } from "@/modules/harness-os";
import { SelfImprovementRunsContent } from "@/modules/self-improvement";
import { SkillOsMiniApp } from "@/modules/skills-studio/components/skill-os";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/store";

function panelTitle(
  surface:
    | "skill-os"
    | "template-tracking"
    | "evals"
    | "harness"
    | "rollout"
    | "skill-rollout"
    | "self-improvement-runs",
  focusAgentId: string | null,
): string {
  if (focusAgentId) return "Agent Skills";
  if (surface === "skill-rollout") return "Skill OS";
  if (surface === "template-tracking") return "Harness OS";
  if (surface === "evals") return "Evals";
  if (surface === "rollout") return "Harness OS";
  if (surface === "harness") return "Harness OS";
  if (surface === "self-improvement-runs") return "Self-Improvement Runs";
  return "Skill OS";
}

function panelDescription(
  surface:
    | "skill-os"
    | "template-tracking"
    | "evals"
    | "harness"
    | "rollout"
    | "skill-rollout"
    | "self-improvement-runs",
  focusAgentId: string | null,
): string {
  if (focusAgentId) {
    return "Codex adapter mode hides per-agent skill equip controls; this panel stays available as a read-first adapter surface.";
  }
  if (surface === "evals") {
    return "Eval OS mini app for latest runs, health, history, task drilldown, and report artifacts.";
  }
  if (surface === "template-tracking") {
    return "Harness OS Templates for registry-backed structural parameters and install policy.";
  }
  if (surface === "skill-rollout") {
    return "Skills that need eval coverage, quality checks, or template maintenance.";
  }
  if (surface === "rollout") return "Harness OS Projects for active project framework adoption.";
  if (surface === "harness") {
    return "Semantic graph, lifecycle, and feature registry for the Farplane Harness OS.";
  }
  if (surface === "self-improvement-runs") {
    return "Ticket-backed Goal campaigns across configured project folders.";
  }
  return "Find a skill in the graph, then inspect its runbook, experiments, and files.";
}

function studioTabFor(
  surface:
    | "skill-os"
    | "template-tracking"
    | "evals"
    | "harness"
    | "rollout"
    | "skill-rollout"
    | "self-improvement-runs",
): "skill-os" | "evals" | "harness" | "self-improvement-runs" {
  if (surface === "evals") return "evals";
  if (surface === "self-improvement-runs") return "self-improvement-runs";
  if (surface === "harness" || surface === "rollout" || surface === "template-tracking") {
    return "harness";
  }
  return "skill-os";
}

export function SkillsPanel(): ReactElement {
  const { companyModel } = useOfficeDataContext();
  const { focusAgentId, isOpen, setIsOpen, setSurface, surface } = useAppStore(
    useShallow((state) => ({
      focusAgentId: state.skillStudioFocusAgentId,
      isOpen: state.isSkillsPanelOpen,
      setIsOpen: state.setIsSkillsPanelOpen,
      setSurface: state.setSkillStudioSurface,
      surface: state.skillStudioSurface,
    })),
  );

  return (
    <OfficeWorkspaceDialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{panelTitle(surface, focusAgentId)}</DialogTitle>
          <p className="text-xs text-muted-foreground">{panelDescription(surface, focusAgentId)}</p>
          {!focusAgentId ? (
            <Tabs
              value={studioTabFor(surface)}
              onValueChange={(value) =>
                setSurface(value as "skill-os" | "evals" | "harness" | "self-improvement-runs")
              }
              className="mt-3"
            >
              <TabsList>
                <TabsTrigger value="skill-os">Skills</TabsTrigger>
                <TabsTrigger value="evals">Evals</TabsTrigger>
                <TabsTrigger value="harness">Harness</TabsTrigger>
                <TabsTrigger value="self-improvement-runs">Runs</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
          {focusAgentId ? (
            <p className="text-xs text-muted-foreground">Focused agent: {focusAgentId}</p>
          ) : null}
        </DialogHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden",
            surface === "skill-os" || surface === "skill-rollout" ? "p-0" : "p-4",
          )}
        >
          {surface === "skill-os" ? <SkillOsMiniApp /> : null}
          {surface === "evals" ? <EvalOsPanel /> : null}
          {surface === "harness" ? <HarnessOsPanel /> : null}
          {surface === "skill-rollout" ? <SkillOsMiniApp initialFilter="needs-care" /> : null}
          {surface === "rollout" ? <HarnessOsPanel initialView="rollout" /> : null}
          {surface === "template-tracking" ? <HarnessOsPanel initialView="templates" /> : null}
          {surface === "self-improvement-runs" ? (
            <SelfImprovementRunsContent
              enabled={isOpen}
              projects={companyModel?.projects ?? []}
            />
          ) : null}
        </div>
    </OfficeWorkspaceDialog>
  );
}
