import { describe, expect, it } from "vitest";
import { upsertFarplaneHookConfig } from "./install-farplane-hooks.mjs";

describe("install-farplane-hooks", () => {
  it("installs both Farplane PostToolUse hooks idempotently", () => {
    const once = upsertFarplaneHookConfig({ hooks: { PostToolUse: [] } });
    const twice = upsertFarplaneHookConfig(once);
    const entries = twice.hooks.PostToolUse;
    const commands = entries.flatMap((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.map((hook) => hook.command),
    );

    expect(commands.filter((command) => command.includes("skill-invocation-listener/run.ts"))).toHaveLength(1);
    expect(commands.filter((command) => command.includes("file-change-listener/run.ts"))).toHaveLength(1);
    const fileChangeEntry = entries.find((entry: { hooks: Array<{ command: string }> }) =>
      entry.hooks.some((hook) => hook.command.includes("file-change-listener/run.ts")),
    );
    expect(fileChangeEntry?.hooks[0]?.timeout).toBe(60);
  });
});
