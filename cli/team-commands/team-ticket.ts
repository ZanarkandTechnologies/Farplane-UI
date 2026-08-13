/**
 * Canonical filesystem ticket and retained agent status/activity commands.
 *
 * Ticket writes resolve the project path from sidecar trackingContext and use
 * project-ticket-store exclusively. Activity remains a thin Convex transport.
 */
import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import {
  appendProjectTicketNotes,
  createProjectTicket,
  listProjectTickets,
  readProjectTicket,
  setProjectTicketNotes,
  updateProjectTicket,
  type ProjectTicketPriority,
  type WritableProjectTicketStatus,
} from "../project-ticket-store.js";
import {
  ensureCommandPermission,
  fail,
  formatOutput,
  optionalBeatId,
  parseTicketActivityType,
  parseTicketPriority,
  parseTicketStatus,
  parseStatusReportState,
  resolveProjectOrFail,
  type SidecarStore,
} from "./_shared.js";
import { getRecentTeamTimeline, postActivityEvent, postStatusReport } from "./_convex.js";

function projectPathOrFail(project: { trackingContext?: string }, teamId: string): string {
  const projectPath = project.trackingContext?.trim();
  if (!projectPath) throw new Error(`missing_project_tracking_context:${teamId}`);
  return projectPath;
}

async function readMemoryInput(opts: { text?: string; file?: string }): Promise<string> {
  if (opts.text?.trim()) return opts.text.trim();
  if (opts.file?.trim()) {
    const text = await readFile(opts.file.trim(), "utf-8");
    if (text.trim()) return text;
    fail("invalid_memory_text");
  }
  fail("missing_memory_text:use_--text_or_--file");
}

