import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTeamCommands } from "./team-commands/index.js";

const roots: string[] = [];

async function setup(): Promise<{ statePath: string; projectPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-ticket-cli-"));
  roots.push(root);
  const statePath = path.join(root, "state");
  const projectPath = path.join(root, "project");
  await Promise.all([
    mkdir(statePath, { recursive: true }),
    mkdir(projectPath, { recursive: true }),
  ]);
  await writeFile(
    path.join(statePath, "company.json"),
    `${JSON.stringify(
      {
        version: 1,
        departments: [{ id: "dept-products", name: "Products", description: "", goal: "" }],
        projects: [
          {
            id: "proj-alpha",
            departmentId: "dept-products",
            name: "Alpha",
            githubUrl: "",
            status: "active",
            goal: "Ship",
            kpis: [],
            trackingContext: projectPath,
            accountEvents: [],
            ledger: [],
            experiments: [],
            metricEvents: [],
            resources: [],
            resourceEvents: [],
          },
        ],
        agents: [
          {
            agentId: "alpha-pm",
            role: "pm",
            projectId: "proj-alpha",
            heartbeatProfileId: "hb-pm",
            isCeo: false,
            lifecycleState: "active",
          },
        ],
        roleSlots: [],
        heartbeatProfiles: [
          {
            id: "hb-pm",
            role: "pm",
            cadenceMinutes: 10,
            teamDescription: "",
            productDetails: "",
            goal: "",
          },
        ],
        tasks: [],
        channelBindings: [],
        federationPolicies: [],
        providerIndexProfiles: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(statePath, "office-objects.json"), "[]\n");
  await writeFile(path.join(statePath, "openclaw.json"), '{"version":1,"agents":{"list":[]}}\n');
  process.env.OPENCLAW_STATE_DIR = statePath;
  return { statePath, projectPath };
}

async function run(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerTeamCommands(program);
  await program.parseAsync(args, { from: "user" });
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.OPENCLAW_STATE_DIR;
  delete process.env.FARPLANE_CONVEX_SITE_URL;
  delete process.env.FARPLANE_TELEMETRY_TOKEN;
  delete process.env.FARPLANE_ALLOWED_PERMISSIONS;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("team ticket CLI", () => {
  it("blocks ordinary ticket creation while a foundation ticket is active", async () => {
    const { projectPath } = await setup();
    const ticketDir = path.join(projectPath, "tickets", "TASK-0001");
    await mkdir(ticketDir, { recursive: true });
    await writeFile(
      path.join(ticketDir, "ticket.md"),
      [
        "---",
        "ticket_id: TASK-0001",
        "title: Find the first customer",
        "status: active",
        "foundation_step: find_customer",
        "foundation_sequence: 1",
        "---",
        "",
        "# TASK-0001: Find the first customer",
      ].join("\n"),
      "utf-8",
    );

    await expect(
      run([
        "team",
        "ticket",
        "create",
        "--team-id",
        "team-proj-alpha",
        "--title",
        "Bypass tutorial",
      ]),
    ).rejects.toThrow("foundation_locked:create_ticket");
  });

  it("creates, claims, moves, filters, and updates Notes through filesystem tickets", async () => {
    const { projectPath } = await setup();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await run([
      "team",
      "ticket",
      "create",
      "--team-id",
      "team-proj-alpha",
      "--title",
      "Plan launch",
      "--specialist",
      "landing-page-specialist",
      "--priority",
      "high",
      "--notes",
      "Initial context",
      "--json",
    ]);
    await run([
      "team",
      "ticket",
      "claim",
      "--team-id",
      "team-proj-alpha",
      "--ticket-id",
      "TASK-0001",
      "--claimed-by",
      "codex-123",
      "--note",
      "Claimed safely",
      "--json",
    ]);
    await run([
      "team",
      "ticket",
      "update",
      "--team-id",
      "team-proj-alpha",
      "--ticket-id",
      "TASK-0001",
      "--status",
      "review",
      "--specialist",
      "video-specialist",
      "--json",
    ]);
    await run([
      "team",
      "ticket",
      "memory",
      "append",
      "--team-id",
      "team-proj-alpha",
      "--ticket-id",
      "TASK-0001",
      "--text",
      "Ready for review",
      "--json",
    ]);
    await run([
      "team",
      "ticket",
      "list",
      "--team-id",
      "team-proj-alpha",
      "--status",
      "review",
      "--json",
    ]);

    const raw = await readFile(
      path.join(projectPath, "tickets", "TASK-0001", "ticket.md"),
      "utf-8",
    );
    expect(raw).toContain("phase: review");
    expect(raw).toContain("status: review");
    expect(raw).toContain("claimed_by: codex-123");
    expect(raw).toContain("specialist: video-specialist");
    expect(raw).not.toContain("linked_session_key:");
    expect(raw).toContain("Initial context\n\nClaimed safely\n\nReady for review");
    const output = JSON.parse(String(log.mock.calls.at(-1)?.[0])) as {
      tickets: Array<{ ticketId: string }>;
    };
    expect(output.tickets.map((row) => row.ticketId)).toEqual(["TASK-0001"]);
  });

  it("does not expose delete or close shortcuts", async () => {
    await setup();
    await expect(run(["team", "ticket", "delete"])).rejects.toThrow();
    await expect(run(["team", "ticket", "close"])).rejects.toThrow();
  });

  it("routes activity and timeline through retained authenticated contracts", async () => {
    await setup();
    process.env.FARPLANE_CONVEX_SITE_URL = "https://example.convex.site";
    process.env.FARPLANE_TELEMETRY_TOKEN = "secret-token";
    const calls: Array<{
      url: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({
          url,
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        });
        if (url.endsWith("/status/activity")) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                events: [
                  {
                    sourceType: "agent_event",
                    occurredAt: 1,
                    agentId: "alpha-pm",
                    eventType: "activity_log",
                    label: "planning",
                  },
                ],
                hasMore: false,
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await run([
      "team",
      "activity",
      "log",
      "--team-id",
      "team-proj-alpha",
      "--agent-id",
      "alpha-pm",
      "--activity-type",
      "planning",
      "--label",
      "Planning",
      "--json",
    ]);
    await run(["team", "activity", "timeline", "--team-id", "team-proj-alpha", "--json"]);

    expect(calls.map((call) => call.url)).toEqual([
      "https://example.convex.site/ingest",
      "https://example.convex.site/status/activity",
    ]);
    expect(calls[0]?.body).toMatchObject({
      teamId: "team-proj-alpha",
      projectId: "proj-alpha",
      eventType: "activity_log",
      agentId: "alpha-pm",
    });
    expect(calls[0]?.headers).toMatchObject({
      "x-farplane-telemetry-token": "secret-token",
      authorization: "Bearer secret-token",
    });
    expect(calls[1]?.body).toMatchObject({
      teamId: "team-proj-alpha",
      projectId: "proj-alpha",
    });
  });
});
