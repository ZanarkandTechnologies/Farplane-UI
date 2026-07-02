#!/usr/bin/env node
/**
 * Compile Farplane dashboard projections.
 * Inputs: project-local goals, optional social metric exports, reports, and
 * runtime state. Outputs: .farplane/metrics/ui/latest.json and
 * .farplane/state/overview_surface.json.
 */

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_RUNTIME_SOURCES_PATH = path.join(
  REPO_ROOT,
  "farplane/dashboard-runtime-sources.json",
);

const DEFAULT_METRIC_IDS = [
  "x_views",
  "x_retention_score",
  "instagram_views",
  "instagram_retention_score",
  "ai_burn_24h",
];

function parseArgs(argv) {
  const result = { project: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (arg === "--project") {
      result.project = argv[index + 1] || result.project;
      index += 1;
    }
  }
  return result;
}

async function readJsonIfExists(filePath) {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function dashboardRuntimeSources() {
  const payload = await readJsonIfExists(DASHBOARD_RUNTIME_SOURCES_PATH);
  return Array.isArray(payload)
    ? payload.filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof entry.id === "string" &&
          typeof entry.label === "string" &&
          typeof entry.path === "string" &&
          (entry.kind === "file" || entry.kind === "directory"),
      )
    : [];
}

async function fileInfo(filePath) {
  const fileStat = await stat(filePath).catch(() => null);
  return {
    exists: Boolean(fileStat),
    updatedAtMs: fileStat?.mtimeMs ?? null,
  };
}

