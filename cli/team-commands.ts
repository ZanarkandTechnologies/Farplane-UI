/**
 * TEAM COMMANDS
 * =============
 * Purpose
 * - Implement team lifecycle commands for ShellCorp CEO operations.
 *
 * KEY CONCEPTS:
 * - Team ID maps to project ID as `team-<projectId>`.
 * - Team metadata mutates company sidecar and optional office cluster metadata.
 *
 * USAGE:
 * - shellcorp team create --name "Alpha" --description "..." --goal "..."
 * - shellcorp doctor team-data
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 */
import { Command } from "commander";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  createSidecarStore,
  type AgentRole,
  type BusinessConfigModel,
  type CapabilitySlotModel,
  type CompanyAgentModel,
  type CompanyModel,
  type HeartbeatProfileModel,
  type OfficeObjectModel,
  type ProjectResourceModel,
  type ResourceEventModel,
  type ResourceType,
  type RoleSlotModel,
  type SpawnPolicy,
} from "./sidecar-store.js";

type OutputMode = "text" | "json";
type TeamRole = "builder" | "growth_marketer" | "pm";
type BusinessTeamRole = "biz_pm" | "biz_executor";
type BusinessType = "affiliate_marketing" | "content_creator" | "saas" | "custom";
type CapabilityCategory = "measure" | "execute" | "distribute";
type ResourceKind = ResourceType;
type ResourceEventKind = "refresh" | "consumption" | "adjustment";
type ConfigEntry = [string, string];

interface TeamSummary {
  teamId: string;
  projectId: string;
  name: string;
  status: string;
  goal: string;
  kpis: string[];
  businessType?: string;
}

type OpenclawAgentEntry = Record<string, unknown> & {
  id: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, {
      encoding: "utf-8",
      flag: "wx",
    });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code !== "EEXIST") throw error;
  }
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKpis(values: string[]): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    const next = value.trim();
    if (next) deduped.add(next);
  }
  return [...deduped];
}

function projectIdFromTeamId(teamId: string): string {
  const trimmed = teamId.trim();
  if (!trimmed.startsWith("team-")) fail(`invalid_team_id: ${teamId}`);
  return trimmed.slice("team-".length);
}

function teamIdFromProjectId(projectId: string): string {
  return `team-${projectId}`;
}

function collectValue(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseRoles(raw: string): TeamRole[] {
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const out: TeamRole[] = [];
  for (const role of parsed) {
    if (role !== "builder" && role !== "growth_marketer" && role !== "pm") {
      fail(`invalid_role: ${role}`);
    }
    out.push(role);
  }
  return [...new Set(out)];
}

function parseBusinessType(raw: string): BusinessType {
  if (raw === "affiliate_marketing" || raw === "content_creator" || raw === "saas" || raw === "custom") {
    return raw;
  }
  fail(`invalid_business_type: ${raw}`);
}

function parseResourceKind(raw: string): ResourceKind {
  if (raw === "cash_budget" || raw === "api_quota" || raw === "distribution_slots" || raw === "custom") return raw;
  fail(`invalid_resource_type: ${raw}`);
}

function parseResourceEventKind(raw: string): ResourceEventKind {
  if (raw === "refresh" || raw === "consumption" || raw === "adjustment") return raw;
  fail(`invalid_resource_event_kind: ${raw}`);
}

function parseCapabilityCategory(raw: string): CapabilityCategory {
  if (raw === "measure" || raw === "execute" || raw === "distribute") return raw;
  fail(`invalid_slot: ${raw}`);
}

function parseRoleSlotRole(raw: string): Exclude<AgentRole, "ceo"> {
  if (raw === "builder" || raw === "growth_marketer" || raw === "pm" || raw === "biz_pm" || raw === "biz_executor") {
    return raw;
  }
  fail(`invalid_role: ${raw}`);
}

function parseConfigJson(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("invalid_config_json_object");
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    fail("invalid_config_json");
  }
}

function collectConfigEntry(value: string, previous: ConfigEntry[]): ConfigEntry[] {
  const trimmed = value.trim();
  if (!trimmed) return previous;
  const splitIndex = trimmed.indexOf("=");
  if (splitIndex <= 0) fail(`invalid_config_entry:${value}`);
  const key = trimmed.slice(0, splitIndex).trim();
  const entryValue = trimmed.slice(splitIndex + 1).trim();
  if (!key) fail(`invalid_config_entry:${value}`);
  return [...previous, [key, entryValue]];
}

function normalizeConfigEntries(entries: ConfigEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of entries) out[key] = value;
  return out;
}

function parseSpawnPolicy(raw: string): SpawnPolicy {
  if (raw === "manual") return "manual";
  if (raw === "queue_pressure") return "queue_pressure";
  fail(`invalid_spawn_policy: ${raw}`);
}

function resolveProjectOrFail(company: CompanyModel, teamId: string) {
  const projectId = projectIdFromTeamId(teamId);
  const project = company.projects.find((entry) => entry.id === projectId);
  if (!project) fail(`team_not_found: ${teamId}`);
  return { projectId, project };
}

function upsertTeamCluster(
  officeObjects: OfficeObjectModel[],
  input: { teamId: string; name: string; description: string },
): OfficeObjectModel[] {
  const existingIndex = officeObjects.findIndex(
    (object) => object.meshType === "team-cluster" && object.metadata?.teamId === input.teamId,
  );
  if (existingIndex === -1) {
    return [
      ...officeObjects,
      {
        id: `team-cluster-${input.teamId}`,
        identifier: `team-cluster-${input.teamId}`,
        meshType: "team-cluster",
        position: [0, 0, 8],
        rotation: [0, 0, 0],
        metadata: {
          teamId: input.teamId,
          name: input.name,
          description: input.description,
          services: [],
        },
      },
    ];
  }
  const next = [...officeObjects];
  const existing = next[existingIndex];
  next[existingIndex] = {
    ...existing,
    metadata: {
      ...(existing.metadata ?? {}),
      teamId: input.teamId,
      name: input.name,
      description: input.description,
    },
  };
  return next;
}

