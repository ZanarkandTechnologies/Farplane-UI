/**
 * TEAM COMMANDS — CONVEX HTTP + HEARTBEAT RENDER
 * ================================================
 * Purpose
 * - Convex HTTP client helpers for retained agent status and activity.
 * - Heartbeat file rendering and syncing from workspace templates.
 *
 * KEY CONCEPTS:
 * - Convex endpoint resolution prefers shell env, then persisted Farplane runtime config in `farplane.json`.
 * - Heartbeat render helpers read canonical filesystem ticket counts.
 *
 * USAGE:
 * - postStatusReport({ agentId: "main", state: "planning", statusText: "Reviewing", stepKey: "..." })
 *
 * MEMORY REFERENCES:
 * - MEM-0212
 * - MEM-0213
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { firstFarplaneConfigValue, readFarplaneConfigValue } from "../runtime-config.js";
import { listProjectTickets } from "../project-ticket-store.js";
import {
  asRecord,
  resolveProjectOrFail,
  resolveAgentWorkspacePath,
  resolveOpenclawStateRoot,
  layeredHeartbeatTemplate,
  roleLabel,
  resourceAdvisories,
  resourcesSnapshot,
  type TicketActivityType,
  type CompanyModel,
  type CompanyAgentModel,
  type SidecarStore,
} from "./_shared.js";

// ─── Convex HTTP helpers ─────────────────────────────────────────────────────

function normalizeConvexSiteUrl(raw: string): string {
  if (!raw) {
    throw new Error(
      "missing_convex_site_url:set FARPLANE_CONVEX_SITE_URL or rerun farplane onboarding",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`invalid_convex_site_url:${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`invalid_convex_site_url_protocol:${parsed.protocol}`);
  }
  return parsed.href.replace(/\/+$/, "");
}

async function readPersistedConvexSiteUrl(): Promise<string> {
  const stateRoot = resolveOpenclawStateRoot();
  const farplaneConfigPath = path.join(stateRoot, "farplane.json");
  try {
    const raw = await readFile(farplaneConfigPath, "utf-8");
    const config = asRecord(JSON.parse(raw) as unknown);
    const convex = asRecord(config.convex);
    return typeof convex.siteUrl === "string" ? convex.siteUrl.trim() : "";
  } catch {
    return "";
  }
}

async function resolveConvexSiteUrl(): Promise<string> {
  const configuredRaw = firstFarplaneConfigValue(["FARPLANE_CONVEX_SITE_URL", "CONVEX_SITE_URL"]);
  if (configuredRaw) return normalizeConvexSiteUrl(configuredRaw);

  const persistedRaw = await readPersistedConvexSiteUrl();
  if (persistedRaw) return normalizeConvexSiteUrl(persistedRaw);

  throw new Error(
    "missing_convex_site_url:set FARPLANE_CONVEX_SITE_URL or rerun farplane onboarding",
  );
}

function classifyFetchFailure(error: unknown): string {
  const maybeRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };
  const errorRecord = maybeRecord(error);
  const causeRecord = maybeRecord(errorRecord?.cause);
  const code = (causeRecord?.code ?? errorRecord?.code ?? "") as string;
  if (code === "ECONNREFUSED") return "connection_refused";
  if (code === "ENOTFOUND") return "dns_not_found";
  if (code === "EAI_AGAIN") return "dns_lookup_failed";
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return "timeout";
  if (
    code.startsWith("ERR_TLS_") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ) {
    return "tls_error";
  }
  return "fetch_failed";
}

export async function postConvexJson(
  pathname: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const baseUrl = await resolveConvexSiteUrl();
  const endpoint = `${baseUrl}${pathname}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const telemetryToken = readFarplaneConfigValue("FARPLANE_TELEMETRY_TOKEN", { secret: true });
  if (telemetryToken) {
    headers["x-farplane-telemetry-token"] = telemetryToken;
    headers.authorization = `Bearer ${telemetryToken}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(`convex_http_request_failed:${classifyFetchFailure(error)}:url=${endpoint}`);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`convex_http_invalid_response:url=${endpoint}`);
  }
  if (!response.ok) {
    const responseRecord = body as Record<string, unknown>;
    const errorCode =
      typeof responseRecord.error === "string" ? responseRecord.error : `http_${response.status}`;
    throw new Error(`convex_http_request_rejected:${errorCode}:url=${endpoint}`);
  }
  return body as Record<string, unknown>;
}

export type TeamTimelineEventRow = {
  sourceType?: "agent_event";
  occurredAt?: number;
  agentId?: string;
  actorAgentId?: string;
  eventType?: string;
  activityType?: string;
  label?: string;
  detail?: string;
  taskId?: string;
  beatId?: string;
  stepKey?: string;
};

export async function getRecentTeamTimeline(payload: {
  projectId: string;
  teamId: string;
  limit?: number;
  agentId?: string;
}): Promise<TeamTimelineEventRow[]> {
  const body = await postConvexJson("/status/activity", {
    projectId: payload.projectId,
    teamId: payload.teamId,
    limit: payload.limit,
    agentId: payload.agentId,
  });
  const data = asRecord(body.data);
  return Array.isArray(data.events) ? (data.events as TeamTimelineEventRow[]) : [];
}

export async function postStatusReport(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    return await postConvexJson("/status/report", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("convex_http_", "status_report_"));
  }
}

export async function postActivityEvent(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    return await postConvexJson("/ingest", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("convex_http_", "activity_ingest_"));
  }
}

export async function tryLogCliActivity(payload: {
  projectId: string;
  teamId: string;
  actorAgentId?: string;
  activityType: TicketActivityType;
  label: string;
  detail?: string;
  source?: string;
  beatId?: string;
  ticketId?: string;
}): Promise<void> {
  const actorAgentId =
    payload.actorAgentId?.trim() || process.env.FARPLANE_ACTOR_AGENT_ID?.trim() || "agent-unknown";
  try {
    await postActivityEvent({
      projectId: payload.projectId,
      teamId: payload.teamId,
      agentId: actorAgentId,
      eventType: "activity_log",
      activityType: payload.activityType,
      actorType: "agent",
      label: payload.label,
      detail: payload.detail,
      taskId: payload.ticketId?.trim() || undefined,
      beatId:
        payload.beatId?.trim() && payload.beatId.trim().length > 0
          ? payload.beatId.trim()
          : undefined,
      stepKey: `cli-log-${actorAgentId}-${Date.now()}`,
      state:
        payload.activityType === "planning" ||
        payload.activityType === "executing" ||
        payload.activityType === "blocked"
          ? payload.activityType
          : undefined,
      skillId: payload.source?.trim() || "farplane_cli",
    });
  } catch {
    // Fire-and-forget sink: CLI sidecar mutations must still succeed even if Convex logging is unavailable.
  }
}

export async function readTicketSnapshot(projectPath: string | undefined): Promise<{
  openTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  tasksList: string;
}> {
  const resolvedProjectPath = projectPath?.trim();
  if (!resolvedProjectPath) {
    return { openTasks: 0, inProgressTasks: 0, blockedTasks: 0, tasksList: "[]" };
  }
  try {
    const rows = await listProjectTickets(resolvedProjectPath);
    const openTasks = rows.filter((row) => row.status === "todo").length;
    const inProgressTasks = rows.filter((row) => row.status === "in_progress").length;
    const blockedTasks = rows.filter((row) => row.status === "blocked").length;
    const tasksList = JSON.stringify(
      rows.slice(0, 12).map((row) => ({
        ticketId: row.ticketId,
        title: row.title,
        status: row.status,
        priority: row.priority,
        owner: row.claimedBy || row.owner,
      })),
    );
    return { openTasks, inProgressTasks, blockedTasks, tasksList };
  } catch {
    return { openTasks: 0, inProgressTasks: 0, blockedTasks: 0, tasksList: "[]" };
  }
}

// ─── Heartbeat render helpers ─────────────────────────────────────────────────

export async function renderBusinessHeartbeatTemplate(opts: {
  role: "biz_pm" | "biz_executor";
  project: CompanyModel["projects"][number];
}): Promise<string> {
  const templatePath = path.resolve(
    process.cwd(),
    "templates",
    "workspace",
    opts.role === "biz_pm" ? "HEARTBEAT-biz-pm.md" : "HEARTBEAT-biz-executor.md",
  );
  const template = await readFile(templatePath, "utf-8");
  const project = opts.project;
  const revenue = (project.ledger ?? [])
    .filter((entry) => entry.type === "revenue")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const costs = (project.ledger ?? [])
    .filter((entry) => entry.type === "cost")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const profit = revenue - costs;
  const experimentsSummary =
    project.experiments && project.experiments.length > 0
      ? project.experiments
          .slice(-3)
          .map((entry) => `${entry.hypothesis} (${entry.status})`)
          .join("; ")
      : "none";
  const recentMetrics =
    project.metricEvents && project.metricEvents.length > 0
      ? JSON.stringify(project.metricEvents[project.metricEvents.length - 1]?.metrics ?? {})
      : "none";
  const ticketSnapshot = await readTicketSnapshot(project.trackingContext);
  const replaceMap: Record<string, string> = {
    "{projectName}": project.name,
    "{businessType}": project.businessConfig?.type ?? "custom",
    "{projectGoal}": project.goal,
    "{totalRevenue}": String(revenue),
    "{totalCosts}": String(costs),
    "{profit}": String(profit),
    "{experimentsSummary}": experimentsSummary,
    "{recentMetrics}": recentMetrics,
    "{openTasks}": String(ticketSnapshot.openTasks),
    "{inProgressTasks}": String(ticketSnapshot.inProgressTasks),
    "{blockedTasks}": String(ticketSnapshot.blockedTasks),
    "{resourcesSnapshot}": resourcesSnapshot(project.resources ?? []),
    "{resourceAdvisories}": resourceAdvisories(project.resources ?? []),
    "{measureSkillId}": project.businessConfig?.slots.measure.skillId ?? "not-set",
    "{executeSkillId}": project.businessConfig?.slots.execute.skillId ?? "not-set",
    "{distributeSkillId}": project.businessConfig?.slots.distribute.skillId ?? "not-set",
    "{measureConfig}": JSON.stringify(project.businessConfig?.slots.measure.config ?? {}),
    "{executeConfig}": JSON.stringify(project.businessConfig?.slots.execute.config ?? {}),
    "{distributeConfig}": JSON.stringify(project.businessConfig?.slots.distribute.config ?? {}),
    "{tasksList}": ticketSnapshot.tasksList,
  };
  let rendered = template;
  for (const [needle, value] of Object.entries(replaceMap)) {
    rendered = rendered.split(needle).join(value);
  }
  return rendered;
}

export async function writeTeamHeartbeatFiles(opts: {
  store: SidecarStore;
  project: CompanyModel["projects"][number];
  agents: CompanyAgentModel[];
}): Promise<number> {
  const stateRoot = resolveOpenclawStateRoot();
  let written = 0;
  for (const agent of opts.agents) {
    const workspacePath = resolveAgentWorkspacePath(stateRoot, agent.agentId);
    const role = agent.role;
    const heartbeatContent =
      role === "biz_pm"
        ? await renderBusinessHeartbeatTemplate({ role: "biz_pm", project: opts.project })
        : role === "biz_executor"
          ? await renderBusinessHeartbeatTemplate({ role: "biz_executor", project: opts.project })
          : layeredHeartbeatTemplate(roleLabel(role), opts.project.name);
    await mkdir(workspacePath, { recursive: true });
    await writeFile(path.join(workspacePath, "HEARTBEAT.md"), heartbeatContent, "utf-8");
    written += 1;
  }
  return written;
}

export async function syncTeamHeartbeatFiles(opts: {
  store: SidecarStore;
  teamId?: string;
}): Promise<{ teamsTouched: number; heartbeatFilesWritten: number; teamsSkipped: number }> {
  const company = await opts.store.readCompanyModel();
  const targetProjects = opts.teamId
    ? [resolveProjectOrFail(company, opts.teamId).project]
    : company.projects;
  let teamsTouched = 0;
  let teamsSkipped = 0;
  let heartbeatFilesWritten = 0;
  for (const project of targetProjects) {
    const teamAgents = company.agents.filter((agent) => agent.projectId === project.id);
    if (teamAgents.length === 0) {
      teamsSkipped += 1;
      continue;
    }
    heartbeatFilesWritten += await writeTeamHeartbeatFiles({
      store: opts.store,
      project,
      agents: teamAgents,
    });
    teamsTouched += 1;
  }
  return { teamsTouched, heartbeatFilesWritten, teamsSkipped };
}

export async function ensureOpenclawHeartbeatScaffold(opts: {
  store: SidecarStore;
  agentIds: string[];
  cadenceMinutes?: number;
}): Promise<number> {
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const defaultsNode = asRecord(agentsNode.defaults);
  const defaultsHeartbeatNode = asRecord(defaultsNode.heartbeat);
  const list = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const targetAgentIds = new Set(opts.agentIds);
  const cadence = `${Math.max(1, opts.cadenceMinutes ?? 3)}m`;
  let touched = 0;
  const nextList = list.map((entry) => {
    const row = asRecord(entry);
    const id = typeof row.id === "string" ? row.id : "";
    if (!id || !targetAgentIds.has(id)) return row;
    const heartbeat = asRecord(row.heartbeat);
    touched += 1;
    return { ...row, heartbeat: { ...heartbeat, every: cadence } };
  });

  const hooksNode = asRecord(config.hooks);
  const internalHooksNode = asRecord(hooksNode.internal);
  const hookEntriesNode = asRecord(internalHooksNode.entries);
  const farplaneStatusNode = asRecord(hookEntriesNode["farplane-status"]);

  const nextConfig = {
    ...config,
    hooks: {
      ...hooksNode,
      internal: {
        ...internalHooksNode,
        enabled: true,
        entries: {
          ...hookEntriesNode,
          "farplane-status": { ...farplaneStatusNode, enabled: true },
        },
      },
    },
    agents: {
      ...agentsNode,
      defaults: {
        ...defaultsNode,
        heartbeat: {
          ...defaultsHeartbeatNode,
          every: cadence,
          includeReasoning: true,
          target: "last",
          prompt: "Read HEARTBEAT.md and follow it exactly. End your response with HEARTBEAT_OK.",
        },
      },
      list: nextList,
    },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
  return touched;
}
