import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  mergeFilesystemThreadsIntoThreadList,
  readFilesystemObservedCodexThreads,
} from "./codex-thread-summaries";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function createProjectWithMessageWindow(summary: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-thread-summary-"));
  tempRoots.push(root);
  const dir = path.join(root, ".farplane", "state", "message-windows");
  await writeFile(path.join(dir, ".keep"), "", { flag: "w" }).catch(async () => {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(dir, { recursive: true }));
    await writeFile(path.join(dir, ".keep"), "");
  });
  await writeFile(
    path.join(dir, "019ef7c3-5169-7960-9e07-54bb7a47fa07.json"),
    JSON.stringify({ session_id: "019ef7c3-5169-7960-9e07-54bb7a47fa07", ...summary }),
  );
  return root;
}

async function createCodexHomeWithSessionIndex(lines: Record<string, unknown>[]): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-codex-home-"));
  tempRoots.push(root);
  await writeFile(
    path.join(root, "session_index.jsonl"),
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
  return root;
}

describe("codex thread summaries", () => {
  it("prefers the Codex session index thread name over the message-window fallback", async () => {
    const projectPath = await createProjectWithMessageWindow({
      updated_at: "2026-06-24T14:23:15.000Z",
      pending_user_turn: {
        user_text: "pls continue",
        user_captured_at: "2026-06-24T14:23:15.000Z",
      },
      rolling_exchanges: [
        {
          user_text: "first prompt that should not become the display title",
          user_captured_at: "2026-06-24T13:00:00.000Z",
          assistant_text: "done",
        },
      ],
    });
    const codexHome = await createCodexHomeWithSessionIndex([
      {
        id: "019ef7c3-5169-7960-9e07-54bb7a47fa07",
        thread_name: "Update table growth and walls",
        updated_at: "2026-06-24T14:20:00.000Z",
      },
    ]);

    const rows = await readFilesystemObservedCodexThreads({
      projectPaths: [projectPath],
      limit: 10,
      readProjectPmConfig: async () => null,
      codexHome,
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        name: "Update table growth and walls",
        preview: "pls continue",
      }),
    );
  });

  it("uses the first meaningful user turn as a stable fallback thread name", async () => {
    const projectPath = await createProjectWithMessageWindow({
      updated_at: "2026-06-24T14:23:15.000Z",
      pending_user_turn: {
        user_text: "pls continue",
        user_captured_at: "2026-06-24T14:23:15.000Z",
      },
      rolling_exchanges: [
        {
          user_text: "design the office wall algorithm",
          user_captured_at: "2026-06-24T13:00:00.000Z",
          assistant_text: "done",
        },
        {
          user_text: "the latest small follow-up",
          user_captured_at: "2026-06-24T14:00:00.000Z",
          assistant_text: "done",
        },
      ],
    });

    const rows = await readFilesystemObservedCodexThreads({
      projectPaths: [projectPath],
      limit: 10,
      readProjectPmConfig: async () => null,
      codexHome: await createCodexHomeWithSessionIndex([]),
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        name: "design the office wall algorithm",
        preview: "pls continue",
      }),
    );
  });

  it("enriches app-server rows with filesystem names without replacing preview", () => {
    const result = mergeFilesystemThreadsIntoThreadList({
      result: {
        data: [
          {
            id: "thread-1",
            preview: "latest message",
            updatedAt: 20,
          },
        ],
      },
      filesystemRows: [
        {
          id: "thread-1",
          name: "stable thread title",
          preview: "older preview",
          updatedAt: 10,
        },
      ],
      limit: 10,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        id: "thread-1",
        name: "stable thread title",
        preview: "latest message",
      }),
    ]);
  });
});
