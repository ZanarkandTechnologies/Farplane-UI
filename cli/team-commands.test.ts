import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerDoctorCommands, registerTeamCommands } from "./team-commands.js";

const baseCompany = {
  version: 1,
  departments: [
    { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
    { id: "dept-products", name: "Product Studio", description: "", goal: "" },
  ],
  projects: [],
  agents: [{ agentId: "main", role: "ceo", heartbeatProfileId: "hb-ceo", isCeo: true, lifecycleState: "active" }],
  roleSlots: [],
  heartbeatProfiles: [
    { id: "hb-ceo", role: "ceo", cadenceMinutes: 15, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-builder", role: "builder", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-growth", role: "growth_marketer", cadenceMinutes: 20, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-pm", role: "pm", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" },
  ],
  tasks: [],
  channelBindings: [],
  federationPolicies: [],
  providerIndexProfiles: [],
};

type CompanySnapshot = {
  projects: Array<{
    id: string;
    status: string;
    kpis: string[];
    businessConfig?: {
      type: string;
      slots: {
        measure: { skillId: string; category: string; config: Record<string, string> };
        execute: { skillId: string; category: string; config: Record<string, string> };
        distribute: { skillId: string; category: string; config: Record<string, string> };
      };
    };
    ledger?: unknown[];
    experiments?: unknown[];
    metricEvents?: unknown[];
    resources?: Array<{ id: string; type: string; remaining: number; limit: number; reserved?: number }>;
    resourceEvents?: Array<{
      id?: string;
      projectId?: string;
      resourceId: string;
      ts?: string;
      kind: string;
      delta?: number;
      remainingAfter: number;
      source?: string;
    }>;
  }>;
  roleSlots: Array<{ projectId: string; desiredCount: number; role?: string }>;
  heartbeatProfiles: Array<{ id: string; goal: string }>;
  agents: Array<{ agentId?: string; projectId?: string; heartbeatProfileId: string; role?: string }>;
};

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-cli-test-"));
  await writeFile(path.join(dir, "company.json"), `${JSON.stringify(baseCompany, null, 2)}\n`, "utf-8");
  await writeFile(path.join(dir, "office-objects.json"), "[]\n", "utf-8");
  await writeFile(
    path.join(dir, "openclaw.json"),
    `${JSON.stringify(
      {
        version: 1,
        agents: {
          list: [
            {
              id: "main",
              name: "Main",
              workspace: path.join(dir, "workspace"),
              agentDir: path.join(dir, "agents", "main", "agent"),
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return dir;
}

async function runCommand(args: string[]): Promise<void> {
  const program = new Command();
  registerTeamCommands(program);
  registerDoctorCommands(program);
  await program.parseAsync(args, { from: "user" });
}

async function readOpenclawAgentIds(stateDir: string): Promise<string[]> {
  const raw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
  const config = JSON.parse(raw) as {
    agents?: { list?: Array<{ id?: string }> };
  };
  return (config.agents?.list ?? []).map((entry) => entry.id ?? "").filter(Boolean);
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCLAW_STATE_DIR;
  process.exitCode = undefined;
});

describe("team CLI", () => {
  it("creates, updates, and archives a team", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Alpha",
      "--description",
      "Core team",
      "--goal",
      "Ship fast",
      "--kpi",
      "weekly_shipped_tickets",
      "--auto-roles",
      "builder,pm",
    ]);
    const afterCreateAgentIds = await readOpenclawAgentIds(stateDir);
    expect(afterCreateAgentIds).toContain("alpha-builder");
    expect(afterCreateAgentIds).toContain("alpha-pm");
    await access(path.join(stateDir, "workspace-alpha-builder", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-alpha-builder", "SOUL.md"));
    await access(path.join(stateDir, "workspace-alpha-builder", "HEARTBEAT.md"));
    await access(path.join(stateDir, "agents", "alpha-builder", "sessions"));
    await access(path.join(stateDir, "workspace-alpha-pm", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-alpha-pm", "SOUL.md"));
    await access(path.join(stateDir, "workspace-alpha-pm", "HEARTBEAT.md"));
    await access(path.join(stateDir, "agents", "alpha-pm", "sessions"));
    await runCommand([
      "team",
      "update",
      "--team-id",
      "team-proj-alpha",
      "--kpi-add",
      "weekly_shipped_tickets",
      "--kpi-add",
      "closed_vs_open_ticket_ratio",
      "--kpi-remove",
      "weekly_shipped_tickets",
    ]);
    await runCommand(["team", "archive", "--team-id", "team-proj-alpha"]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const project = finalModel.projects.find((entry) => entry.id === "proj-alpha");
    expect(project).toBeTruthy();
    expect(project?.status).toBe("archived");
    expect(project?.kpis).toEqual(["weekly_shipped_tickets", "closed_vs_open_ticket_ratio"]);
    expect(finalModel.roleSlots.filter((entry) => entry.projectId === "proj-alpha").every((entry) => entry.desiredCount === 0)).toBe(
      true,
    );
  });

  it("sets team heartbeat profile and remaps agents", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Beta",
      "--description",
      "Operations",
      "--goal",
      "Run ops",
      "--auto-roles",
      "builder",
    ]);

    await runCommand([
      "team",
      "heartbeat",
      "set",
      "--team-id",
      "team-proj-beta",
      "--cadence-minutes",
      "15",
      "--goal",
      "Reduce backlog",
      "--team-description",
      "Ops team",
    ]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const heartbeat = finalModel.heartbeatProfiles.find((entry) => entry.id === "hb-team-proj-beta");
    expect(heartbeat).toBeTruthy();
    expect(heartbeat?.goal).toBe("Reduce backlog");
    expect(finalModel.agents.some((entry) => entry.projectId === "proj-beta" && entry.heartbeatProfileId === "hb-team-proj-beta")).toBe(
      true,
    );
  });

  it("doctor reports broken references", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const broken = {
      ...baseCompany,
      agents: [
        ...baseCompany.agents,
        { agentId: "broken-agent", role: "pm", projectId: "proj-missing", heartbeatProfileId: "hb-missing", lifecycleState: "active" },
      ],
    };
    await writeFile(path.join(stateDir, "company.json"), `${JSON.stringify(broken, null, 2)}\n`, "utf-8");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCommand(["doctor", "team-data"]);
    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("doctor reports broken resource references", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "BrokenResource",
      "--description",
      "Broken resource team",
      "--goal",
      "Detect resource issues",
      "--business-type",
      "affiliate_marketing",
    ]);
    const raw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const model = JSON.parse(raw) as CompanySnapshot;
    const project = model.projects.find((entry) => entry.id === "proj-brokenresource");
    expect(project).toBeTruthy();
    project!.resourceEvents = [
      ...(project!.resourceEvents ?? []),
      {
        id: "bad-resource-event",
        projectId: "proj-brokenresource",
        resourceId: "proj-brokenresource:missing",
        ts: new Date().toISOString(),
        kind: "adjustment",
        delta: -10,
        remainingAfter: 0,
        source: "test",
      },
    ];
    await writeFile(path.join(stateDir, "company.json"), `${JSON.stringify(model, null, 2)}\n`, "utf-8");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCommand(["doctor", "team-data"]);
    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("creates business team and updates capability slot", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Affiliate",
      "--description",
      "Affiliate team",
      "--goal",
      "Reach $100 MRR",
      "--business-type",
      "affiliate_marketing",
    ]);
    await runCommand([
      "team",
      "business",
      "set",
      "--team-id",
      "team-proj-affiliate",
      "--slot",
      "measure",
      "--skill-id",
      "stripe-revenue",
      "--config-json",
      "{\"apiKey\":\"sk_test\"}",
    ]);

    const finalRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const finalModel = JSON.parse(finalRaw) as CompanySnapshot;
    const project = finalModel.projects.find((entry) => entry.id === "proj-affiliate");
    expect(project?.businessConfig?.type).toBe("affiliate_marketing");
    expect(project?.businessConfig?.slots.measure.skillId).toBe("stripe-revenue");
    expect(project?.businessConfig?.slots.measure.config.apiKey).toBe("sk_test");
    expect(project?.ledger ?? []).toEqual([]);
    expect(project?.experiments ?? []).toEqual([]);
    expect(project?.metricEvents ?? []).toEqual([]);
    expect((project?.resources ?? []).length).toBeGreaterThan(0);
    expect(project?.resourceEvents ?? []).toEqual([]);
    const businessRoles = finalModel.roleSlots.filter((entry) => entry.projectId === "proj-affiliate").map((entry) => entry.role);
    expect(businessRoles).toContain("biz_pm");
    expect(businessRoles).toContain("biz_executor");
    const businessAgentRoles = finalModel.agents.filter((entry) => entry.projectId === "proj-affiliate").map((entry) => entry.role);
    expect(businessAgentRoles).toContain("biz_pm");
    expect(businessAgentRoles).toContain("biz_executor");
    const openclawAgentIds = await readOpenclawAgentIds(stateDir);
    expect(openclawAgentIds).toContain("affiliate-pm");
    expect(openclawAgentIds).toContain("affiliate-executor");

    const pmHeartbeat = await readFile(
      path.join(stateDir, "workspace-affiliate-pm", "HEARTBEAT.md"),
      "utf-8",
    );
    const executorHeartbeat = await readFile(
      path.join(stateDir, "workspace-affiliate-executor", "HEARTBEAT.md"),
      "utf-8",
    );
    expect(pmHeartbeat).toContain("You are the PM");
    expect(executorHeartbeat).toContain("You are the Executor");
    await access(path.join(stateDir, "workspace-affiliate-pm", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-affiliate-pm", "SOUL.md"));
    await access(path.join(stateDir, "workspace-affiliate-executor", "AGENTS.md"));
    await access(path.join(stateDir, "workspace-affiliate-executor", "SOUL.md"));
    await access(path.join(stateDir, "agents", "affiliate-pm", "sessions"));
    await access(path.join(stateDir, "agents", "affiliate-executor", "sessions"));

    const cronRaw = await readFile(path.join(stateDir, "cron", "jobs.json"), "utf-8");
    const cronJobs = JSON.parse(cronRaw) as Array<{ id: string; agentId?: string }>;
    expect(cronJobs.some((job) => job.id === "biz-heartbeat-proj-affiliate-pm" && job.agentId === "affiliate-pm")).toBe(true);
    expect(cronJobs.some((job) => job.id === "biz-heartbeat-proj-affiliate-executor" && job.agentId === "affiliate-executor")).toBe(true);

    await runCommand([
      "team",
      "resources",
      "set",
      "--team-id",
      "team-proj-affiliate",
      "--type",
      "cash_budget",
      "--remaining",
      "4200",
      "--limit",
      "5000",
      "--source",
      "test",
    ]);
    await runCommand([
      "team",
      "resources",
      "refresh",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:cash",
      "--remaining",
      "4100",
      "--source",
      "test-refresh",
    ]);
    await runCommand([
      "team",
      "resources",
      "reserve",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:cash",
      "--amount",
      "300",
      "--source",
      "test-reserve",
    ]);
    await runCommand([
      "team",
      "resources",
      "release",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:cash",
      "--amount",
      "100",
      "--source",
      "test-release",
    ]);

    const refreshedRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const refreshedModel = JSON.parse(refreshedRaw) as CompanySnapshot;
    const refreshedProject = refreshedModel.projects.find((entry) => entry.id === "proj-affiliate");
    const cashResource = (refreshedProject?.resources ?? []).find((entry) => entry.id === "proj-affiliate:cash");
    expect(cashResource?.remaining).toBe(4100);
    expect(cashResource?.reserved).toBe(200);
    expect((refreshedProject?.resourceEvents ?? []).some((entry) => entry.resourceId === "proj-affiliate:cash" && entry.kind === "refresh")).toBe(true);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runCommand(["team", "business", "get", "--team-id", "team-proj-affiliate", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "resources", "list", "--team-id", "team-proj-affiliate", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "resources", "events", "--team-id", "team-proj-affiliate", "--limit", "3", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    await runCommand(["team", "heartbeat", "render", "--team-id", "team-proj-affiliate", "--role", "biz_pm", "--json"]);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();

    await runCommand([
      "team",
      "resources",
      "remove",
      "--team-id",
      "team-proj-affiliate",
      "--resource-id",
      "proj-affiliate:distribution",
      "--source",
      "test-remove",
    ]);
    const removedRaw = await readFile(path.join(stateDir, "company.json"), "utf-8");
    const removedModel = JSON.parse(removedRaw) as CompanySnapshot;
    const removedProject = removedModel.projects.find((entry) => entry.id === "proj-affiliate");
    expect((removedProject?.resources ?? []).some((entry) => entry.id === "proj-affiliate:distribution")).toBe(false);
  });

  it("does not duplicate existing openclaw agent entries when IDs already exist", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const existingConfig = {
      version: 1,
      agents: {
        list: [
          {
            id: "main",
            workspace: path.join(stateDir, "workspace"),
            agentDir: path.join(stateDir, "agents", "main", "agent"),
          },
          {
            id: "affiliate-pm",
            workspace: path.join(stateDir, "workspace-affiliate-pm"),
            agentDir: path.join(stateDir, "agents", "affiliate-pm", "agent"),
          },
        ],
      },
    };
    await writeFile(path.join(stateDir, "openclaw.json"), `${JSON.stringify(existingConfig, null, 2)}\n`, "utf-8");
    await runCommand([
      "team",
      "create",
      "--name",
      "Affiliate",
      "--description",
      "Affiliate team",
      "--goal",
      "Reach $100 MRR",
      "--business-type",
      "affiliate_marketing",
    ]);
    const ids = await readOpenclawAgentIds(stateDir);
    expect(ids.filter((id) => id === "affiliate-pm")).toHaveLength(1);
    expect(ids).toContain("affiliate-executor");
  });

  it("archives team and optionally deregisters openclaw agents", async () => {
    const stateDir = await setupStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await runCommand([
      "team",
      "create",
      "--name",
      "Gamma",
      "--description",
      "Gamma team",
      "--goal",
      "Ship fast",
      "--auto-roles",
      "builder,pm",
    ]);
    let ids = await readOpenclawAgentIds(stateDir);
    expect(ids).toContain("gamma-builder");
    expect(ids).toContain("gamma-pm");
    await runCommand(["team", "archive", "--team-id", "team-proj-gamma", "--deregister-openclaw"]);
    ids = await readOpenclawAgentIds(stateDir);
    expect(ids).not.toContain("gamma-builder");
    expect(ids).not.toContain("gamma-pm");
  });
});

