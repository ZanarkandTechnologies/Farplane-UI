import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendProjectTicketNotes,
  assertProjectFoundationUnlocked,
  bindProjectTicketThread,
  createProjectTicket,
  deriveProjectFoundationState,
  listProjectTickets,
  readProjectTicket,
  scanProjectTickets,
  setProjectTicketNotes,
  updateProjectTicket,
} from "./project-ticket-store.js";
import { readTicketSnapshot } from "./team-commands/_convex.js";

const temporaryRoots: string[] = [];

async function temporaryProject(): Promise<string> {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "farplane-ticket-store-"));
  temporaryRoots.push(projectPath);
  return projectPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("project ticket store", () => {
  it("fails closed only for unreadable foundation tickets", async () => {
    const projectPath = await temporaryProject();
    const malformedDir = path.join(projectPath, "tickets", "TASK-0001");
    await mkdir(malformedDir, { recursive: true });
    await writeFile(
      path.join(malformedDir, "ticket.md"),
      "---\nticket_id: TASK-0001\nfoundation_step: find_customer\n",
      "utf-8",
    );
    await expect(assertProjectFoundationUnlocked(projectPath, "create_ticket")).rejects.toThrow(
      "foundation_gate_unreadable:create_ticket:TASK-0001",
    );

    await writeFile(
      path.join(malformedDir, "ticket.md"),
      "---\nticket_id: TASK-0001\ntitle: ordinary malformed ticket\n",
      "utf-8",
    );
    await expect(assertProjectFoundationUnlocked(projectPath, "create_ticket")).resolves.toBe(
      undefined,
    );
  });

  it("derives the active three-ticket foundation gate and blocks ordinary creation", async () => {
    const projectPath = await temporaryProject();
    const ticketsRoot = path.join(projectPath, "tickets");
    for (const [index, step] of ["find_customer", "deliver_value", "collect_revenue"].entries()) {
      const ticketId = `TASK-${String(index + 1).padStart(4, "0")}`;
      const directory = path.join(ticketsRoot, ticketId);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "ticket.md"),
        [
          "---",
          `ticket_id: ${ticketId}`,
          `title: Foundation ${index + 1}`,
          "phase: planning",
          "status: todo",
          `foundation_step: ${step}`,
          `foundation_sequence: ${index + 1}`,
          "---",
          `# ${ticketId}: Foundation ${index + 1}`,
          "",
        ].join("\n"),
        "utf-8",
      );
    }

    const initial = deriveProjectFoundationState(await listProjectTickets(projectPath));
    expect(initial).toMatchObject({ mode: "locked", completedCount: 0, totalCount: 3 });
    expect(initial.activeTickets).toHaveLength(3);
    expect(initial.activeTickets.every((ticket) => ticket.status === "todo")).toBe(true);
    await expect(createProjectTicket({ projectPath, title: "Should stay locked" })).rejects.toThrow(
      "foundation_locked:create_ticket",
    );
    await expect(assertProjectFoundationUnlocked(projectPath, "activate_autonomy")).rejects.toThrow(
      "foundation_locked:activate_autonomy",
    );

    await rm(path.join(ticketsRoot, "TASK-0001"), { recursive: true, force: true });
    const afterOne = deriveProjectFoundationState(await listProjectTickets(projectPath));
    expect(afterOne).toMatchObject({ mode: "locked", completedCount: 1 });
    expect(afterOne.activeTickets.map((ticket) => ticket.ticketId)).toEqual([
      "TASK-0002",
      "TASK-0003",
    ]);

    await rm(path.join(ticketsRoot, "TASK-0002"), { recursive: true, force: true });
    await rm(path.join(ticketsRoot, "TASK-0003"), { recursive: true, force: true });
    await expect(assertProjectFoundationUnlocked(projectPath, "create_ticket")).resolves.toBe(
      undefined,
    );
    await expect(
      createProjectTicket({ projectPath, title: "Now unlocked" }),
    ).resolves.toMatchObject({ title: "Now unlocked" });
  });

  it("maps UI lanes onto canonical lifecycle fields and derives lanes on reload", async () => {
    const projectPath = await temporaryProject();
    const created = await createProjectTicket({
      projectPath,
      title: "Canonical lifecycle",
      status: "todo",
    });
    expect(created.status).toBe("todo");
    expect(created.frontMatter).toMatchObject({ phase: "planning", status: "active" });

    const implementing = await updateProjectTicket(projectPath, created.ticketId, {
      status: "in_progress",
    });
    expect(implementing.status).toBe("in_progress");
    expect(implementing.frontMatter).toMatchObject({ phase: "implementation", status: "active" });

    const review = await updateProjectTicket(projectPath, created.ticketId, { status: "review" });
    expect(review.status).toBe("review");
    expect(review.frontMatter).toMatchObject({ phase: "review", status: "review" });
    expect(review.approvalState).toBe("pending_review");

    const blocked = await updateProjectTicket(projectPath, created.ticketId, { status: "blocked" });
    expect(blocked.status).toBe("blocked");
    expect(blocked.frontMatter.status).toBe("blocked");
    expect(blocked.frontMatter.phase).toBe("review");
  });

  it("reads hook-bound task threads while ticket edits leave them untouched", async () => {
    const projectPath = await temporaryProject();
    const created = await createProjectTicket({
      projectPath,
      title: "Build landing page",
      specialist: "landing-page-specialist",
    });
    expect(created.specialist).toBe("landing-page-specialist");
    expect(created.frontMatter.specialist).toBe("landing-page-specialist");
    expect(created.threadId).toBeUndefined();

    const ticketPath = path.join(projectPath, "tickets", created.ticketId, "ticket.md");
    const raw = await readFile(ticketPath, "utf-8");
    await writeFile(
      ticketPath,
      raw.replace("ticket_id: TASK-0001", 'ticket_id: TASK-0001\nthread_id: "task-thread-1"'),
    );
    const bound = await readProjectTicket(projectPath, created.ticketId);
    expect(bound.threadId).toBe("task-thread-1");

    const updated = await updateProjectTicket(projectPath, created.ticketId, {
      specialist: "video-specialist",
    });
    expect(updated.specialist).toBe("video-specialist");
    expect(updated.threadId).toBe("task-thread-1");

    const cleared = await updateProjectTicket(projectPath, created.ticketId, {
      specialist: "",
    });
    expect(cleared.specialist).toBeUndefined();
    expect(cleared.frontMatter.specialist).toBe("");
    expect(cleared.threadId).toBe("task-thread-1");
  });

  it("binds one durable task thread without permitting replacement or reuse", async () => {
    const projectPath = await temporaryProject();
    const first = await createProjectTicket({ projectPath, title: "First facility task" });
    const second = await createProjectTicket({ projectPath, title: "Second facility task" });

    const bound = await bindProjectTicketThread({
      projectPath,
      ticketId: first.ticketId,
      threadId: "task-thread-1",
    });
    expect(bound.threadId).toBe("task-thread-1");

    await expect(
      bindProjectTicketThread({
        projectPath,
        ticketId: first.ticketId,
        threadId: "task-thread-2",
      }),
    ).rejects.toThrow(`ticket_thread_already_bound:${first.ticketId}`);
    await expect(
      bindProjectTicketThread({
        projectPath,
        ticketId: second.ticketId,
        threadId: "task-thread-1",
      }),
    ).rejects.toThrow(`ticket_thread_already_claimed:${first.ticketId}`);
  });

  it("recovers a stale hook/UI ticket-thread lock before every ticket writer", async () => {
    const projectPath = await temporaryProject();
    const created = await createProjectTicket({ projectPath, title: "Locked update" });
    const lockPath = path.join(
      projectPath,
      ".farplane",
      "state",
      "ticket-thread-locks",
      `${created.ticketId}.lock`,
    );
    await mkdir(lockPath, { recursive: true });
    await utimes(lockPath, new Date(0), new Date(0));

    const updated = await updateProjectTicket(projectPath, created.ticketId, {
      specialist: "landing-page-specialist",
    });

    expect(updated.specialist).toBe("landing-page-specialist");
    await expect(readFile(lockPath, "utf-8")).rejects.toMatchObject({ code: "ENOENT" });

    await mkdir(lockPath, { recursive: true });
    await utimes(lockPath, new Date(0), new Date(0));
    await setProjectTicketNotes(projectPath, created.ticketId, "First locked note.");
    await expect(readFile(lockPath, "utf-8")).rejects.toMatchObject({ code: "ENOENT" });

    await mkdir(lockPath, { recursive: true });
    await utimes(lockPath, new Date(0), new Date(0));
    const noted = await appendProjectTicketNotes(
      projectPath,
      created.ticketId,
      "Second locked note.",
    );
    expect(noted.notes).toContain("First locked note.\n\nSecond locked note.");
    await expect(readFile(lockPath, "utf-8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves unknown YAML and unrelated Markdown while owning scalar fields and Notes", async () => {
    const projectPath = await temporaryProject();
    const directory = path.join(projectPath, "tickets", "TASK-0042");
    await mkdir(directory, { recursive: true });
    const original = [
      "---",
      "ticket_id: TASK-0042",
      "title: Original title",
      "phase: implementation",
      "status: active",
      "owner: original-owner",
      "claimed_by:",
      "priority: medium",
      "custom_field: keep-this",
      "feature_refs:",
      "  - FEAT-9999",
      "updated_at: 2026-01-01T00:00:00Z",
      "---",
      "",
      "# TASK-0042: Original title",
      "",
      "## Summary",
      "Do not rewrite this prose.",
      "",
      "## Notes",
      "Original note.",
      "",
      "## Links",
      "- keep: exact",
      "",
    ].join("\n");
    const ticketPath = path.join(directory, "ticket.md");
    await writeFile(ticketPath, original, "utf-8");

    await updateProjectTicket(projectPath, "TASK-0042", {
      owner: "new-owner",
      priority: "high",
    });
    await setProjectTicketNotes(projectPath, "TASK-0042", "Replacement note.");
    await appendProjectTicketNotes(projectPath, "TASK-0042", "Second note.");

    const raw = await readFile(ticketPath, "utf-8");
    expect(raw).toContain("custom_field: keep-this\nfeature_refs:\n  - FEAT-9999");
    expect(raw).toContain("## Summary\nDo not rewrite this prose.");
    expect(raw).toContain("## Links\n- keep: exact");
    expect(raw).toContain("## Notes\nReplacement note.\n\nSecond note.");
    expect(raw).toContain("owner: new-owner");
    expect(raw).toContain("priority: high");
  });

  it("allocates after active and archived TASK ids without reusing history", async () => {
    const projectPath = await temporaryProject();
    await mkdir(path.join(projectPath, "tickets", "TASK-0010"), { recursive: true });
    await mkdir(path.join(projectPath, "tickets", "archive", "TASK-0099"), { recursive: true });
    await writeFile(
      path.join(projectPath, "tickets", "TASK-0010", "ticket.md"),
      "---\nticket_id: TASK-0010\ntitle: Active\nphase: planning\nstatus: active\n---\n# Active\n",
    );

    const created = await createProjectTicket({ projectPath, title: "After archive" });
    expect(created.ticketId).toBe("TASK-0100");
    await expect(
      createProjectTicket({ projectPath, title: "Reuse", ticketId: "TASK-0099" }),
    ).rejects.toThrow("ticket_id_already_used:TASK-0099");
    expect((await listProjectTickets(projectPath)).map((row) => row.ticketId)).toEqual([
      "TASK-0010",
      "TASK-0100",
    ]);
  });

  it("rejects noncanonical identity and traversal attempts", async () => {
    const projectPath = await temporaryProject();
    await expect(readProjectTicket(projectPath, "../TASK-0001")).rejects.toThrow(
      "invalid_ticket_id",
    );
    await expect(
      createProjectTicket({ projectPath, title: "Traversal", ticketId: "TASK-0001/../../escape" }),
    ).rejects.toThrow("invalid_ticket_id");
    await expect(createProjectTicket({ projectPath: "relative", title: "No" })).rejects.toThrow(
      "invalid_project_path",
    );
  });

  it("isolates a partially saved ticket while retaining valid siblings", async () => {
    const projectPath = await temporaryProject();
    const valid = await createProjectTicket({ projectPath, title: "Valid sibling" });
    const partialDirectory = path.join(projectPath, "tickets", "TASK-0042");
    await mkdir(partialDirectory, { recursive: true });
    await writeFile(
      path.join(partialDirectory, "ticket.md"),
      "---\nticket_id:\nstatus: active\n---\n# Partial save\n",
      "utf-8",
    );

    const scan = await scanProjectTickets(projectPath);

    expect(scan.tickets.map((ticket) => ticket.ticketId)).toEqual([valid.ticketId]);
    expect(scan.issues).toEqual([
      expect.objectContaining({
        ticketId: "TASK-0042",
        error: "invalid_ticket_id:",
      }),
    ]);
    await expect(listProjectTickets(projectPath)).rejects.toThrow("invalid_ticket_id:");
  });

  it("projects heartbeat counts from tracking-context filesystem tickets", async () => {
    const projectPath = await temporaryProject();
    await createProjectTicket({ projectPath, title: "Open", status: "todo" });
    await createProjectTicket({ projectPath, title: "Working", status: "in_progress" });
    await createProjectTicket({ projectPath, title: "Blocked", status: "blocked" });

    const snapshot = await readTicketSnapshot(projectPath);
    expect(snapshot).toMatchObject({
      openTasks: 1,
      inProgressTasks: 1,
      blockedTasks: 1,
    });
    expect(JSON.parse(snapshot.tasksList)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ticketId: "TASK-0001", status: "todo" }),
        expect.objectContaining({ ticketId: "TASK-0002", status: "in_progress" }),
        expect.objectContaining({ ticketId: "TASK-0003", status: "blocked" }),
      ]),
    );
  });
});