function parseSimpleFrontMatter(markdown) {
  if (!markdown.startsWith("---")) return {};
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return {};
  const frontMatter = markdown.slice(3, end).split(/\r?\n/g);
  const parsed = {};
  for (let index = 0; index < frontMatter.length; index += 1) {
    const line = frontMatter[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const rawValue = match[2].trim();
    const blockMode = rawValue.match(/^([>|])[-+]?$/)?.[1];
    if (blockMode) {
      const blockLines = [];
      while (frontMatter[index + 1]?.match(/^\s+/)) {
        index += 1;
        blockLines.push(frontMatter[index].replace(/^\s{2,}/, ""));
      }
      parsed[key] =
        blockMode === ">"
          ? blockLines.join("\n").replace(/([^\n])\n([^\n])/g, "$1 $2").trim()
          : blockLines.join("\n").trim();
      continue;
    }
    parsed[key] = rawValue.replace(/^["']|["']$/g, "");
  }
  return parsed;
}

function markdownWithoutFrontMatter(markdown) {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  return markdown.slice(end + 4).replace(/^\s+/, "");
}

function splitSummaryRows(summary) {
  return summary
    .split(/\n{2,}|\r?\n\s*[-*]\s+|\r?\n/g)
    .map((row) => row.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

function extractMarkdownSummaryRows(markdownBody) {
  const summaryLines = [];
  let inSummary = false;
  for (const line of markdownBody.split(/\r?\n/g)) {
    if (/^##\s+Summary\s*$/.test(line)) {
      inSummary = true;
      continue;
    }
    if (inSummary && /^##\s+/.test(line)) break;
    if (inSummary) summaryLines.push(line);
  }
  const summaryBody = summaryLines.join("\n").trim();
  if (!summaryBody) return [];
  const bulletRows = summaryBody
    .split(/\r?\n/g)
    .map((line) => line.match(/^-\s+(.+)$/)?.[1]?.trim() ?? "")
    .filter(Boolean);
  const rows = bulletRows.length > 0 ? bulletRows : splitSummaryRows(summaryBody);
  return rows.map((row) => row.replace(/`([^`]+)`/g, "$1").trim()).filter(Boolean);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function humanizeId(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractKpiIds(goalsMarkdown) {
  const ids = new Set(DEFAULT_METRIC_IDS);
  const kpiMatches = goalsMarkdown.matchAll(/^\s*-\s+([a-z][a-z0-9_]*(?:_[a-z0-9]+)*)\s*$/gim);
  for (const match of kpiMatches) ids.add(match[1]);
  for (const match of goalsMarkdown.matchAll(
    /\b([a-z]+_[a-z0-9_]*(?:score|views|followers|clicks|burn|hours|age|count))\b/g,
  )) {
    ids.add(match[1]);
  }
  return [...ids];
}

function readContentItems(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const items = Array.isArray(payload.content_items) ? payload.content_items : [];
  return items
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item : null))
    .filter(Boolean);
}

function metricValueFromItems(metricId, items) {
  const [platform, ...rest] = metricId.split("_");
  const metricName = rest.join("_");
  const matching = items.filter((item) => item.platform === platform);
  if (matching.length === 0) return null;
  if (metricName === "views") {
    return matching.reduce((total, item) => total + numberOrZero(item.content_metrics?.views), 0);
  }
  if (metricName === "retention_score") {
    const values = matching
      .map((item) => item.content_metrics?.retention_score)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }
  if (metricName === "engagements") {
    return matching.reduce(
      (total, item) => total + numberOrZero(item.content_metrics?.engagements),
      0,
    );
  }
  return null;
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function loadSocialItems(projectRoot) {
  const sources = [];
  const items = [];
  const socialSources = (await dashboardRuntimeSources()).filter((source) =>
    source.id.startsWith("social-"),
  );
  for (const source of socialSources) {
    const relativePath = source.path;
    const absolutePath = path.join(projectRoot, relativePath);
    const info = await fileInfo(absolutePath);
    const payload = info.exists ? await readJsonIfExists(absolutePath) : null;
    const contentItems = readContentItems(payload);
    sources.push({
      id: source.id,
      label: source.label,
      path: relativePath,
      exists: info.exists,
      updated_at_ms: info.updatedAtMs,
      item_count: contentItems.length,
    });
    items.push(...contentItems);
  }
  return { sources, items };
}

function buildMetricsSnapshot({ goalsMarkdown, socialItems }) {
  const snapshotDate = todayIsoDate();
  const metricIds = extractKpiIds(goalsMarkdown);
  const metrics = [];
  const sourceGaps = [];

  for (const metricId of metricIds) {
    const current = metricValueFromItems(metricId, socialItems);
    const platformSource = metricId.startsWith("instagram_")
      ? "instagram_content_metrics"
      : metricId.startsWith("x_")
        ? "x_content_metrics"
        : "local_runtime_metrics";
    if (current === null) {
      sourceGaps.push({
        metric_id: metricId,
        source_id: platformSource,
        reason: "no available observation for metric",
      });
    }
    metrics.push({
      metric_id: metricId,
      label: humanizeId(metricId),
      axis:
        metricId.startsWith("instagram_") || metricId.startsWith("x_")
          ? "distribution"
          : "operations",
      source_id: platformSource,
      status: current === null ? "source_gap" : "available",
      current,
      target: null,
      target_hit: null,
      aggregation: metricId.endsWith("_score") ? "average" : "sum",
      cumulative: !metricId.endsWith("_score"),
      display: current === null ? "n/a" : String(Math.round(current * 10) / 10),
      series:
        current === null
          ? []
          : [
              {
                date: snapshotDate,
                value: current,
                current,
                daily_diff: null,
                items: [],
              },
            ],
    });
  }

  return {
    snapshot_date: snapshotDate,
    generated_at: new Date().toISOString(),
    metrics,
    source_gaps: sourceGaps,
  };
}

async function newestReportLinks(projectRoot) {
  const reportsRoot = path.join(projectRoot, ".farplane/reports");
  const rows = [];
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const info = await fileInfo(absolutePath);
      const content = await readFile(absolutePath, "utf-8").catch(() => "");
      const frontMatter = parseSimpleFrontMatter(content);
      const summary = (frontMatter.summary || frontMatter.ui_summary || "").trim();
      const body = markdownWithoutFrontMatter(content);
      const bodySummaryRows = extractMarkdownSummaryRows(body);
      const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
      rows.push({
        id: relativePath,
        label: relativePath.split("/").slice(-2).join("/"),
        path: absolutePath,
        href: pathToFileHref(absolutePath),
        summary: summary || undefined,
        summary_rows: summary ? [summary] : bodySummaryRows,
        content: body,
        front_matter: frontMatter,
        created_at: frontMatter.created_at || undefined,
        updated_at_ms: info.updatedAtMs,
      });
    }
  }
  await visit(reportsRoot);
  return rows
    .sort((left, right) => (right.updated_at_ms ?? 0) - (left.updated_at_ms ?? 0))
    .slice(0, 6);
}

function pathToFileHref(filePath) {
  return `file://${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

function sourceRefs(projectRoot, socialSources) {
  return [
    {
      id: "goals",
      label: "goals.md",
      path: "farplane/goals.md",
    },
    {
      id: "metrics-ui",
      label: "Metrics UI snapshot",
      path: ".farplane/metrics/ui/latest.json",
    },
    {
      id: "reports",
      label: "Reports",
      path: ".farplane/reports",
    },
    ...socialSources,
  ].map(async (source) => {
    const absolutePath = path.join(projectRoot, source.path);
    const info = await fileInfo(absolutePath);
    return {
      ...source,
      exists: source.exists ?? info.exists,
      updated_at_ms: source.updated_at_ms ?? info.updatedAtMs,
    };
  });
}

function pinFromMetric(metric, priority) {
  return {
    id: metric.metric_id,
    label: metric.label,
    value: metric.display || "n/a",
    detail: metric.status === "available" ? "compiled metric observation" : "source gap",
    target: metric.axis || "KPI",
    provider: "metrics-ui",
    status: metric.status,
    priority,
    reason: metric.status === "available" ? "available compiled KPI" : "provider missing",
    card_kind: metric.metric_id.includes("burn")
      ? "cost"
      : metric.metric_id.endsWith("_score")
        ? "status"
        : "number",
  };
}

function buildOverviewSurface({ projectRoot, snapshot, reports, sources }) {
  const metricById = new Map(snapshot.metrics.map((metric) => [metric.metric_id, metric]));
  const preferredPins = ["ai_burn_24h", "x_views", "instagram_views", "x_retention_score"];
  const pins = preferredPins
    .map((metricId, index) =>
      metricById.get(metricId) ? pinFromMetric(metricById.get(metricId), index + 1) : null,
    )
    .filter(Boolean);
  for (const metric of snapshot.metrics) {
    if (pins.length >= 4) break;
    if (!pins.some((pin) => pin.id === metric.metric_id))
      pins.push(pinFromMetric(metric, pins.length + 1));
  }

  const attention = snapshot.source_gaps.slice(0, 8).map((gap) => ({
    id: `gap:${gap.metric_id}`,
    kind: "gap",
    title: gap.metric_id,
    attention_reason: gap.reason,
    owner: "system",
  }));

  return {
    generated_at: new Date().toISOString(),
    project_id: path.basename(projectRoot),
    pins: pins.slice(0, 4),
    attention,
    reports,
    sources,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.project);
  const goalsMarkdown = await readFile(path.join(projectRoot, "farplane/goals.md"), "utf-8").catch(
    () => "",
  );
  const social = await loadSocialItems(projectRoot);
  const snapshot = buildMetricsSnapshot({ goalsMarkdown, socialItems: social.items });
  const metricsPath = path.join(projectRoot, ".farplane/metrics/ui/latest.json");
  const overviewPath = path.join(projectRoot, ".farplane/state/overview_surface.json");
  await mkdir(path.dirname(metricsPath), { recursive: true });
  await writeFile(metricsPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  const reports = await newestReportLinks(projectRoot);
  const sources = await Promise.all(sourceRefs(projectRoot, social.sources));
  const overview = buildOverviewSurface({ projectRoot, snapshot, reports, sources });
  await mkdir(path.dirname(overviewPath), { recursive: true });
  await writeFile(overviewPath, `${JSON.stringify(overview, null, 2)}\n`);

  const result = {
    ok: true,
    metricsPath,
    overviewPath,
    metricCount: snapshot.metrics.length,
    sourceGapCount: snapshot.source_gaps.length,
    pinCount: overview.pins.length,
    attentionCount: overview.attention.length,
  };
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Wrote ${metricsPath}`);
    console.log(`Wrote ${overviewPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
