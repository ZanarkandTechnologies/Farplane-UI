import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildThreadLineageBackfillEvents,
  codexProjectIdFromPath,
  registerThreadCommands,
  runThreadLineageBackfill,
} from "./thread-commands.js";
import type { CodexThread } from "../ui/src/modules/runtime/lib/codex-app-server/types.js";

const PROJECT = "/Users/kenji/work/Farplane-UI";

function thread(input: Partial<CodexThread> & Pick<CodexThread, "id">): CodexThread {
  return {
    cwd: PROJECT,
    preview: "",
    updatedAt: 10,
    ...input,
  };
}

function fetchJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("thread lineage backfill CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives the same project id shape used by Codex normalizers", () => {
    expect(codexProjectIdFromPath("/Users/Kenji/Farplane UI")).toBe("codex-proj-users-kenji-farplane-ui");
  });

  it("builds sanitized explicit-parent lineage events", () => {
    const events = buildThreadLineageBackfillEvents({
      projectPath: PROJECT,
      threads: [
        thread({ id: "child-1", parentThreadId: "parent-1", name: "Forked work" }),
        thread({ id: "root-1" }),
        thread({ id: "other-project", cwd: "/tmp/elsewhere", parentThreadId: "parent-2" }),
      ],
    });

    expect(events).toEqual([
      expect.objectContaining({
        hookName: "thread-lineage-backfill",
        hookType: "Backfill",
        sessionId: "parent-1",
        eventKey: "thread-lineage:v1:codex-proj-users-kenji-work-farplane-ui:parent-1:child-1:forked",
        payload: expect.objectContaining({
          eventName: "thread.forked",
          sourceTool: "backfill",
          parentThreadId: "parent-1",
          childThreadId: "child-1",
          title: "Forked work",
        }),
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("prompt");
  });

  it("dry-runs without requiring Convex site URL or publishing telemetry", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      fetchJson({
        ok: true,
        result: { data: [thread({ id: "child-1", parentThreadId: "parent-1" })] },
      }),
    );

    const result = await runThreadLineageBackfill({
      dryRun: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      projectPath: PROJECT,
      stateBase: "http://state.local",
    });

    expect(result).toMatchObject({ dryRun: true, scanned: 1, emitted: 1, published: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls.at(0)?.[0]).toBe("http://state.local/codex/app-server/rpc");
  });

  it("publishes backfill rows to hook telemetry batch ingest", async () => {
    const fetchImpl = vi
      .fn(async (..._args: Parameters<typeof fetch>) => fetchJson({ ok: true }))
      .mockResolvedValueOnce(
        fetchJson({
          ok: true,
          result: { data: [thread({ id: "child-1", parentThreadId: "parent-1" })] },
        }),
      )
      .mockResolvedValueOnce(fetchJson({ ok: true, count: 1, duplicateCount: 0, ids: ["id-1"] }));

    const result = await runThreadLineageBackfill({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      projectPath: PROJECT,
      siteUrl: "https://example.convex.site",
      stateBase: "http://state.local",
      telemetryToken: "token",
    });

    expect(result).toMatchObject({ dryRun: false, scanned: 1, emitted: 1, published: 1 });
    expect(fetchImpl.mock.calls.at(1)?.[0]).toBe("https://example.convex.site/telemetry/hooks/batch");
    expect(fetchImpl.mock.calls.at(1)?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ "x-farplane-telemetry-token": "token" }),
      }),
    );
  });

  it("registers a JSON dry-run command", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      fetchJson({
        ok: true,
        result: { data: [thread({ id: "child-1", parentThreadId: "parent-1" })] },
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);
    const program = new Command();
    registerThreadCommands(program);

    await program.parseAsync(
      [
        "threads",
        "backfill",
        "--dry-run",
        "--json",
        "--project-path",
        PROJECT,
        "--state-base",
        "http://state.local",
      ],
      { from: "user" },
    );

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual(expect.objectContaining({ ok: true, dryRun: true, emitted: 1 }));
  });
});
