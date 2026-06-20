import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runHeartbeat } from "./automation/heartbeat.js";
import { automationPaths, readJsonFile } from "./automation/state.js";
import type { BanditState } from "./automation/types.js";

async function setupProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-automation-test-"));
  await mkdir(path.join(root, "tickets", "todo"), { recursive: true });
  await writeFile(
    path.join(root, "tickets", "todo", "TKT-test.md"),
    [
      "---",
      "ticket_id: TKT-test",
      "status: todo",
      "last_verification: not run",
      "---",
      "",
      "# Test Ticket",
    ].join("\n"),
    "utf-8",
  );
  await mkdir(path.join(root, "farplane"), { recursive: true });
  await writeFile(path.join(root, "farplane", "goals.md"), "# Goals\n", "utf-8");
  return root;
}

describe("automation heartbeat", () => {
  it("dry-runs a local decision and writes append-only ledgers", async () => {
    const projectRoot = await setupProject();
    const result = await runHeartbeat({
      projectRoot,
      automationId: "farplane-ui-founder-heartbeat",
      dryRun: true,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(result.decision.actionId).toBe("ticket_execution");
    expect(result.thread.status).toBe("preview");
    expect(result.decision.context.openTicketCount).toBeGreaterThan(0);

    const paths = automationPaths(projectRoot);
    const decisions = await readFile(paths.decisions, "utf-8");
    const spawned = await readFile(paths.spawnedThreads, "utf-8");
    expect(decisions).toContain("ticket_execution");
    expect(spawned).toContain("preview");
  });

  it("applies metric snapshot rewards before choosing the next action", async () => {
    const projectRoot = await setupProject();
    const paths = automationPaths(projectRoot);
    await mkdir(paths.dir, { recursive: true });
    await writeFile(
      paths.metricSnapshots,
      `${JSON.stringify({
        id: "metric-1",
        capturedAt: "2026-06-19T11:50:00.000Z",
        horizon: "daily",
        actionId: "growth_research",
        reward: 0.8,
      })}\n`,
      "utf-8",
    );

    await runHeartbeat({
      projectRoot,
      automationId: "farplane-ui-founder-heartbeat",
      dryRun: true,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    const state = await readJsonFile<BanditState>(paths.banditState, {
      version: 1,
      updatedAt: "",
      arms: {},
      rewardedSnapshotIds: [],
    });
    expect(state.arms.growth_research?.totalReward).toBe(0.8);
    expect(state.rewardedSnapshotIds).toContain("metric-1");
  });

  it("spawns through the injected Codex seam when not in dry-run mode", async () => {
    const projectRoot = await setupProject();
    const result = await runHeartbeat({
      projectRoot,
      automationId: "farplane-ui-founder-heartbeat",
      dryRun: false,
      stateBase: "http://127.0.0.1:5173",
      now: new Date("2026-06-19T12:00:00.000Z"),
      spawnImpl: async (input) => {
        expect(input.threadName).toContain("[Farplane]");
        expect(input.prompt).toContain("Do not rely on farplane status.");
        return { threadId: "thread-test", turnId: "turn-test" };
      },
    });

    expect(result.thread.threadId).toBe("thread-test");
    expect(result.thread.status).toBe("spawned");
    expect(result.decision.spawnedThreadId).toBe("thread-test");
  });
});
