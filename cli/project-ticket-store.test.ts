import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendProjectTicketNotes,
  createProjectTicket,
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
