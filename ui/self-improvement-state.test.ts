import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  readSelfImprovementRuns,
  SELF_IMPROVEMENT_PROJECT_CAP,
  SELF_IMPROVEMENT_RUN_CAP,
} from "./self-improvement-state";

const roots: string[] = [];

async function projectFixture(name: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `${name}-`));
  roots.push(root);
  return root;
}

async function writeTicket(
  root: string,
  id: string,
  input: { mode?: string; progress?: string; title?: string } = {},
): Promise<void> {
  const ticketDir = path.join(root, "tickets", id);
  await mkdir(ticketDir, { recursive: true });
  await writeFile(
    path.join(ticketDir, "ticket.md"),
    `---\nticket_id: ${id}\ntitle: ${input.title ?? id}\nstatus: in_progress\nupdated_at: 2026-08-05T00:00:00Z\n---\n\n# ${id}\n`,
  );
  await writeFile(
    path.join(ticketDir, "program.md"),
    `---\nkind: goal-program\nmode: ${input.mode ?? "skill_improvement"}\nstatus: active\n---\n\n# Self-Improve: test-skill\n`,
  );
  if (input.progress !== undefined) {
    await writeFile(path.join(ticketDir, "progress.md"), input.progress);
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ticket-backed self-improvement discovery", () => {
  it("excludes ordinary Goal Packets and accepts missing progress", async () => {
    const root = await projectFixture("self-improve-filter");
    await writeTicket(root, "TASK-1000");
    await writeTicket(root, "TASK-1001", { mode: "delivery" });
    const result = await readSelfImprovementRuns([
      { projectId: "one", projectName: "One", projectPath: root },
    ]);
    expect(result.packets.map((packet) => packet.ticketId)).toEqual(["TASK-1000"]);
    expect(result.packets[0]?.progressMarkdown).toBe("");
  });

  it("recognizes the established bounded skill-improvement Goal contract", async () => {
    const root = await projectFixture("self-improve-contract");
    await writeTicket(root, "TASK-1000", { mode: "delivery" });
    await writeFile(
      path.join(root, "tickets", "TASK-1000", "program.md"),
      "---\nstatus: active\n---\n\n# Goal Program\n\n- Shape: one `active_goal` with a bounded `skill_improvement` loop.\n",
    );
    const result = await readSelfImprovementRuns([
      { projectId: "one", projectName: "One", projectPath: root },
    ]);
    expect(result.packets.map((packet) => packet.ticketId)).toEqual(["TASK-1000"]);
  });

  it("caps configured projects and total runs", async () => {
    const projectRefs = [];
    for (let index = 0; index < SELF_IMPROVEMENT_PROJECT_CAP + 2; index += 1) {
      const root = await projectFixture(`self-improve-cap-${index}`);
      for (let run = 0; run < 5; run += 1) {
        await writeTicket(root, `TASK-${String(index * 5 + run + 1000).padStart(4, "0")}`);
      }
      projectRefs.push({ projectId: String(index), projectName: `P${index}`, projectPath: root });
    }
    const result = await readSelfImprovementRuns(projectRefs);
    expect(result.packets).toHaveLength(SELF_IMPROVEMENT_RUN_CAP);
    expect(result.truncated).toBe(true);
  });

  it("rejects packet symlinks that escape the project", async () => {
    const root = await projectFixture("self-improve-safe-root");
    const outside = await projectFixture("self-improve-outside");
    await writeTicket(root, "TASK-1000");
    await writeFile(path.join(outside, "program.md"), "mode: skill_improvement\n");
    await rm(path.join(root, "tickets", "TASK-1000", "program.md"));
    await symlink(path.join(outside, "program.md"), path.join(root, "tickets", "TASK-1000", "program.md"));
    const result = await readSelfImprovementRuns([
      { projectId: "safe", projectName: "Safe", projectPath: root },
    ]);
    expect(result.packets).toEqual([]);
    expect(result.issues[0]?.error).toContain("packet_path_outside_project");
  });

  it("isolates a failed project while returning healthy peers", async () => {
    const healthy = await projectFixture("self-improve-healthy");
    await writeTicket(healthy, "TASK-1000", { progress: "# Progress\n" });
    const missing = path.join(os.tmpdir(), `missing-${Date.now()}`);
    const result = await readSelfImprovementRuns([
      { projectId: "missing", projectName: "Missing", projectPath: missing },
      { projectId: "healthy", projectName: "Healthy", projectPath: healthy },
    ]);
    expect(result.packets).toHaveLength(1);
    expect(result.partial).toBe(true);
    expect(result.issues).toHaveLength(1);
  });
});