function formatOutput<T>(mode: OutputMode, payload: T, text: string): void {
  if (mode === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(text);
}

function buildTeamSummaries(company: CompanyModel): TeamSummary[] {
  return company.projects.map((project) => ({
    teamId: teamIdFromProjectId(project.id),
    projectId: project.id,
    name: project.name,
    status: project.status,
    goal: project.goal,
    kpis: project.kpis,
    ...(project.businessConfig ? { businessType: project.businessConfig.type } : {}),
  }));
}

function ensureHeartbeatProfile(company: CompanyModel, projectId: string): { company: CompanyModel; profileId: string } {
  const profileId = `hb-team-${projectId}`;
  const existing = company.heartbeatProfiles.find((entry) => entry.id === profileId);
  if (existing) return { company, profileId };
  const fallback = company.heartbeatProfiles.find((entry) => entry.id === "hb-pm");
  const profile: HeartbeatProfileModel = {
    id: profileId,
    role: "pm",
    cadenceMinutes: fallback?.cadenceMinutes ?? 10,
    teamDescription: fallback?.teamDescription ?? "",
    productDetails: fallback?.productDetails ?? "",
    goal: fallback?.goal ?? "",
  };
  return {
    company: { ...company, heartbeatProfiles: [...company.heartbeatProfiles, profile] },
    profileId,
  };
}

function defaultHeartbeatProfileForRole(role: TeamRole): string {
  if (role === "builder") return "hb-builder";
  if (role === "growth_marketer") return "hb-growth";
  return "hb-pm";
}

function defaultHeartbeatProfileForBusinessRole(role: BusinessTeamRole): string {
  return role === "biz_pm" ? "hb-biz-pm" : "hb-biz-executor";
}

function resolveAgentWorkspacePath(stateRoot: string, agentId: string): string {
  return path.join(stateRoot, `workspace-${agentId}`);
}

function roleLabel(role: AgentRole): string {
  if (role === "biz_pm") return "Business PM";
  if (role === "biz_executor") return "Business Executor";
  if (role === "growth_marketer") return "Growth Marketer";
  return role[0].toUpperCase() + role.slice(1);
}

function defaultBusinessConfig(type: BusinessType): BusinessConfigModel {
  return {
    type,
    slots: {
      measure: {
        skillId: "amazon-affiliate-metrics",
        category: "measure",
        config: type === "affiliate_marketing" ? { platform: "amazon_associates" } : {},
      },
      execute: {
        skillId: "video-generator",
        category: "execute",
        config: {},
      },
      distribute: {
        skillId: "tiktok-poster",
        category: "distribute",
        config: {},
      },
    },
  };
}

function defaultProjectResources(projectId: string): ProjectResourceModel[] {
  return [
    {
      id: `${projectId}:cash`,
      projectId,
      type: "cash_budget",
      name: "Cash Budget",
      unit: "usd_cents",
      remaining: 5000,
      limit: 5000,
      reserved: 0,
      trackerSkillId: "resource-cash-tracker",
      refreshCadenceMinutes: 15,
      policy: { advisoryOnly: true, softLimit: 1500, hardLimit: 0, whenLow: "deprioritize_expensive_tasks" },
      metadata: { currency: "USD" },
    },
    {
      id: `${projectId}:api`,
      projectId,
      type: "api_quota",
      name: "API Quota",
      unit: "requests",
      remaining: 1000,
      limit: 1000,
      reserved: 0,
      trackerSkillId: "resource-api-quota-tracker",
      refreshCadenceMinutes: 15,
      policy: { advisoryOnly: true, softLimit: 200, hardLimit: 0, whenLow: "warn" },
    },
    {
      id: `${projectId}:distribution`,
      projectId,
      type: "distribution_slots",
      name: "Distribution Slots",
      unit: "posts_per_day",
      remaining: 10,
      limit: 10,
      reserved: 0,
      trackerSkillId: "resource-distribution-tracker",
      refreshCadenceMinutes: 60,
      policy: { advisoryOnly: true, softLimit: 2, hardLimit: 0, whenLow: "ask_pm_review" },
      metadata: { platform: "tiktok" },
    },
  ];
}

function defaultResourceId(projectId: string, type: ResourceKind): string {
  if (type === "cash_budget") return `${projectId}:cash`;
  if (type === "api_quota") return `${projectId}:api`;
  if (type === "distribution_slots") return `${projectId}:distribution`;
  return `${projectId}:custom`;
}

function ensureProjectResources(project: CompanyModel["projects"][number]): CompanyModel["projects"][number] {
  if (Array.isArray(project.resources) && project.resources.length > 0) return project;
  return {
    ...project,
    resources: defaultProjectResources(project.id),
    resourceEvents: Array.isArray(project.resourceEvents) ? project.resourceEvents : [],
  };
}

function ensureBusinessHeartbeatProfiles(company: CompanyModel): CompanyModel {
  const missingPm = !company.heartbeatProfiles.some((profile) => profile.id === "hb-biz-pm");
  const missingExecutor = !company.heartbeatProfiles.some((profile) => profile.id === "hb-biz-executor");
  if (!missingPm && !missingExecutor) return company;
  const nextProfiles = [...company.heartbeatProfiles];
  if (missingPm) {
    nextProfiles.push({
      id: "hb-biz-pm",
      role: "biz_pm",
      cadenceMinutes: 5,
      teamDescription: "Business PM loop",
      productDetails: "Review KPIs, manage kanban, track profitability",
      goal: "Keep business net-positive with clear executor tasks",
    });
  }
  if (missingExecutor) {
    nextProfiles.push({
      id: "hb-biz-executor",
      role: "biz_executor",
      cadenceMinutes: 5,
      teamDescription: "Business execution loop",
      productDetails: "Execute highest-value tasks, distribute outputs, report metrics",
      goal: "Deliver measurable growth output every heartbeat",
    });
  }
  return { ...company, heartbeatProfiles: nextProfiles };
}

function buildAutoAgents(projectId: string, slug: string, roles: TeamRole[]): CompanyAgentModel[] {
  return roles.map((role) => ({
    agentId: `${slug}-${role.replace("_marketer", "")}`,
    role,
    projectId,
    heartbeatProfileId: defaultHeartbeatProfileForRole(role),
    isCeo: false,
    lifecycleState: "pending_spawn",
  }));
}

function buildAutoRoleSlots(projectId: string, roles: TeamRole[]): RoleSlotModel[] {
  return roles.map((role) => ({
    projectId,
    role,
    desiredCount: 1,
    spawnPolicy: "queue_pressure",
  }));
}

function buildBusinessRoleSlots(projectId: string): RoleSlotModel[] {
  return [
    {
      projectId,
      role: "biz_pm",
      desiredCount: 1,
      spawnPolicy: "queue_pressure",
    },
    {
      projectId,
      role: "biz_executor",
      desiredCount: 1,
      spawnPolicy: "queue_pressure",
    },
  ];
}

function buildBusinessAgents(projectId: string, slug: string): CompanyAgentModel[] {
  return [
    {
      agentId: `${slug}-pm`,
      role: "biz_pm",
      projectId,
      heartbeatProfileId: defaultHeartbeatProfileForBusinessRole("biz_pm"),
      isCeo: false,
      lifecycleState: "pending_spawn",
    },
    {
      agentId: `${slug}-executor`,
      role: "biz_executor",
      projectId,
      heartbeatProfileId: defaultHeartbeatProfileForBusinessRole("biz_executor"),
      isCeo: false,
      lifecycleState: "pending_spawn",
    },
  ];
}

async function copyBusinessHeartbeatTemplates(agentIds: string[]): Promise<void> {
  const stateRoot = process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
  const templatesRoot = path.resolve(process.cwd(), "templates", "workspace");
  const pmTemplatePath = path.join(templatesRoot, "HEARTBEAT-biz-pm.md");
  const executorTemplatePath = path.join(templatesRoot, "HEARTBEAT-biz-executor.md");
  let pmTemplate: string | null = null;
  let executorTemplate: string | null = null;
  try {
    pmTemplate = await readFile(pmTemplatePath, "utf-8");
    executorTemplate = await readFile(executorTemplatePath, "utf-8");
  } catch {
    return;
  }
  for (const agentId of agentIds) {
    const workspacePath = resolveAgentWorkspacePath(stateRoot, agentId);
    const isPm = /-pm$/.test(agentId);
    const template = isPm ? pmTemplate : executorTemplate;
    if (!template) continue;
    try {
      await mkdir(workspacePath, { recursive: true });
      await writeFile(path.join(workspacePath, "HEARTBEAT.md"), template, "utf-8");
    } catch {
      // best-effort copy; creation should not fail because of filesystem template write
    }
  }
}

async function upsertBusinessCronJobs(projectId: string, agentIds: string[]): Promise<void> {
  const stateRoot = process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
  const cronDir = path.join(stateRoot, "cron");
  const cronPath = path.join(cronDir, "jobs.json");
  let currentJobs: unknown[] = [];
  try {
    const raw = await readFile(cronPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) currentJobs = parsed;
  } catch {
    currentJobs = [];
  }

  const existingById = new Map<string, Record<string, unknown>>();
  for (const row of currentJobs) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    if (!id) continue;
    existingById.set(id, obj);
  }

  const now = Date.now();
  for (const agentId of agentIds) {
    const isPm = /-pm$/.test(agentId);
    const jobId = `biz-heartbeat-${projectId}-${isPm ? "pm" : "executor"}`;
    const payloadMessage = isPm
      ? "Read HEARTBEAT.md, review KPIs and P&L, reprioritize kanban tasks, and return HEARTBEAT_OK."
      : "Read HEARTBEAT.md, execute the highest-priority business task, and return HEARTBEAT_OK.";
    existingById.set(jobId, {
      id: jobId,
      agentId,
      name: `Business heartbeat (${isPm ? "PM" : "Executor"}) ${projectId}`,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "every", everyMs: 180000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: payloadMessage,
      },
      delivery: {
        mode: "none",
      },
    });
  }

  await mkdir(cronDir, { recursive: true });
  await writeFile(cronPath, `${JSON.stringify([...existingById.values()], null, 2)}\n`, "utf-8");
}