export function registerTeamTicket(team: Command, store: SidecarStore): void {
  const ticket = team.command("ticket").description("Manage canonical filesystem project tickets");

  ticket
    .command("create")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--title <title>", "Ticket title")
    .option("--ticket-id <ticketId>", "Canonical TASK-* id override")
    .option("--owner <owner>", "Ticket owner", "unassigned")
    .option("--claimed-by <actor>", "Active session/agent alias")
    .option("--specialist <specialist>", "Artifact specialist routing id")
    .option("--priority <priority>", "low|medium|high", "medium")
    .option("--status <status>", "todo|in_progress|review|blocked", "todo")
    .option("--notes <notes>", "Initial Notes memory")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        title: string;
        ticketId?: string;
        owner: string;
        claimedBy?: string;
        specialist?: string;
        priority: string;
        status: string;
        notes?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.ticket.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const created = await createProjectTicket({
          projectPath: projectPathOrFail(project, opts.teamId),
          title: opts.title,
          ticketId: opts.ticketId,
          owner: opts.owner,
          claimedBy: opts.claimedBy,
          specialist: opts.specialist,
          priority: parseTicketPriority(opts.priority) as ProjectTicketPriority,
          status: parseTicketStatus(opts.status) as WritableProjectTicketStatus,
          notes: opts.notes,
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, ticket: created },
          `Created ${created.ticketId} for ${opts.teamId}`,
        );
      },
    );

  ticket
    .command("list")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--status <status>", "Filter by ticket status")
    .option("--owner <owner>", "Filter by owner")
    .option("--claimed-by <actor>", "Filter by claimed_by")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        status?: string;
        owner?: string;
        claimedBy?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.read");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const status = opts.status?.trim()
          ? parseTicketStatus(opts.status.trim(), true)
          : undefined;
        const tickets = (await listProjectTickets(projectPathOrFail(project, opts.teamId))).filter(
          (row) =>
            (!status || row.status === status) &&
            (!opts.owner?.trim() || row.owner === opts.owner.trim()) &&
            (!opts.claimedBy?.trim() || row.claimedBy === opts.claimedBy.trim()),
        );
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, tickets },
          tickets.length
            ? tickets
                .map(
                  (row) =>
                    `${row.ticketId} | ${row.status} | ${row.priority} | ${row.claimedBy || row.owner || "unassigned"} | ${row.title}`,
                )
                .join("\n")
            : `${opts.teamId} has no filesystem tickets`,
        );
      },
    );

  ticket
    .command("update")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--ticket-id <ticketId>", "Canonical TASK-* id")
    .option("--title <title>", "Updated title")
    .option("--status <status>", "todo|in_progress|review|blocked")
    .option("--owner <owner>", "Updated owner")
    .option("--claimed-by <actor>", "Updated claimed_by; empty string clears it")
    .option("--specialist <specialist>", "Updated artifact specialist routing id; empty clears it")
    .option("--priority <priority>", "low|medium|high")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        ticketId: string;
        title?: string;
        status?: string;
        owner?: string;
        claimedBy?: string;
        specialist?: string;
        priority?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.ticket.write");
        if (
          opts.title === undefined &&
          opts.status === undefined &&
          opts.owner === undefined &&
          opts.claimedBy === undefined &&
          opts.specialist === undefined &&
          opts.priority === undefined
        ) {
          fail("ticket_update_requires_change");
        }
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const updated = await updateProjectTicket(
          projectPathOrFail(project, opts.teamId),
          opts.ticketId,
          {
            ...(opts.title !== undefined ? { title: opts.title } : {}),
            ...(opts.status !== undefined
              ? { status: parseTicketStatus(opts.status) as WritableProjectTicketStatus }
              : {}),
            ...(opts.owner !== undefined ? { owner: opts.owner } : {}),
            ...(opts.claimedBy !== undefined ? { claimedBy: opts.claimedBy } : {}),
            ...(opts.specialist !== undefined ? { specialist: opts.specialist } : {}),
            ...(opts.priority !== undefined
              ? { priority: parseTicketPriority(opts.priority) as ProjectTicketPriority }
              : {}),
          },
        );
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, ticket: updated },
          `Updated ${updated.ticketId}`,
        );
      },
    );

  ticket
    .command("claim")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--ticket-id <ticketId>", "Canonical TASK-* id")
    .requiredOption("--claimed-by <actor>", "Active session/agent alias")
    .option("--owner <owner>", "Owner, defaults to claimed-by")
    .option("--status <status>", "todo|in_progress|review|blocked", "in_progress")
    .option("--note <note>", "Optional Notes memory append")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        ticketId: string;
        claimedBy: string;
        owner?: string;
        status: string;
        note?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.ticket.write");
        const company = await store.readCompanyModel();
        const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
        const projectPath = projectPathOrFail(project, opts.teamId);
        let updated = await updateProjectTicket(projectPath, opts.ticketId, {
          claimedBy: opts.claimedBy,
          owner: opts.owner?.trim() || opts.claimedBy,
          status: parseTicketStatus(opts.status) as WritableProjectTicketStatus,
        });
        if (opts.note?.trim()) {
          updated = await appendProjectTicketNotes(projectPath, updated.ticketId, opts.note);
        }
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, ticket: updated },
          `Claimed ${updated.ticketId} for ${opts.claimedBy}`,
        );
      },
    );

  const memory = ticket.command("memory").description("Manage the ticket Notes section");
  memory
    .command("show")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--ticket-id <ticketId>", "Canonical TASK-* id")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; ticketId: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
      const row = await readProjectTicket(projectPathOrFail(project, opts.teamId), opts.ticketId);
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, ticketId: row.ticketId, memory: row.notes },
        row.notes || `${row.ticketId} has no Notes memory`,
      );
    });

  for (const mode of ["set", "append"] as const) {
    memory
      .command(mode)
      .requiredOption("--team-id <teamId>", "Team id (team-*)")
      .requiredOption("--ticket-id <ticketId>", "Canonical TASK-* id")
      .option("--text <text>", "Markdown memory text")
      .option("--file <path>", "Read Markdown memory from file")
      .option("--json", "Output JSON", false)
      .action(
        async (opts: {
          teamId: string;
          ticketId: string;
          text?: string;
          file?: string;
          json?: boolean;
        }) => {
          ensureCommandPermission("team.ticket.write");
          const company = await store.readCompanyModel();
          const { projectId, project } = resolveProjectOrFail(company, opts.teamId);
          const projectPath = projectPathOrFail(project, opts.teamId);
          const text = await readMemoryInput(opts);
          const row =
            mode === "set"
              ? await setProjectTicketNotes(projectPath, opts.ticketId, text)
              : await appendProjectTicketNotes(projectPath, opts.ticketId, text);
          formatOutput(
            opts.json ? "json" : "text",
            { ok: true, teamId: opts.teamId, projectId, ticketId: row.ticketId, ticket: row },
            `${mode === "set" ? "Set" : "Appended"} Notes memory for ${row.ticketId}`,
          );
        },
      );
  }

  const status = team.command("status").description("Report explicit agent status");
  status
    .command("report")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption("--state <state>", "Agent status state")
    .requiredOption("--status-text <text>", "Current status detail")
    .option("--step-key <stepKey>", "Idempotency key")
    .option("--skill-id <skillId>", "Related skill id")
    .option("--session-key <sessionKey>", "OpenClaw session key")
    .option("--beat-id <beatId>", "Heartbeat beat id")
    .option("--source <source>", "Source label", "farplane_cli")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        state: string;
        statusText: string;
        stepKey?: string;
        skillId?: string;
        sessionKey?: string;
        beatId?: string;
        source: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        resolveProjectOrFail(company, opts.teamId);
        const state = parseStatusReportState(opts.state);
        const stepKey = opts.stepKey?.trim() || `status-${opts.agentId.trim()}-${Date.now()}`;
        const result = await postStatusReport({
          teamId: opts.teamId,
          agentId: opts.agentId.trim(),
          state,
          statusText: opts.statusText.trim(),
          stepKey,
          skillId: opts.skillId?.trim() || undefined,
          sessionKey: opts.sessionKey?.trim() || undefined,
          beatId: optionalBeatId(opts.beatId),
          source: opts.source.trim(),
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, agentId: opts.agentId, state, stepKey, result },
          `Reported status for ${opts.agentId} (${state})`,
        );
      },
    );

  const activity = team.command("activity").description("Write and inspect agent activity");
  activity
    .command("log")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .requiredOption("--agent-id <agentId>", "Agent id")
    .requiredOption("--activity-type <type>", "Activity type")
    .requiredOption("--label <label>", "Activity label")
    .option("--detail <detail>", "Activity detail")
    .option("--ticket-id <ticketId>", "Ticket context")
    .option("--skill-id <skillId>", "Skill context")
    .option("--state <state>", "Agent state context")
    .option("--step-key <stepKey>", "Idempotency key")
    .option("--beat-id <beatId>", "Heartbeat beat id")
    .option("--json", "Output JSON", false)
    .action(
      async (opts: {
        teamId: string;
        agentId: string;
        activityType: string;
        label: string;
        detail?: string;
        ticketId?: string;
        skillId?: string;
        state?: string;
        stepKey?: string;
        beatId?: string;
        json?: boolean;
      }) => {
        ensureCommandPermission("team.activity.write");
        const company = await store.readCompanyModel();
        const { projectId } = resolveProjectOrFail(company, opts.teamId);
        const result = await postActivityEvent({
          teamId: opts.teamId,
          projectId,
          agentId: opts.agentId.trim(),
          eventType: "activity_log",
          activityType: parseTicketActivityType(opts.activityType),
          actorType: "agent",
          label: opts.label.trim(),
          detail: opts.detail?.trim() || undefined,
          taskId: opts.ticketId?.trim() || undefined,
          skillId: opts.skillId?.trim() || undefined,
          state: opts.state?.trim() || undefined,
          stepKey: opts.stepKey?.trim() || undefined,
          beatId: optionalBeatId(opts.beatId),
          source: "farplane_cli",
        });
        formatOutput(
          opts.json ? "json" : "text",
          { ok: true, teamId: opts.teamId, projectId, result },
          `Logged activity for ${opts.agentId}`,
        );
      },
    );

  activity
    .command("timeline")
    .requiredOption("--team-id <teamId>", "Team id (team-*)")
    .option("--agent-id <agentId>", "Filter agent")
    .option("--limit <limit>", "Max rows", "20")
    .option("--json", "Output JSON", false)
    .action(async (opts: { teamId: string; agentId?: string; limit: string; json?: boolean }) => {
      ensureCommandPermission("team.read");
      const company = await store.readCompanyModel();
      const { projectId } = resolveProjectOrFail(company, opts.teamId);
      const limit = Math.max(1, Math.min(300, Number.parseInt(opts.limit, 10) || 20));
      const rows = await getRecentTeamTimeline({
        teamId: opts.teamId,
        projectId,
        agentId: opts.agentId?.trim() || undefined,
        limit,
      });
      formatOutput(
        opts.json ? "json" : "text",
        { ok: true, teamId: opts.teamId, projectId, events: rows },
        rows.length
          ? rows
              .map(
                (row) =>
                  `${row.occurredAt ? new Date(row.occurredAt).toISOString() : "unknown"} | ${row.agentId ?? "unknown"} | ${row.eventType ?? row.activityType ?? "activity"} | ${row.label ?? ""}`,
              )
              .join("\n")
          : `${opts.teamId} has no activity events`,
      );
    });
}
