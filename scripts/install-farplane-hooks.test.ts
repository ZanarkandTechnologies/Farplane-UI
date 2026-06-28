import { describe, expect, it } from "vitest";
import { pruneFarplaneHookConfig, upsertFarplaneHookConfig } from "./install-farplane-hooks.mjs";

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

  it("prunes Farplane managed hooks from a project config after global install", () => {
    const projectConfig = upsertFarplaneHookConfig({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: "python3 \"$HOME/.codex/hooks/farplane_console_ping.py\"",
                statusMessage: "Global stop heartbeat",
                timeout: 5,
              },
            ],
          },
        ],
      },
    });
    const pruned = pruneFarplaneHookConfig(projectConfig);
    const commands = Object.values(pruned.hooks)
      .flatMap((entries) => entries as Array<{ hooks: Array<{ command: string }> }>)
      .flatMap((entry) => entry.hooks.map((hook) => hook.command));

    expect(commands.some((command) => command.includes("codex-event-miner/run.ts"))).toBe(false);
    expect(commands.some((command) => command.includes("farplane_console_ping.py"))).toBe(true);
  });
});