async function ensureWorkspaceWithBootstrap(opts: {
  stateRoot: string;
  agent: CompanyAgentModel;
  projectName: string;
}): Promise<void> {
  const workspacePath = resolveAgentWorkspacePath(opts.stateRoot, opts.agent.agentId);
  await mkdir(workspacePath, { recursive: true });
  const templatesRoot = path.resolve(process.cwd(), "templates", "workspace");
  const defaultAgents = `# AGENTS\n\nRole: ${roleLabel(opts.agent.role)}\nProject: ${opts.projectName}\n\n- Follow HEARTBEAT.md for current operating loop.\n- Keep actions reversible and explicit.\n`;
  const defaultSoul = `# SOUL\n\nYou are the ${roleLabel(opts.agent.role)} for project "${opts.projectName}".\nAct with clarity, speed, and measurable outcomes.\n`;
  const defaultHeartbeat = `You are the ${roleLabel(opts.agent.role)} for the project "${opts.projectName}".\nRead this workspace context before each heartbeat and return HEARTBEAT_OK after a concrete update.\n`;

  const agentsTemplatePath =
    opts.agent.role === "biz_pm"
      ? path.join(templatesRoot, "AGENTS-biz-pm.md")
      : opts.agent.role === "biz_executor"
        ? path.join(templatesRoot, "AGENTS-biz-executor.md")
        : "";
  const soulTemplatePath =
    opts.agent.role === "biz_pm"
      ? path.join(templatesRoot, "SOUL-biz-pm.md")
      : opts.agent.role === "biz_executor"
        ? path.join(templatesRoot, "SOUL-biz-executor.md")
        : "";

  let agentsTemplate = defaultAgents;
  if (agentsTemplatePath) {
    try {
      agentsTemplate = await readFile(agentsTemplatePath, "utf-8");
    } catch {
      agentsTemplate = defaultAgents;
    }
  }

  let soulTemplate = defaultSoul;
  if (soulTemplatePath) {
    try {
      soulTemplate = await readFile(soulTemplatePath, "utf-8");
    } catch {
      soulTemplate = defaultSoul;
    }
  }

  await writeFileIfMissing(path.join(workspacePath, "AGENTS.md"), agentsTemplate);
  await writeFileIfMissing(path.join(workspacePath, "SOUL.md"), soulTemplate);
  await writeFileIfMissing(path.join(workspacePath, "TOOLS.md"), "# TOOLS\n");
  await writeFileIfMissing(path.join(workspacePath, "IDENTITY.md"), `# IDENTITY\n\n- agentId: ${opts.agent.agentId}\n`);
  await writeFileIfMissing(path.join(workspacePath, "USER.md"), "# USER\n");
  await writeFileIfMissing(path.join(workspacePath, "HEARTBEAT.md"), defaultHeartbeat);
}

