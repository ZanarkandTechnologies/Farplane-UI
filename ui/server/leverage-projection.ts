/**
 * Builds the browser-safe global leverage read model from Finance and project snapshots.
 * It owns no collection or durable state: company tracking contexts locate snapshots,
 * explicit card metadata chooses Capital/Distribution/Edge, and missing evidence remains a gap.
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type {
  BuildLeverageProjectionInput,
  LeverageCapital,
  LeverageDistributionAccount,
  LeverageDistributionMetric,
  LeverageEdge,
  LeverageProjection,
  LeverageSourceGap,
  LeverageStrength,
  ReadLeverageProjectionInput,
} from "./leverage-types";

export type {
  BuildLeverageProjectionInput,
  LeverageCapital,
  LeverageDistributionAccount,
  LeverageDistributionMetric,
  LeverageEdge,
  LeverageProjection,
  LeverageSourceGap,
  LeverageStrength,
  ReadLeverageProjectionInput,
} from "./leverage-types";

type JsonRecord = Record<string, unknown>;

type RegisteredProject = {
  projectId: string;
  projectName: string;
  projectRoot: string | null;
};

type DistributionAccountIdentity = {
  accountKey: string;
  accountLabel: string;
};

type DistributionMetricCandidate = LeverageDistributionMetric &
  DistributionAccountIdentity & {
    projectId: string;
    projectName: string;
    projectRoot: string;
  };

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isSafeTrackingContext(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("/") && !value.includes("\0");
}

function registeredProjects(company: unknown): RegisteredProject[] {
  const rawProjects = record(company).projects;
  const projects: unknown[] = Array.isArray(rawProjects) ? rawProjects : [];
  const byRoot = new Set<string>();
  const result: RegisteredProject[] = [];

  for (const [index, rawProject] of projects.entries()) {
    const project = record(rawProject);
    const projectId = text(project.id) || `company-project-${index + 1}`;
    const projectName = text(project.name) || projectId;
    const projectRoot = isSafeTrackingContext(project.trackingContext)
      ? path.resolve(project.trackingContext.trim())
      : null;
    if (projectRoot && byRoot.has(projectRoot)) continue;
    if (projectRoot) byRoot.add(projectRoot);
    result.push({ projectId, projectName, projectRoot });
  }

  return result;
}

function buildCapital(financeProjection: unknown): LeverageCapital {
  const latestBalance = record(record(financeProjection).latestBalance);
  const balanceCents = numberValue(latestBalance.balanceCents);
  const currency = optionalText(latestBalance.currency);
  if (balanceCents === null || !currency) {
    return {
      status: "missing",
      asOf: null,
      balanceCents: null,
      currency: null,
      observedAt: null,
      source: null,
    };
  }
  return {
    status: "available",
    asOf: optionalText(latestBalance.asOf),
    balanceCents,
    currency,
    observedAt: optionalText(latestBalance.observedAt),
    source: optionalText(latestBalance.source),
  };
}

function metricStatus(card: JsonRecord): string {
  const current = record(card.current);
  return text(current.status) || text(card.status) || "missing";
}

function distributionAccount(card: JsonRecord): DistributionAccountIdentity | null {
  const account = record(card.distribution_account);
  const platform = text(account.platform).toLowerCase();
  const accountId = text(account.account_id);
  const label = text(account.label);
  if (!platform || !accountId || !label) return null;
  const platformLabel = platform === "x" ? "X" : `${platform[0]?.toUpperCase() ?? ""}${platform.slice(1)}`;
  return { accountKey: `${platform}:${accountId}`, accountLabel: `${platformLabel} · ${label}` };
}

function accountCardId(accountKey: string): string {
  return `distribution-account-${createHash("sha256").update(accountKey).digest("hex").slice(0, 12)}`;
}

function projectGap(
  project: RegisteredProject,
  scope: LeverageSourceGap["scope"],
  code: string,
  message: string,
): LeverageSourceGap {
  return {
    code,
    message,
    projectId: project.projectId,
    projectName: project.projectName,
    projectRoot: project.projectRoot,
    scope,
  };
}

function sourceGapForMetric(
  project: RegisteredProject,
  scope: "distribution" | "edge",
  metric: Pick<LeverageDistributionMetric | LeverageEdge, "label" | "status">,
): LeverageSourceGap {
  return projectGap(
    project,
    scope,
    `${scope}_${metric.status}`,
    `${metric.label} is ${metric.status.replaceAll("_", " ")}.`,
  );
}

function snapshotCards(snapshot: unknown): JsonRecord[] {
  const metrics = record(record(snapshot).metrics);
  return Array.isArray(metrics.series) ? metrics.series.map(record) : [];
}

function projectResources(
  project: RegisteredProject,
  snapshot: unknown,
): { distribution: DistributionMetricCandidate[]; edge: LeverageEdge | null; gaps: LeverageSourceGap[] } {
  const distribution: DistributionMetricCandidate[] = [];
  const gaps: LeverageSourceGap[] = [];
  let edge: LeverageEdge | null = null;
  let hasDistributionMetric = false;

  for (const card of snapshotCards(snapshot)) {
    const leverage = text(card.leverage);
    const current = record(card.current);
    const metricId = text(card.metric_id) || "unknown_metric";
    const label = text(card.label) || metricId;
    const status = metricStatus(card);
    const observedAt = optionalText(current.observed_at);

    if (leverage === "distribution") {
      hasDistributionMetric = true;
      const metric: LeverageDistributionMetric = {
        metricId,
        label,
        observedAt,
        status,
        unit: text(card.unit),
        value: numberValue(current.value),
      };
      const account = distributionAccount(card);
      if (!account) {
        gaps.push(
          projectGap(
            project,
            "distribution",
            "distribution_account_identity_missing",
            `${label} has no observed social-account identity; refresh its collector before grouping it.`,
          ),
        );
        if (metric.status !== "available" || metric.value === null) {
          gaps.push(sourceGapForMetric(project, "distribution", metric));
        }
        continue;
      }
      distribution.push({
        ...account,
        projectId: project.projectId,
        projectName: project.projectName,
        projectRoot: project.projectRoot ?? "",
        ...metric,
      });
      if (metric.status !== "available" || metric.value === null) {
        gaps.push(sourceGapForMetric(project, "distribution", metric));
      }
    }

    if (leverage === "edge" && edge === null) {
      const currentValue = current.value;
      const metric: LeverageEdge = {
        projectId: project.projectId,
        projectName: project.projectName,
        projectRoot: project.projectRoot ?? "",
        metricId,
        label,
        observedAt,
        status,
        value: typeof currentValue === "string" && currentValue.trim() ? currentValue.trim() : null,
      };
      edge = metric;
      if (metric.status !== "available" || metric.value === null) {
        gaps.push(sourceGapForMetric(project, "edge", metric));
      }
    }
  }

  if (!hasDistributionMetric) {
    gaps.push(
      projectGap(
        project,
        "distribution",
        "distribution_not_configured",
        "No numeric distribution metric is configured in the project snapshot.",
      ),
    );
  }
  if (!edge) {
    gaps.push(
      projectGap(project, "edge", "edge_not_configured", "No Edge metric is configured in the project snapshot."),
    );
  }

  return { distribution, edge, gaps };
}

function unavailableEdge(project: RegisteredProject, status: "not_configured" | "unavailable"): LeverageEdge {
  return {
    projectId: project.projectId,
    projectName: project.projectName,
    projectRoot: project.projectRoot ?? "",
    metricId: null,
    label: "Edge",
    observedAt: null,
    status,
    value: null,
  };
}

function groupDistribution(metrics: DistributionMetricCandidate[]): {
  accounts: LeverageDistributionAccount[];
  gaps: LeverageSourceGap[];
} {
  const accounts = new Map<string, DistributionMetricCandidate[]>();
  for (const metric of metrics) {
    accounts.set(metric.accountKey, [...(accounts.get(metric.accountKey) ?? []), metric]);
  }
  const gaps: LeverageSourceGap[] = [];
  const grouped = [...accounts.entries()].map(([accountKey, candidates]) => {
    const projects = [...new Map(candidates.map((candidate) => [candidate.projectId, {
      id: candidate.projectId,
      name: candidate.projectName,
    }])).values()].sort((left, right) => left.name.localeCompare(right.name));
    const metrics = new Map<string, DistributionMetricCandidate[]>();
    for (const candidate of candidates) {
      metrics.set(candidate.metricId, [...(metrics.get(candidate.metricId) ?? []), candidate]);
    }
    const uniqueMetrics = [...metrics.values()].map((metricCandidates) => {
      const sorted = [...metricCandidates].sort(
        (left, right) =>
          (right.observedAt ?? "").localeCompare(left.observedAt ?? "") ||
          left.projectId.localeCompare(right.projectId) ||
          left.projectRoot.localeCompare(right.projectRoot),
      );
      const selected = sorted[0];
      const newest = sorted.filter((candidate) => candidate.observedAt === selected.observedAt);
      if (
        newest.some(
          (candidate) =>
            candidate.value !== selected.value ||
            candidate.status !== selected.status ||
            candidate.unit !== selected.unit,
        )
      ) {
        gaps.push(
          projectGap(
            selected,
            "distribution",
            "distribution_account_metric_conflict",
            `${selected.label} has conflicting newest readings for one shared account; using ${selected.projectName} deterministically.`,
          ),
        );
      }
      const { accountKey: _accountKey, accountLabel: _accountLabel, projectId: _projectId, projectName: _projectName, projectRoot: _projectRoot, ...metric } = selected;
      return metric;
    });
    return {
      id: accountCardId(accountKey),
      label: candidates[0]?.accountLabel ?? "Distribution account",
      projects,
      metrics: uniqueMetrics.sort((left, right) => left.label.localeCompare(right.label)),
    };
  });
  return { accounts: grouped.sort((left, right) => left.label.localeCompare(right.label)), gaps };
}

export async function buildLeverageProjection(
  input: BuildLeverageProjectionInput,
): Promise<LeverageProjection> {
  const capital = buildCapital(input.financeProjection);
  const sourceGaps: LeverageSourceGap[] = [];
  const strengths: LeverageStrength[] = [];
  if (capital.status === "available") {
    strengths.push({
      kind: "capital",
      label: "Company cash",
      projectId: null,
      projectName: null,
      observedAt: capital.observedAt,
    });
  } else {
    sourceGaps.push({
      code: "capital_not_recorded",
      message: "No company cash snapshot is recorded in Finance.",
      projectId: null,
      projectName: null,
      projectRoot: null,
      scope: "capital",
    });
  }

  const distribution: DistributionMetricCandidate[] = [];
  const edges: LeverageEdge[] = [];
  for (const project of registeredProjects(input.company)) {
    if (!project.projectRoot) {
      sourceGaps.push(
        projectGap(
          project,
          "project",
          "tracking_context_missing",
          "This registered project has no usable tracking context.",
        ),
      );
      edges.push(unavailableEdge(project, "unavailable"));
      continue;
    }

    let snapshot: unknown;
    try {
      snapshot = await input.readProjectSnapshot(project.projectRoot);
    } catch {
      sourceGaps.push(
        projectGap(
          project,
          "project",
          "project_snapshot_unavailable",
          "The project snapshot could not be read.",
        ),
      );
      edges.push(unavailableEdge(project, "unavailable"));
      continue;
    }

    const resources = projectResources(project, snapshot);
    sourceGaps.push(...resources.gaps);
    for (const metric of resources.distribution) {
      distribution.push(metric);
    }
    const edge = resources.edge ?? unavailableEdge(project, "not_configured");
    edges.push(edge);
    if (edge.status === "available" && edge.value) {
      strengths.push({
        kind: "edge",
        label: `${project.projectName}: ${edge.label}`,
        projectId: project.projectId,
        projectName: project.projectName,
        observedAt: edge.observedAt,
      });
    }
  }

  const groupedDistribution = groupDistribution(distribution);
  sourceGaps.push(...groupedDistribution.gaps);
  for (const account of groupedDistribution.accounts) {
    for (const metric of account.metrics) {
      if (metric.status !== "available" || metric.value === null) continue;
      strengths.push({
        kind: "distribution",
        label: `${account.label}: ${metric.label}`,
        projectId: null,
        projectName: null,
        observedAt: metric.observedAt,
      });
    }
  }

  return {
    schema: "farplane_leverage_projection",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    capital,
    distribution: groupedDistribution.accounts,
    edges,
    sourceGaps,
    strengths,
    weaknesses: sourceGaps,
  };
}

export async function readLeverageProjection(
  input: ReadLeverageProjectionInput,
): Promise<LeverageProjection> {
  const readText = input.readText ?? ((filePath: string) => readFile(filePath, "utf8"));
  const company = JSON.parse(await readText(input.companyPath)) as unknown;
  return buildLeverageProjection({
    company,
    financeProjection: input.financeProjection,
    generatedAt: input.generatedAt,
    readProjectSnapshot: async (projectRoot) => {
      const snapshotPath = path.join(projectRoot, ".farplane", "project", "ui", "latest.json");
      return JSON.parse(await readText(snapshotPath)) as unknown;
    },
  });
}
