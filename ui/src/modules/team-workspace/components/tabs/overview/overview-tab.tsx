"use client";

/**
 * OVERVIEW TAB
 * ============
 * Orchestrates Overview data loading, derived labels, and section composition.
 */

import { type ReactElement, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { buildOverviewSummarySurface } from "@/modules/team-workspace/lib/dashboard-projections/overview-summary-surface";
import type { OverviewSurface } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { findProjectUiSnapshot } from "@/modules/team-workspace/lib/dashboard-projections/project-ui-snapshot";
import type { FarplaneProjectConfig, ProjectConfigLoadState } from "../project-config";
import { OverviewReportsCard, ReportReader } from "./overview-reports";
import {
  OverviewAttentionCard,
  OverviewAutonomySavings,
  OverviewCeoSummary,
  OverviewPinnedSignals,
  ProjectScopeCard,
} from "./overview-sections";

type ProjectModel = {
  id: string;
  name: string;
  status: string;
  goal?: string;
  businessConfig?: unknown;
};

type TeamModel = {
  _id: string;
  name: string;
  description?: string;
};

interface OverviewTabProps {
  team: TeamModel | null;
  panelTitle: string;
  project: ProjectModel | null;
  companyModel: { projects: ProjectModel[] } | null;
  setSelectedProjectId: (id: string | null) => void;
  globalMode: boolean;
  hasBusinessConfig: boolean;
  aiBurn24hUsd: number;
  aiUsageUnavailableText?: string | null;
  projectConfig: FarplaneProjectConfig | null;
  projectConfigState: ProjectConfigLoadState;
  projectConfigError: string | null;
  projectTasks: Array<{ status: string }>;
}

const EMPTY_OVERVIEW_SURFACE: OverviewSurface = {
  generatedAt: "",
  projectId: "loading",
  pins: [],
  attention: [],
  reports: [],
  sources: [],
};

export function OverviewTab({
  aiBurn24hUsd,
  aiUsageUnavailableText,
  companyModel,
  globalMode,
  hasBusinessConfig,
  project,
  projectConfig,
  projectConfigError,
  projectConfigState,
  projectTasks,
  setSelectedProjectId,
  team,
}: OverviewTabProps): ReactElement {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const projectUiSnapshot = findProjectUiSnapshot(projectConfig);
  const summarySurface = useMemo(
    () =>
      projectConfigState === "ready"
        ? buildOverviewSummarySurface({ projectConfig, aiBurn24hUsd, aiUsageUnavailableText })
        : null,
    [aiBurn24hUsd, aiUsageUnavailableText, projectConfig, projectConfigState],
  );
  const projectionLoading = projectConfigState === "loading";
  const effectiveSurface = summarySurface ?? EMPTY_OVERVIEW_SURFACE;

  const projectionBadge =
    projectConfigState === "ready" && projectUiSnapshot
      ? "project snapshot"
      : projectConfigState === "ready" && summarySurface
        ? "snapshot missing"
        : projectConfigState === "loading"
          ? "loading snapshot"
          : projectConfigError || "snapshot unavailable";
  const reportLinks = effectiveSurface.reports;
  const selectedReport =
    reportLinks.find((report) => report.id === selectedReportId) ?? reportLinks[0] ?? null;
  const visibleSelectedReport = selectedReportId ? selectedReport : null;

  const normalizedProjectGoal = project?.goal?.trim() ?? "";
  const normalizedTeamDescription = team?.description?.trim() ?? "";
  const cleanedTeamDescription = normalizedTeamDescription
    .replace(/\s*\|\s*open=\d+\s*closed=\d+\s*$/i, "")
    .trim();
  const teamBusinessDescription =
    cleanedTeamDescription.length > 0 && cleanedTeamDescription !== normalizedProjectGoal
      ? cleanedTeamDescription
      : "";
  const charter = projectUiSnapshot?.tabs.overview.charter;
  const openCommitmentCount = projectTasks.filter((task) => task.status !== "done").length;

  return (
    <ScrollArea className="h-full pr-3">
      <div
        className={cn(
          "gap-4",
          visibleSelectedReport
            ? "grid xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]"
            : "block",
        )}
      >
        <div className="space-y-4">
          <OverviewPinnedSignals
            loading={projectionLoading}
            onRefresh={() => undefined}
            projectionBadge={projectionBadge}
            projectionReady={Boolean(projectUiSnapshot)}
            signals={effectiveSurface.pins.map((pin) => ({
              label: pin.label,
              value: pin.value,
              description: pin.description,
              detail: pin.detail || pin.reason || pin.status,
              target: pin.target || pin.cardKind || "overview pin",
              provider: pin.provider || "overview_surface",
            }))}
          />

          {effectiveSurface.autonomySavings ? (
            <OverviewAutonomySavings presentation={effectiveSurface.autonomySavings} />
          ) : null}

          <OverviewAttentionCard
            items={effectiveSurface.attention.map((item) => ({
              id: item.id,
              label: item.title,
              detail: [
                item.attentionReason,
                item.linkedTicketId ? `ticket ${item.linkedTicketId}` : "",
                item.ticketStatus ? `status ${item.ticketStatus}` : "",
                item.owner ? `owner ${item.owner}` : "",
              ]
                .filter(Boolean)
                .join(" | "),
            }))}
            loading={projectionLoading}
            projectionBadge={projectionBadge}
            projectionReady={Boolean(projectUiSnapshot)}
          />

          <OverviewCeoSummary
            configBadge={configBadge(projectConfigState, projectConfigError)}
            commitmentSummary={`${openCommitmentCount} open ticket${openCommitmentCount === 1 ? "" : "s"}`}
            metricsProjected={Boolean(projectUiSnapshot?.metrics.series.length)}
            optimizationProjected={Boolean(projectUiSnapshot?.tabs.objectives.objectives.length)}
            harnessFileExists={Boolean(projectUiSnapshot)}
            hasBusinessConfig={hasBusinessConfig}
            mission={
              charter?.mission || "Harness mission is not projected by the current snapshot."
            }
            projectSummary={
              teamBusinessDescription ||
              String(projectUiSnapshot?.project.description ?? project?.name ?? "Project")
            }
            principles={charter?.operatingPrinciples ?? []}
            projectConfigReady={projectConfigState === "ready"}
            projectStatus={project?.status ?? "active"}
          />

          {globalMode && companyModel?.projects?.length ? (
            <ProjectScopeCard
              projects={companyModel.projects}
              selectedProjectId={project?.id ?? ""}
              setSelectedProjectId={setSelectedProjectId}
            />
          ) : null}

          <OverviewReportsCard
            reports={reportLinks}
            selectedReportId={visibleSelectedReport?.id ?? null}
            onOpenReport={setSelectedReportId}
          />
        </div>
        {visibleSelectedReport ? (
          <ReportReader report={visibleSelectedReport} onClose={() => setSelectedReportId(null)} />
        ) : null}
      </div>
    </ScrollArea>
  );
}

function configBadge(state: ProjectConfigLoadState, error: string | null): string {
  if (state === "ready") return "config loaded";
  if (state === "loading") return "loading config";
  return error || "config unavailable";
}
