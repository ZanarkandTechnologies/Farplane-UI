import { describe, expect, it } from "vitest";
import { coreHookArgs, parseArgs } from "./install-farplane-hooks.mjs";

describe("install-farplane-hooks", () => {
  it("delegates read-only inspection to Core hooks list by default", () => {
    const options = parseArgs(["--json"]);
    const args = coreHookArgs(options);

    expect(args.slice(0, 2)).toEqual(["hooks", "list"]);
    expect(args).toContain("--json");
    expect(args).not.toContain("tsx");
  });

  it("delegates writes to Core hooks install", () => {
    const options = parseArgs(["--write", "--json", "--global"]);
    const args = coreHookArgs(options);

    expect(args.slice(0, 2)).toEqual(["hooks", "install"]);
    expect(args).toContain("--target");
    expect(args).toContain("--json");
    expect(args.join(" ")).not.toContain("skill-invocation-listener");
    expect(args.join(" ")).not.toContain("codex-event-miner");
  });
});
