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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import { EvalOsPanel } from "@/modules/evals";
import { HarnessOsPanel } from "@/modules/harness-os";
import { useSkillsPanelController } from "@/modules/office/components/use-skills-panel-controller";
import { SkillOsMiniApp } from "@/modules/skills-studio/components/skill-os";

function panelTitle(
  surface: "skill-os" | "template-rollout" | "evals" | "harness",
  focusAgentId: string | null,
): string {
  if (focusAgentId) return "Agent Skills";
  if (surface === "template-rollout") return "Template Rollout";
  if (surface === "evals") return "Evals";
  if (surface === "harness") return "Harness OS";
  return "Skill OS";
}

function panelDescription(
  surface: "skill-os" | "template-rollout" | "evals" | "harness",
  focusAgentId: string | null,
): string {
  if (focusAgentId) {
    return "Codex adapter mode hides per-agent skill equip controls; this panel stays available as a read-first adapter surface.";
  }
  if (surface === "evals") {
    return "Eval OS mini app for latest runs, health, history, task drilldown, and report artifacts.";
  }
  if (surface === "template-rollout") {
    return "Harness rollout view focused on project adoption, reusable templates, skill templates, and drift.";
  }
  if (surface === "harness") {
    return "Repo-wide Harness OS: skills, docs, specs, features, agents, templates, validators, and policies.";
  }
  return "Graph-first Skill OS: skill backlinks, Markdown-ref edges, common chains, and overlay skill docs.";
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
          {surface === "evals" ? <EvalOsPanel /> : null}
          {surface === "harness" ? <HarnessOsPanel /> : null}
          {surface === "template-rollout" ? <HarnessOsPanel initialTab="rollout" /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
