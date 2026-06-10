import { afterEach, describe, expect, it, vi } from "vitest";
import { runCliReinstall, setCliReinstallRunnerForTests } from "./cli-reinstall.js";

describe("cli reinstall entrypoint", () => {
  afterEach(() => {
    setCliReinstallRunnerForTests(null);
    vi.restoreAllMocks();
  });

  it("uses the repo-root flag when provided", async () => {
    const runner = vi.fn().mockResolvedValue({
      attempted: true,
      ok: true,
      status: "reinstalled",
      note: "done",
      steps: [{ command: "npm link", ok: true, note: "ok" }],
    });
    const log = vi.fn();
    const error = vi.fn();
    setCliReinstallRunnerForTests(runner);

    const exitCode = await runCliReinstall(["--repo-root", "/tmp/farplane"], { log, error });

    expect(runner).toHaveBeenCalledWith({ repoRoot: "/tmp/farplane" });
    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith("Refreshing Farplane CLI from /tmp/farplane");
    expect(log).toHaveBeenCalledWith("ok: npm link");
    expect(log).toHaveBeenCalledWith("done");
    expect(error).not.toHaveBeenCalled();
  });

  it("returns a failure exit code and reports the helper error", async () => {
    const runner = vi.fn().mockResolvedValue({
      attempted: true,
      ok: false,
      status: "failed",
      note: "link failed",
      steps: [{ command: "npm link", ok: false, note: "permission denied" }],
    });
    const log = vi.fn();
    const error = vi.fn();
    setCliReinstallRunnerForTests(runner);

    const exitCode = await runCliReinstall([], { log, error });

    expect(exitCode).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Refreshing Farplane CLI from"));
    expect(log).toHaveBeenCalledWith("failed: npm link (permission denied)");
    expect(error).toHaveBeenCalledWith("link failed");
  });
});