async function provisionOpenclawAgents(opts: {
  store: ReturnType<typeof createSidecarStore>;
  agents: CompanyAgentModel[];
  projectName: string;
}): Promise<void> {
  if (opts.agents.length === 0) return;
  const stateRoot = process.env.OPENCLAW_STATE_DIR?.trim()
    ? path.resolve(process.env.OPENCLAW_STATE_DIR.trim())
    : path.join(process.env.HOME || "", ".openclaw");
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const existingIds = new Set(
    currentList
      .map((entry) => asRecord(entry).id)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );

  for (const agent of opts.agents) {
    await ensureWorkspaceWithBootstrap({
      stateRoot,
      agent,
      projectName: opts.projectName,
    });
    await mkdir(path.join(stateRoot, "agents", agent.agentId, "sessions"), { recursive: true });
    if (existingIds.has(agent.agentId)) continue;
    const entry: OpenclawAgentEntry = {
      id: agent.agentId,
      name: `${opts.projectName} ${roleLabel(agent.role)}`,
      workspace: resolveAgentWorkspacePath(stateRoot, agent.agentId),
      agentDir: path.join(stateRoot, "agents", agent.agentId, "agent"),
    };
    currentList.push(entry);
    existingIds.add(agent.agentId);
  }

  const nextConfig = {
    ...config,
    agents: {
      ...agentsNode,
      list: currentList,
    },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
}

async function deregisterOpenclawAgents(opts: {
  store: ReturnType<typeof createSidecarStore>;
  agentIds: string[];
}): Promise<void> {
  if (opts.agentIds.length === 0) return;
  const config = await opts.store.readOpenclawConfig();
  const agentsNode = asRecord(config.agents);
  const currentList = Array.isArray(agentsNode.list) ? [...agentsNode.list] : [];
  const removeSet = new Set(opts.agentIds);
  const nextList = currentList.filter((entry) => {
    const id = asRecord(entry).id;
    return !(typeof id === "string" && removeSet.has(id));
  });
  const nextConfig = {
    ...config,
    agents: {
      ...agentsNode,
      list: nextList,
    },
  } as Record<string, unknown>;
  await opts.store.writeOpenclawConfig(nextConfig);
}

function runDoctor(company: CompanyModel): string[] {
  const issues: string[] = [];
  const projectIds = new Set(company.projects.map((project) => project.id));
  const heartbeatIds = new Set(company.heartbeatProfiles.map((profile) => profile.id));
  const seenProjects = new Set<string>();
  for (const project of company.projects) {
    if (seenProjects.has(project.id)) issues.push(`duplicate_project_id:${project.id}`);
    seenProjects.add(project.id);
  }
  const seenAgents = new Set<string>();
  for (const agent of company.agents) {
    if (seenAgents.has(agent.agentId)) issues.push(`duplicate_agent_id:${agent.agentId}`);
    seenAgents.add(agent.agentId);
    if (agent.projectId && !projectIds.has(agent.projectId)) issues.push(`agent_project_missing:${agent.agentId}:${agent.projectId}`);
    if (!heartbeatIds.has(agent.heartbeatProfileId)) {
      issues.push(`agent_heartbeat_missing:${agent.agentId}:${agent.heartbeatProfileId}`);
    }
  }
  for (const slot of company.roleSlots) {
    if (!projectIds.has(slot.projectId)) issues.push(`role_slot_project_missing:${slot.projectId}:${slot.role}`);
  }
  for (const project of company.projects) {
    const resourceIds = new Set<string>();
    const resources = project.resources ?? [];
    for (const resource of resources) {
      if (resourceIds.has(resource.id)) issues.push(`duplicate_project_resource_id:${project.id}:${resource.id}`);
      resourceIds.add(resource.id);
      if (!resource.trackerSkillId.trim()) issues.push(`resource_tracker_missing:${project.id}:${resource.id}`);
      if (resource.limit < 0) issues.push(`resource_limit_negative:${project.id}:${resource.id}:${resource.limit}`);
      if (resource.remaining > resource.limit) {
        issues.push(`resource_remaining_over_limit:${project.id}:${resource.id}:${resource.remaining}:${resource.limit}`);
      }
    }
    for (const event of project.resourceEvents ?? []) {
      if (!resourceIds.has(event.resourceId)) {
        issues.push(`resource_event_missing_resource:${project.id}:${event.id}:${event.resourceId}`);
      }
    }
  }
  return issues;
}

function resourceAdvisories(resources: CompanyModel["projects"][number]["resources"]): string {
  if (!resources || resources.length === 0) return "none";
  const notes: string[] = [];
  for (const resource of resources) {
    const softLimit = resource.policy.softLimit;
    const hardLimit = resource.policy.hardLimit;
    if (typeof hardLimit === "number" && resource.remaining <= hardLimit) {
      notes.push(`${resource.name}: hard-limit reached -> ${resource.policy.whenLow}`);
      continue;
    }
    if (typeof softLimit === "number" && resource.remaining <= softLimit) {
      notes.push(`${resource.name}: low -> ${resource.policy.whenLow}`);
    }
  }
  return notes.length > 0 ? notes.join("; ") : "none";
}

function resourcesSnapshot(resources: CompanyModel["projects"][number]["resources"]): string {
  if (!resources || resources.length === 0) return "none";
  return resources
    .map((resource) => `${resource.name}=${resource.remaining}/${resource.limit} ${resource.unit}`)
    .join(" | ");
}

async function renderBusinessHeartbeatTemplate(opts: {
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
  const tasksList = "[]";
  const replaceMap: Record<string, string> = {
    "{projectName}": project.name,
    "{businessType}": project.businessConfig?.type ?? "custom",
    "{projectGoal}": project.goal,
    "{totalRevenue}": String(revenue),
    "{totalCosts}": String(costs),
    "{profit}": String(profit),
    "{experimentsSummary}": experimentsSummary,
    "{recentMetrics}": recentMetrics,
    "{openTasks}": "0",
    "{inProgressTasks}": "0",
    "{blockedTasks}": "0",
    "{resourcesSnapshot}": resourcesSnapshot(project.resources ?? []),
    "{resourceAdvisories}": resourceAdvisories(project.resources ?? []),
    "{measureSkillId}": project.businessConfig?.slots.measure.skillId ?? "not-set",
    "{executeSkillId}": project.businessConfig?.slots.execute.skillId ?? "not-set",
    "{distributeSkillId}": project.businessConfig?.slots.distribute.skillId ?? "not-set",
    "{measureConfig}": JSON.stringify(project.businessConfig?.slots.measure.config ?? {}),
    "{executeConfig}": JSON.stringify(project.businessConfig?.slots.execute.config ?? {}),
    "{distributeConfig}": JSON.stringify(project.businessConfig?.slots.distribute.config ?? {}),
    "{tasksList}": tasksList,
  };
  let rendered = template;
  for (const [needle, value] of Object.entries(replaceMap)) {
    rendered = rendered.split(needle).join(value);
  }
  return rendered;
}

export function registerTeamCommands(program: Command): void {
  const store = createSidecarStore();
  const team = program.command("team").description("Manage team entities mapped to company projects");

  team
    .command("list")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const company = await store.readCompanyModel();
      const summaries = buildTeamSummaries(company);
      if (opts.json) {
        console.log(JSON.stringify({ teams: summaries }, null, 2));
        return;
      }
      if (summaries.length === 0) {
        console.log("No teams found.");
        return;
      }
      const lines = summaries.map((entry) => `${entry.teamId} | ${entry.name} | ${entry.status} | KPIs=${entry.kpis.length}`);
      console.log(lines.join("\n"));
    });

  team
    .command("create")
    .requiredOption("--name <name>", "Team display name")
    .requiredOption("--description <description>", "Team description")
    .requiredOption("--goal <goal>", "Team goal")
    .option("--kpi <kpi>", "KPI identifier (repeatable)", collectValue, [] as string[])
    .option("--team-id <teamId>", "Override team id (team-*)")
    .option("--auto-roles <roles>", "Comma-separated role list (builder,pm,growth_marketer)")
    .option("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .option("--with-cluster", "Create/update team-cluster metadata in office-objects sidecar", false)
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        name: string;
        description: string;
        goal: string;
        kpi: string[];
        teamId?: string;
        autoRoles?: string;
        businessType?: string;
        withCluster?: boolean;
        json?: boolean;
      }) => {
        const businessType = opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : undefined;
        let company = await store.readCompanyModel();
        if (businessType) {
          company = ensureBusinessHeartbeatProfiles(company);
        }
        const slug = toSlug(opts.name) || `${Date.now()}`;
        const teamId = opts.teamId?.trim() || `team-proj-${slug}`;
        const projectId = projectIdFromTeamId(teamId);
        if (company.projects.some((entry) => entry.id === projectId)) {
          fail(`team_exists:${teamId}`);
        }
        const kpis = normalizeKpis(opts.kpi);
        const project = {
          id: projectId,
          departmentId: company.departments[1]?.id ?? company.departments[0]?.id ?? "dept-products",
          name: opts.name.trim(),
          githubUrl: "",
          status: "active" as const,
          goal: opts.goal.trim(),
          kpis,
          ...(businessType ? { businessConfig: defaultBusinessConfig(businessType) } : {}),
          ledger: [],
          experiments: [],
          metricEvents: [],
          resources: businessType ? defaultProjectResources(projectId) : [],
          resourceEvents: [],
        };
        let nextCompany: CompanyModel = {
          ...company,
          projects: [...company.projects, project],
        };
        let createdAgents: CompanyAgentModel[] = [];
        if (businessType) {
          const businessAgents = buildBusinessAgents(projectId, toSlug(project.name) || slug);
          createdAgents = businessAgents;
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildBusinessRoleSlots(projectId)],
            agents: [...nextCompany.agents, ...businessAgents],
          };
          await copyBusinessHeartbeatTemplates(businessAgents.map((agent) => agent.agentId));
          await upsertBusinessCronJobs(projectId, businessAgents.map((agent) => agent.agentId));
        } else if (opts.autoRoles?.trim()) {
          const roles = parseRoles(opts.autoRoles);
          createdAgents = buildAutoAgents(projectId, toSlug(project.name) || slug, roles);
          nextCompany = {
            ...nextCompany,
            roleSlots: [...nextCompany.roleSlots, ...buildAutoRoleSlots(projectId, roles)],
            agents: [...nextCompany.agents, ...createdAgents],
          };
        }
        await store.writeCompanyModel(nextCompany);
        await provisionOpenclawAgents({
          store,
          agents: createdAgents,
          projectName: project.name,
        });
        if (opts.withCluster) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId,
            name: project.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(opts.json ? "json" : "text", { ok: true, teamId, projectId }, `Created ${teamId} -> ${projectId}`);
      },
    );

  team
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--name <name>", "New name")
    .option("--description <description>", "New description (stored in team cluster metadata if present)")
    .option("--goal <goal>", "New team goal")
    .option("--kpi-add <kpi>", "Add KPI (repeatable)", collectValue, [] as string[])
    .option("--kpi-remove <kpi>", "Remove KPI (repeatable)", collectValue, [] as string[])
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        name?: string;
        description?: string;
        goal?: string;
        kpiAdd: string[];
        kpiRemove: string[];
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const removeSet = new Set(normalizeKpis(opts.kpiRemove));
        const addKpis = normalizeKpis(opts.kpiAdd);
        const nextKpis = normalizeKpis([...project.kpis.filter((item) => !removeSet.has(item)), ...addKpis]);
        const nextProject = {
          ...project,
          name: opts.name?.trim() ? opts.name.trim() : project.name,
          goal: opts.goal?.trim() ? opts.goal.trim() : project.goal,
          kpis: nextKpis,
        };
        const nextCompany: CompanyModel = {
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        };
        await store.writeCompanyModel(nextCompany);

        if (opts.description?.trim()) {
          const officeObjects = await store.readOfficeObjects();
          const nextObjects = upsertTeamCluster(officeObjects, {
            teamId: opts.teamId.trim(),
            name: nextProject.name,
            description: opts.description.trim(),
          });
          await store.writeOfficeObjects(nextObjects);
        }
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, kpis: nextKpis },
          `Updated ${opts.teamId}`,
        );
      },
    );

  team
    .command("archive")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--deregister-openclaw", "Remove archived team agents from openclaw.json agents.list", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; deregisterOpenclaw?: boolean; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const archivedAgentIds = company.agents.filter((agent) => agent.projectId === projectId).map((agent) => agent.agentId);
      const nextCompany: CompanyModel = {
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...project,
                status: "archived",
              }
            : entry,
        ),
        roleSlots: company.roleSlots.map((slot) =>
          slot.projectId === projectId
            ? {
                ...slot,
                desiredCount: 0,
              }
            : slot,
        ),
        agents: company.agents.map((agent) =>
          agent.projectId === projectId
            ? {
                ...agent,
                lifecycleState: "retired",
              }
            : agent,
        ),
      };
      await store.writeCompanyModel(nextCompany);
      if (opts.deregisterOpenclaw) {
        await deregisterOpenclawAgents({
          store,
          agentIds: archivedAgentIds,
        });
      }
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId }, `Archived ${opts.teamId}`);
    });

  const roleSlot = team.command("role-slot").description("Manage team role slots");
  roleSlot
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: builder|pm|growth_marketer|biz_pm|biz_executor")
    .requiredOption("--desired-count <count>", "Desired count", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_desired_count:${value}`);
      return parsed;
    })
    .option("--spawn-policy <policy>", "queue_pressure|manual", "queue_pressure")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        role: string;
        desiredCount: number;
        spawnPolicy: string;
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId)) fail(`team_not_found:${opts.teamId}`);
        const role = parseRoleSlotRole(opts.role);
        const spawnPolicy = parseSpawnPolicy(opts.spawnPolicy);
        const nextRoleSlots = company.roleSlots.filter((slot) => !(slot.projectId === projectId && slot.role === role));
        nextRoleSlots.push({
          projectId,
          role,
          desiredCount: opts.desiredCount,
          spawnPolicy,
        });
        await store.writeCompanyModel({
          ...company,
          roleSlots: nextRoleSlots,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, role, desiredCount: opts.desiredCount, spawnPolicy },
          `Role slot updated for ${opts.teamId} (${role})`,
        );
      },
    );

  const business = team.command("business").description("Manage business configuration for a team");
  business
    .command("get")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const payload = {
        ok: true,
        teamId: opts.teamId,
        projectId,
        businessConfig: project.businessConfig ?? null,
      };
      formatOutput(
        opts.json ? "json" : "text",
        payload,
        project.businessConfig
          ? `${opts.teamId} | type=${project.businessConfig.type} | measure=${project.businessConfig.slots.measure.skillId} | execute=${project.businessConfig.slots.execute.skillId} | distribute=${project.businessConfig.slots.distribute.skillId}`
          : `${opts.teamId} has no business config`,
      );
    });
  business
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--slot <slot>", "Capability slot: measure|execute|distribute")
    .requiredOption("--skill-id <skillId>", "Skill identifier for selected slot")
    .option("--business-type <type>", "affiliate_marketing|content_creator|saas|custom")
    .option("--config-json <json>", "JSON object for slot config")
    .option("--config <entry>", "Config key=value (repeatable)", collectConfigEntry, [] as ConfigEntry[])
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        slot: string;
        skillId: string;
        businessType?: string;
        configJson?: string;
        config: ConfigEntry[];
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const slot = parseCapabilityCategory(opts.slot);
        const skillId = opts.skillId.trim();
        if (!skillId) fail("invalid_skill_id");
        const baseConfig = opts.configJson?.trim() ? parseConfigJson(opts.configJson.trim()) : {};
        const extraConfig = normalizeConfigEntries(opts.config);
        const mergedConfig = { ...baseConfig, ...extraConfig };
        const currentBusinessConfig =
          project.businessConfig ??
          defaultBusinessConfig(opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : "custom");
        const nextType = opts.businessType?.trim() ? parseBusinessType(opts.businessType.trim()) : currentBusinessConfig.type;
        const nextBusinessConfig: BusinessConfigModel = {
          type: nextType,
          slots: {
            measure: { ...currentBusinessConfig.slots.measure },
            execute: { ...currentBusinessConfig.slots.execute },
            distribute: { ...currentBusinessConfig.slots.distribute },
          },
        };
        const existingSlot = nextBusinessConfig.slots[slot];
        nextBusinessConfig.slots[slot] = {
          skillId,
          category: slot,
          config: Object.keys(mergedConfig).length > 0 ? mergedConfig : existingSlot.config,
        } satisfies CapabilitySlotModel;
        const nextProject = {
          ...project,
          businessConfig: nextBusinessConfig,
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
          resources: project.resources ?? defaultProjectResources(projectId),
          resourceEvents: project.resourceEvents ?? [],
        };
        const nextCompany: CompanyModel = {
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        };
        await store.writeCompanyModel(nextCompany);
        formatOutput(
          opts.json ? "json" : "text",
          {
            ok: true,
            teamId: opts.teamId,
            projectId,
            businessType: nextBusinessConfig.type,
            slot,
            skillId,
            config: nextBusinessConfig.slots[slot].config,
          },
          `Updated business slot '${slot}' for ${opts.teamId}`,
        );
      },
    );

  const resources = team.command("resources").description("Manage advisory resources for a team");
  resources
    .command("list")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rows = project.resources ?? [];
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, resources: rows },
        rows.length === 0
          ? `${opts.teamId} has no resources`
          : rows
              .map((entry) => `${entry.id} | ${entry.type} | ${entry.remaining}/${entry.limit} ${entry.unit}`)
              .join("\n"),
      );
    });
  resources
    .command("events")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--limit <limit>", "Max events to show", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_limit:${value}`);
      return parsed;
    }, 20)
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; limit: number; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rows = (project.resourceEvents ?? []).slice().reverse().slice(0, opts.limit);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, events: rows },
        rows.length === 0
          ? `${opts.teamId} has no resource events`
          : rows
              .map((entry) => `${entry.ts} | ${entry.kind} | ${entry.resourceId} | delta=${entry.delta} | after=${entry.remainingAfter}`)
              .join("\n"),
      );
    });
  resources
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--type <type>", "cash_budget|api_quota|distribution_slots|custom")
    .option("--resource-id <resourceId>", "Resource id override")
    .option("--name <name>", "Display name")
    .option("--unit <unit>", "Unit label")
    .requiredOption("--remaining <value>", "Remaining amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_remaining:${value}`);
      return parsed;
    })
    .requiredOption("--limit <value>", "Limit amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_limit:${value}`);
      return parsed;
    })
    .option("--reserved <value>", "Reserved amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_reserved:${value}`);
      return parsed;
    })
    .option("--tracker-skill-id <skillId>", "Resource tracker skill id")
    .option("--refresh-cadence-minutes <minutes>", "Refresh cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_refresh_cadence:${value}`);
      return parsed;
    })
    .option("--soft-limit <value>", "Soft limit", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_soft_limit:${value}`);
      return parsed;
    })
    .option("--hard-limit <value>", "Hard limit", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_hard_limit:${value}`);
      return parsed;
    })
    .option("--when-low <mode>", "warn|deprioritize_expensive_tasks|ask_pm_review", "warn")
    .option("--event-kind <kind>", "refresh|consumption|adjustment", "adjustment")
    .option("--source <source>", "Event source", "team.resources.set")
    .option("--note <note>", "Event note")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        type: string;
        resourceId?: string;
        name?: string;
        unit?: string;
        remaining: number;
        limit: number;
        reserved?: number;
        trackerSkillId?: string;
        refreshCadenceMinutes?: number;
        softLimit?: number;
        hardLimit?: number;
        whenLow: string;
        eventKind: string;
        source: string;
        note?: string;
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const type = parseResourceKind(opts.type);
        const resourceId = opts.resourceId?.trim() || defaultResourceId(projectId, type);
        const existingResources = project.resources ?? defaultProjectResources(projectId);
        const existing = existingResources.find((entry) => entry.id === resourceId);
        const trackerSkillId =
          opts.trackerSkillId?.trim() ||
          existing?.trackerSkillId ||
          (type === "cash_budget"
            ? "resource-cash-tracker"
            : type === "api_quota"
              ? "resource-api-quota-tracker"
              : type === "distribution_slots"
                ? "resource-distribution-tracker"
                : "resource-custom-tracker");
        const nextResource: ProjectResourceModel = {
          id: resourceId,
          projectId,
          type,
          name: opts.name?.trim() || existing?.name || type,
          unit: opts.unit?.trim() || existing?.unit || (type === "cash_budget" ? "usd_cents" : "units"),
          remaining: opts.remaining,
          limit: opts.limit,
          ...(typeof opts.reserved === "number" ? { reserved: opts.reserved } : existing?.reserved !== undefined ? { reserved: existing.reserved } : {}),
          trackerSkillId,
          ...(typeof opts.refreshCadenceMinutes === "number"
            ? { refreshCadenceMinutes: opts.refreshCadenceMinutes }
            : existing?.refreshCadenceMinutes !== undefined
              ? { refreshCadenceMinutes: existing.refreshCadenceMinutes }
              : {}),
          policy: {
            advisoryOnly: true,
            ...(typeof opts.softLimit === "number" ? { softLimit: opts.softLimit } : existing?.policy.softLimit !== undefined ? { softLimit: existing.policy.softLimit } : {}),
            ...(typeof opts.hardLimit === "number" ? { hardLimit: opts.hardLimit } : existing?.policy.hardLimit !== undefined ? { hardLimit: existing.policy.hardLimit } : {}),
            whenLow:
              opts.whenLow === "deprioritize_expensive_tasks" || opts.whenLow === "ask_pm_review" ? opts.whenLow : "warn",
          },
          ...(existing?.metadata ? { metadata: existing.metadata } : {}),
        };
        const nextResources = existingResources.filter((entry) => entry.id !== resourceId);
        nextResources.push(nextResource);
        const prevRemaining = existing?.remaining ?? 0;
        const event: ResourceEventModel = {
          id: `resource-event-${projectId}-${Date.now()}`,
          projectId,
          resourceId,
          ts: new Date().toISOString(),
          kind: parseResourceEventKind(opts.eventKind),
          delta: nextResource.remaining - prevRemaining,
          remainingAfter: nextResource.remaining,
          source: opts.source,
          ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
        };
        const nextProject = {
          ...project,
          resources: nextResources,
          resourceEvents: [...(project.resourceEvents ?? []), event],
          ledger: project.ledger ?? [],
          experiments: project.experiments ?? [],
          metricEvents: project.metricEvents ?? [],
        };
        await store.writeCompanyModel({
          ...company,
          projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, resourceId, remaining: nextResource.remaining, limit: nextResource.limit },
          `Updated resource '${resourceId}' for ${opts.teamId}`,
        );
      },
    );
  resources
    .command("refresh")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--remaining <value>", "Remaining amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) fail(`invalid_remaining:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "resource_tracker")
    .option("--note <note>", "Event note")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; remaining: number; source: string; note?: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const existingResources = project.resources ?? defaultProjectResources(projectId);
      const current = existingResources.find((entry) => entry.id === opts.resourceId.trim());
      if (!current) fail(`resource_not_found:${opts.resourceId}`);
      const nextResources = existingResources.map((entry) =>
        entry.id === current.id
          ? {
              ...entry,
              remaining: opts.remaining,
            }
          : entry,
      );
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId: current.id,
        ts: new Date().toISOString(),
        kind: "refresh",
        delta: opts.remaining - current.remaining,
        remainingAfter: opts.remaining,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: nextResources,
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, resourceId: current.id, remaining: opts.remaining },
        `Refreshed resource '${current.id}' for ${opts.teamId}`,
      );
    });
  resources
    .command("remove")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .option("--source <source>", "Event source", "team.resources.remove")
    .option("--note <note>", "Event note")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; source: string; note?: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resourceId = opts.resourceId.trim();
      const existing = (project.resources ?? []).find((entry) => entry.id === resourceId);
      if (!existing) fail(`resource_not_found:${opts.resourceId}`);
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId,
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: -existing.remaining,
        remainingAfter: 0,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: (entry.resources ?? []).filter((row) => row.id !== resourceId),
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId, resourceId }, `Removed resource '${resourceId}'`);
    });
  resources
    .command("reserve")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--amount <amount>", "Reserve amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_amount:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "team.resources.reserve")
    .option("--note <note>", "Event note")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; amount: number; source: string; note?: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resources = project.resources ?? [];
      const current = resources.find((entry) => entry.id === opts.resourceId.trim());
      if (!current) fail(`resource_not_found:${opts.resourceId}`);
      const currentReserved = current.reserved ?? 0;
      const nextReserved = currentReserved + opts.amount;
      const nextResources = resources.map((entry) =>
        entry.id === current.id
          ? {
              ...entry,
              reserved: nextReserved,
            }
          : entry,
      );
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId: current.id,
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: -opts.amount,
        remainingAfter: current.remaining,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: nextResources,
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, resourceId: current.id, reserved: nextReserved },
        `Reserved ${opts.amount} on '${current.id}' (reserved=${nextReserved})`,
      );
    });
  resources
    .command("release")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--resource-id <resourceId>", "Resource id")
    .requiredOption("--amount <amount>", "Release amount", (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) fail(`invalid_amount:${value}`);
      return parsed;
    })
    .option("--source <source>", "Event source", "team.resources.release")
    .option("--note <note>", "Event note")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; resourceId: string; amount: number; source: string; note?: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resources = project.resources ?? [];
      const current = resources.find((entry) => entry.id === opts.resourceId.trim());
      if (!current) fail(`resource_not_found:${opts.resourceId}`);
      const currentReserved = current.reserved ?? 0;
      const nextReserved = Math.max(0, currentReserved - opts.amount);
      const nextResources = resources.map((entry) =>
        entry.id === current.id
          ? {
              ...entry,
              reserved: nextReserved,
            }
          : entry,
      );
      const event: ResourceEventModel = {
        id: `resource-event-${projectId}-${Date.now()}`,
        projectId,
        resourceId: current.id,
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: opts.amount,
        remainingAfter: current.remaining,
        source: opts.source,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                resources: nextResources,
                resourceEvents: [...(entry.resourceEvents ?? []), event],
              }
            : entry,
        ),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, resourceId: current.id, reserved: nextReserved },
        `Released ${opts.amount} on '${current.id}' (reserved=${nextReserved})`,
      );
    });
  resources
    .command("seed-demo")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const resources = project.resources && project.resources.length > 0 ? project.resources : defaultProjectResources(projectId);
      const now = new Date().toISOString();
      const events: ResourceEventModel[] = resources.map((resource) => ({
        id: `resource-event-${resource.id}-${Date.now()}`,
        projectId,
        resourceId: resource.id,
        ts: now,
        kind: "refresh",
        delta: 0,
        remainingAfter: resource.remaining,
        source: "team.resources.seed-demo",
        note: "Seed snapshot",
      }));
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...ensureProjectResources(entry),
                resourceEvents: [...(entry.resourceEvents ?? []), ...events],
              }
            : entry,
        ),
      });
      formatOutput(opts.json ? "json" : "text", { ok: true, teamId: opts.teamId, projectId }, `Seeded resource demo data for ${opts.teamId}`);
    });
  business
    .command("seed-demo")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; json?: boolean }) => {
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const now = Date.now();
      const iso = (value: number): string => new Date(value).toISOString();
      const nextProject = {
        ...project,
        ledger: [
          ...(project.ledger ?? []),
          {
            id: `ledger-rev-${now}`,
            projectId,
            timestamp: iso(now - 60 * 60 * 1000),
            type: "revenue" as const,
            amount: 1234,
            currency: "USD",
            source: "amazon_associates",
            description: "Demo affiliate commission",
          },
          {
            id: `ledger-cost-${now}`,
            projectId,
            timestamp: iso(now - 45 * 60 * 1000),
            type: "cost" as const,
            amount: 219,
            currency: "USD",
            source: "openai_api",
            description: "Demo generation cost",
          },
        ],
        experiments: [
          ...(project.experiments ?? []),
          {
            id: `exp-${now}`,
            projectId,
            hypothesis: "Short hooks increase click-through rate",
            status: "completed" as const,
            startedAt: iso(now - 3 * 60 * 60 * 1000),
            endedAt: iso(now - 30 * 60 * 1000),
            results: "Variant B outperformed control by 24%",
            metricsBefore: { clicks: 42 },
            metricsAfter: { clicks: 52 },
          },
        ],
        metricEvents: [
          ...(project.metricEvents ?? []),
          {
            id: `metric-${now}`,
            projectId,
            timestamp: iso(now - 15 * 60 * 1000),
            source: "amazon_associates",
            metrics: { clicks: 240, conversions: 3, revenue_cents: 1234 },
          },
        ],
      };
      await store.writeCompanyModel({
        ...company,
        projects: company.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId },
        `Seeded demo business data for ${opts.teamId}`,
      );
    });

  const heartbeat = team.command("heartbeat").description("Manage team heartbeat profile");
  heartbeat
    .command("render")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--role <role>", "Role: biz_pm|biz_executor")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; role: string; json?: boolean }) => {
      if (opts.role !== "biz_pm" && opts.role !== "biz_executor") fail(`invalid_role:${opts.role}`);
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const rendered = await renderBusinessHeartbeatTemplate({ role: opts.role, project });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, role: opts.role, rendered },
        rendered,
      );
    });
  heartbeat
    .command("set")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--cadence-minutes <minutes>", "Heartbeat cadence in minutes", (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) fail(`invalid_cadence_minutes:${value}`);
      return parsed;
    })
    .requiredOption("--goal <goal>", "Heartbeat goal")
    .option("--team-description <text>", "Team description")
    .option("--product-details <text>", "Product details")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        cadenceMinutes: number;
        goal: string;
        teamDescription?: string;
        productDetails?: string;
        json?: boolean;
      }) => {
        const company = await store.readCompanyModel();
        const projectId = projectIdFromTeamId(opts.teamId);
        if (!company.projects.some((entry) => entry.id === projectId)) fail(`team_not_found:${opts.teamId}`);
        const withProfile = ensureHeartbeatProfile(company, projectId);
        const nextProfiles = withProfile.company.heartbeatProfiles.map((profile) =>
          profile.id === withProfile.profileId
            ? {
                ...profile,
                cadenceMinutes: opts.cadenceMinutes,
                goal: opts.goal.trim(),
                teamDescription: opts.teamDescription?.trim() || profile.teamDescription,
                productDetails: opts.productDetails?.trim() || profile.productDetails,
              }
            : profile,
        );
        const nextAgents = withProfile.company.agents.map((agent) =>
          agent.projectId === projectId
            ? {
                ...agent,
                heartbeatProfileId: withProfile.profileId,
              }
            : agent,
        );
        await store.writeCompanyModel({
          ...withProfile.company,
          heartbeatProfiles: nextProfiles,
          agents: nextAgents,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, heartbeatProfileId: withProfile.profileId },
          `Heartbeat updated for ${opts.teamId}`,
        );
      },
    );
}

export function registerDoctorCommands(program: Command): void {
  const store = createSidecarStore();
  const doctor = program.command("doctor").description("Validate sidecar data contracts");
  doctor
    .command("team-data")
    .option("--json", "Output JSON", false)
    .action(async (opts: { json?: boolean }) => {
      const company = await store.readCompanyModel();
      const issues = runDoctor(company);
      if (opts.json) {
        console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
      } else if (issues.length === 0) {
        console.log("team-data: ok");
      } else {
        console.error("team-data: invalid");
        for (const issue of issues) console.error(`- ${issue}`);
      }
      if (issues.length > 0) {
        process.exitCode = 1;
      }
    });
}

