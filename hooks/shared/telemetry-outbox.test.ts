import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { publishHookTelemetryWithOutbox } from "./telemetry-outbox";

describe("telemetry-outbox", () => {
  it("queues failed publishes and replays them on the next successful run", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-outbox-"));
    try {
      mkdirSync(path.join(repo, ".farplane", "hooks"), { recursive: true });
      const outboxPath = path.join(repo, ".farplane", "hooks", "outbox.jsonl");
      const envelope = {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        eventAt: 1,
        eventKey: "file-change:1",
      };
      const failingFetch = vi.fn(async () => new Response("nope", { status: 503 }));

      const failed = await publishHookTelemetryWithOutbox([envelope], {
        endpointBaseUrl: "http://127.0.0.1:3211",
        projectPath: repo,
        outboxPath,
        fetchImpl: failingFetch as unknown as typeof fetch,
      });

      expect(failed).toMatchObject({ attempted: 1, published: 0, queued: 1, skipped: false });
      expect(readFileSync(outboxPath, "utf8")).toContain("file-change:1");

      const okFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const replayed = await publishHookTelemetryWithOutbox([], {
        endpointBaseUrl: "http://127.0.0.1:3211",
        projectPath: repo,
        outboxPath,
        fetchImpl: okFetch as unknown as typeof fetch,
      });

      expect(replayed).toMatchObject({ attempted: 0, published: 1, queued: 0, replayed: 1 });
      expect(readFileSync(outboxPath, "utf8")).toBe("");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
