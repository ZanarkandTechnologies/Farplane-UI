"use client";

/**
 * Ownership: Harness OS health overview.
 * Inputs: generated graph model, lifecycle model, rollout scans, and bridge errors.
 * Outputs: read-only operator summary of readiness, registries, guardrails, and attention counts.
 * Side effects: none.
 */

import { AlertTriangle, CheckCircle2, FileCheck2, GitBranch, Network, ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import type { HarnessLifecycleModel, HarnessOsModel } from "./harness-os-model";
import type { HarnessAdoptionPayload, HarnessSkillRolloutPayload } from "./harness-os-types";

function numberText(value: number | undefined): string {
  return String(value ?? 0);
}

function statusTone(count: number): "secondary" | "destructive" | "outline" {
  if (count === 0) return "secondary";
  if (count > 20) return "destructive";
  return "outline";
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="min-w-0 rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CheckRow({
  detail,
  label,
  tone,
}: {
  detail: string;
  label: string;
  tone: "ok" | "warn" | "missing";
}): ReactElement {
  const icon =
    tone === "ok" ? (
      <CheckCircle2 className="size-4 text-emerald-600" />
    ) : (
      <AlertTriangle className="size-4 text-amber-600" />
    );
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
      {icon}
      <div className="min-w-0">
        <p className="truncate font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={tone === "ok" ? "secondary" : "outline"}>{tone}</Badge>
    </div>
  );
}

export function HarnessHealthPanel({
  adoption,
  adoptionError,
  lifecycleModel,
  model,
  onOpenMap,
  onOpenRollout,
  skillRollout,
  skillRolloutError,
}: {
  adoption: HarnessAdoptionPayload | null;
  adoptionError: string | null;
  lifecycleModel: HarnessLifecycleModel;
  model: HarnessOsModel;
  onOpenMap: () => void;
  onOpenRollout: () => void;
  skillRollout: HarnessSkillRolloutPayload | null;
  skillRolloutError: string | null;
}): ReactElement {
  const driftItems = adoption?.counts?.driftItems ?? 0;
  const skillDrift =
    (skillRollout?.counts?.missing ?? 0) +
    (skillRollout?.counts?.stale ?? 0) +
    (skillRollout?.counts?.templateDriftItems ?? 0);
  const guardrails = lifecycleModel.summary.guardrails;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-md border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Harness Health</p>
              <h2 className="mt-1 text-2xl font-semibold">Pilot to production map</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Farplane can currently explain its skills, lifecycle graph, feature registry, and
                rollout posture from generated artifacts plus framework CLI scans.
              </p>
            </div>
            <Badge variant={driftItems || skillDrift ? "outline" : "secondary"}>
              {driftItems + skillDrift} attention
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Network className="size-4" />} label="graph nodes" value={String(model.summary.nodes)} />
            <Metric icon={<GitBranch className="size-4" />} label="FSA paths" value={String(lifecycleModel.summary.fsaProjections)} />
            <Metric icon={<FileCheck2 className="size-4" />} label="projects" value={numberText(adoption?.counts?.projects)} />
            <Metric icon={<ShieldCheck className="size-4" />} label="guardrails" value={String(guardrails)} />
          </div>
        </section>

        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="font-semibold">Readiness Checks</p>
            <Badge variant={statusTone(driftItems + skillDrift)}>
              {driftItems + skillDrift ? "review" : "clear"}
            </Badge>
          </div>
          <CheckRow
            detail={`${model.summary.skills} skills and ${model.summary.features} features are visible`}
            label="Core graph is loaded"
            tone={model.summary.nodes ? "ok" : "missing"}
          />
          <CheckRow
            detail={`${lifecycleModel.summary.nodes} lifecycle nodes / ${lifecycleModel.summary.edges} edges`}
            label="Lifecycle projection is available"
            tone={lifecycleModel.graphAvailable ? "ok" : "warn"}
          />
          <CheckRow
            detail={adoption ? `${adoption.counts?.manifests ?? 0} manifests scanned` : (adoptionError ?? "scan pending")}
            label="Project adoption scan"
            tone={adoption ? "ok" : "warn"}
          />
          <CheckRow
            detail={
              skillRollout
                ? `${skillRollout.counts?.skills ?? 0} skills / ${skillRollout.counts?.stale ?? 0} stale`
                : (skillRolloutError ?? "scan pending")
            }
            label="Skill template rollout"
            tone={skillRollout ? (skillDrift ? "warn" : "ok") : "warn"}
          />
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={onOpenMap}
          className="rounded-md border bg-background p-3 text-left transition hover:border-primary"
        >
          <p className="text-sm font-semibold">Map</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Inspect lifecycle, graph, and feature registry views.
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenRollout}
          className="rounded-md border bg-background p-3 text-left transition hover:border-primary"
        >
          <p className="text-sm font-semibold">Rollout</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Review project adoption, features, templates, skills, and drift.
          </p>
        </button>
        <div className="rounded-md border bg-background p-3">
          <p className="text-sm font-semibold">Entry Points</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Skills and Evals stay sibling panels for frequent direct work.
          </p>
        </div>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-2">
        <section className="min-h-0 rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-sm font-semibold">Production Loops</div>
          {lifecycleModel.stages.slice(0, 5).map((stage) => (
            <div key={stage.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-3 py-2 text-sm last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{stage.title}</p>
                <p className="truncate text-xs text-muted-foreground">{stage.description}</p>
              </div>
              <Badge variant={stage.readiness === "ready" ? "secondary" : "outline"}>
                {stage.readiness}
              </Badge>
            </div>
          ))}
        </section>
        <section className="min-h-0 rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-sm font-semibold">Guardrails And Registries</div>
          {[
            ["Feature registry", `${model.features.length} feature rows`],
            ["Template rollout", `${skillRollout?.counts?.templateRolloutRows ?? 0} consumer rows`],
            ["Eval coverage", `${skillRollout?.counts?.withEval ?? 0} skills with eval tasks`],
            ["QA coverage", `${skillRollout?.counts?.withQaChecklist ?? 0} skills with QA checklists`],
          ].map(([label, detail]) => (
            <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-3 py-2 text-sm last:border-b-0">
              <span className="truncate font-medium">{label}</span>
              <span className="truncate text-xs text-muted-foreground">{detail}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
