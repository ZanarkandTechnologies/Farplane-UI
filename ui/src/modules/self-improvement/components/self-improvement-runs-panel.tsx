"use client";

import { AlertTriangle, ArrowUpRight, FlaskConical, Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectModel } from "@/modules/runtime";
import { useAppStore } from "@/store";
import { useSelfImprovementRuns } from "../hooks/use-self-improvement-runs";
import type { SelfImproveRunSummary } from "../lib/self-improvement-runs";

export function buildSkillExperimentSearchParams(
  current: URLSearchParams,
  skillId: string,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("skill", skillId);
  next.set("view", "experiments");
  return next;
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) return "No update recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function ScoreFields({ run }: { run: SelfImproveRunSummary }): ReactElement | null {
  const fields = [
    ["Baseline", run.baselineScore],
    ["Current", run.currentScore],
    ["Target", run.targetScore],
    ["Delta", run.scoreDelta],
  ].filter((field): field is [string, string] => Boolean(field[1]));
  if (fields.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
      {fields.map(([label, value]) => (
        <span key={label}>
          <span className="text-muted-foreground">{label}</span> {value}
        </span>
      ))}
    </div>
  );
}

export function SelfImprovementRunsPanel({
  open,
  onOpenChange,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly ProjectModel[];
}): ReactElement {
  const state = useSelfImprovementRuns(open, projects);
  const [searchParams, setSearchParams] = useSearchParams();
  const setSelectedSkillStudioSkillId = useAppStore((store) => store.setSelectedSkillStudioSkillId);
  const setSkillStudioSurface = useAppStore((store) => store.setSkillStudioSurface);
  const setIsSkillsPanelOpen = useAppStore((store) => store.setIsSkillsPanelOpen);

  function openSkillExperiment(skillId: string): void {
    setSearchParams(buildSkillExperimentSearchParams(searchParams, skillId));
    setSelectedSkillStudioSkillId(skillId);
    setSkillStudioSurface("skill-os");
    onOpenChange(false);
    setIsSkillsPanelOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(82vh,52rem)] max-w-[min(94vw,72rem)] grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,72rem)]">
        <DialogHeader className="border-b bg-muted/20 px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            <DialogTitle>Self-Improvement Runs</DialogTitle>
          </div>
          <DialogDescription>
            Ticket-backed Goal campaigns across configured project folders.
          </DialogDescription>
        </DialogHeader>

        {state.partial ? (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3.5 shrink-0" />
            Showing partial results{state.truncated ? " at the bounded scan limit" : ""};{" "}
            {state.issues.length} project read issue{state.issues.length === 1 ? "" : "s"}.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.status === "loading" ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading Goal Packets…
            </div>
          ) : null}
          {state.status === "error" ? (
            <div className="m-5 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}
          {state.status === "ready" && state.runs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <FlaskConical className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">No active self-improvement Goal Packets found</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Runs appear when a configured project ticket declares a bounded
                <span className="font-mono"> skill_improvement</span> Goal loop.
              </p>
            </div>
          ) : null}
          {state.status === "ready" && state.runs.length > 0 ? (
            <div className="divide-y">
              {state.runs.map((run) => (
                <article
                  key={run.id}
                  className="grid gap-3 px-5 py-4 hover:bg-muted/20 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{run.title}</span>
                      {run.status ? <Badge variant="secondary">{run.status}</Badge> : null}
                      {run.phase ? <Badge variant="outline">{run.phase}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{run.projectName}</span>
                      <span className="font-mono">{run.ticketId}</span>
                      <span>{formatUpdatedAt(run.updatedAt)}</span>
                      {run.targetSkill ? (
                        <span className="font-mono">{run.targetSkill}</span>
                      ) : null}
                    </div>
                    <ScoreFields run={run} />
                    {run.nextAction ? (
                      <p className="line-clamp-2 text-xs leading-5">
                        <span className="text-muted-foreground">Next:</span> {run.nextAction}
                      </p>
                    ) : null}
                    {run.evidenceRefs.length > 0 ? (
                      <p
                        className="truncate font-mono text-[10px] text-muted-foreground"
                        title={run.evidenceRefs.join(" · ")}
                      >
                        Evidence: {run.evidenceRefs.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!run.targetSkill}
                    title={
                      run.targetSkill
                        ? "Open this skill's experiment history"
                        : "No target skill recorded"
                    }
                    onClick={() => run.targetSkill && openSkillExperiment(run.targetSkill)}
                  >
                    Skill OS <ArrowUpRight className="size-3.5" />
                  </Button>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
