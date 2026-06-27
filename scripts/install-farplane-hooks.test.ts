import { describe, expect, it } from "vitest";
import { upsertFarplaneHookConfig } from "./install-farplane-hooks.mjs";

describe("install-farplane-hooks", () => {
  it("installs Farplane managed hooks idempotently", () => {
    const once = upsertFarplaneHookConfig({ hooks: { PostToolUse: [], Stop: [] } });
    const twice = upsertFarplaneHookConfig(once);
    const postToolEntries = twice.hooks.PostToolUse;
    const stopEntries = twice.hooks.Stop;
    const commands = [...postToolEntries, ...stopEntries].flatMap((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.map((hook) => hook.command),
    );

    expect(commands.filter((command) => command.includes("skill-invocation-listener/run.ts"))).toHaveLength(1);
    expect(commands.filter((command) => command.includes("file-change-listener/run.ts"))).toHaveLength(1);
    expect(commands.filter((command) => command.includes("thread-lineage-listener/run.ts"))).toHaveLength(1);
    expect(commands.filter((command) => command.includes("codex-event-miner/run.ts"))).toHaveLength(1);
    const fileChangeEntry = postToolEntries.find((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.some((hook) => hook.command.includes("file-change-listener/run.ts")),
    );
    expect(fileChangeEntry?.hooks[0]?.timeout).toBe(60);
    const lineageEntry = postToolEntries.find((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.some((hook) => hook.command.includes("thread-lineage-listener/run.ts")),
    );
    expect(lineageEntry?.matcher).toContain("fork_thread");
    expect(lineageEntry?.hooks[0]?.timeout).toBe(5);
    const minerEntry = stopEntries.find((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.some((hook) => hook.command.includes("codex-event-miner/run.ts")),
    );
    expect(minerEntry?.matcher).toBe("");
    expect(minerEntry?.hooks[0]?.timeout).toBe(10);
  });
});
