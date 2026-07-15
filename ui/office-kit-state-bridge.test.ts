import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  commitOfficeKitState,
  recoverOfficeKitState,
  withOfficeKitStateLock,
  type OfficeKitCommitPaths,
} from "./office-kit-state-bridge";
import { officeObjectStateToken } from "./office-kit-state-token";

const BEFORE_OBJECTS = [{ id: "before" }];

async function fixture(): Promise<OfficeKitCommitPaths> {
  const root = await mkdtemp(path.join(os.tmpdir(), "farplane-office-kit-"));
  const paths = {
    settingsPath: path.join(root, "office.json"),
    objectsPath: path.join(root, "office-objects.json"),
    journalPath: path.join(root, "office-kit-transaction.json"),
  };
  await writeFile(paths.settingsPath, '{"officeKit":{"revision":1}}\n', "utf-8");
  await writeFile(paths.objectsPath, '[{"id":"before"}]\n', "utf-8");
  return paths;
}

async function json(pathname: string): Promise<unknown> {
  return JSON.parse(await readFile(pathname, "utf-8"));
}

describe("office kit state bridge", () => {
  it("commits both sidecars under the expected revision", async () => {
    const paths = await fixture();
    const result = await commitOfficeKitState({
      paths,
      expectedRevision: 1,
      expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
      settings: { officeKit: { revision: 2 } },
      objects: [{ id: "after" }],
    });
    expect(result).toMatchObject({ ok: true, status: "committed", revision: 2 });
    expect(await json(paths.settingsPath)).toEqual({ officeKit: { revision: 2 } });
    expect(await json(paths.objectsPath)).toEqual([{ id: "after" }]);
  });

  it("rejects a stale expected revision without writes", async () => {
    const paths = await fixture();
    const result = await commitOfficeKitState({
      paths,
      expectedRevision: 0,
      expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
      settings: { officeKit: { revision: 2 } },
      objects: [{ id: "after" }],
    });
    expect(result).toMatchObject({ ok: false, status: "conflict", revision: 1 });
    expect(await json(paths.objectsPath)).toEqual([{ id: "before" }]);
  });

  it.each(["before_objects_commit", "before_settings_commit"] as const)(
    "rolls back a %s failure",
    async (failurePhase) => {
      const paths = await fixture();
      const result = await commitOfficeKitState({
        paths,
        expectedRevision: 1,
        expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
        settings: { officeKit: { revision: 2 } },
        objects: [{ id: "after" }],
        onPhase: (phase) => {
          if (phase === failurePhase) throw new Error(`injected:${phase}`);
        },
      });
      expect(result).toMatchObject({ ok: false, status: "rolled_back", revision: 1 });
      expect(await json(paths.settingsPath)).toEqual({ officeKit: { revision: 1 } });
      expect(await json(paths.objectsPath)).toEqual([{ id: "before" }]);
    },
  );

  it("leaves a journal when rollback fails and recovers on the next call", async () => {
    const paths = await fixture();
    const result = await commitOfficeKitState({
      paths,
      expectedRevision: 1,
      expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
      settings: { officeKit: { revision: 2 } },
      objects: [{ id: "after" }],
      onPhase: (phase) => {
        if (phase === "before_settings_commit" || phase === "before_rollback_objects") {
          throw new Error(`injected:${phase}`);
        }
      },
    });
    expect(result).toMatchObject({ ok: false, status: "recovery_required" });
    await expect(recoverOfficeKitState(paths)).resolves.toEqual({ ok: true, recovered: true });
    expect(await json(paths.settingsPath)).toEqual({ officeKit: { revision: 1 } });
    expect(await json(paths.objectsPath)).toEqual([{ id: "before" }]);
  });

  it("rejects an object-state race and a skipped next revision", async () => {
    const paths = await fixture();
    const staleObjects = officeObjectStateToken([{ id: "older" }]);
    await expect(
      commitOfficeKitState({
        paths,
        expectedRevision: 1,
        expectedObjectStateToken: staleObjects,
        settings: { officeKit: { revision: 2 } },
        objects: [{ id: "after" }],
      }),
    ).resolves.toMatchObject({ ok: false, status: "conflict" });
    await expect(
      commitOfficeKitState({
        paths,
        expectedRevision: 1,
        expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
        settings: { officeKit: { revision: 4 } },
        objects: [{ id: "after" }],
      }),
    ).resolves.toMatchObject({ ok: false, status: "conflict" });
  });

  it("fails closed when the transaction journal is malformed", async () => {
    const paths = await fixture();
    await writeFile(paths.journalPath, "{not-json", "utf-8");
    await expect(recoverOfficeKitState(paths)).resolves.toMatchObject({ ok: false });
    await expect(
      commitOfficeKitState({
        paths,
        expectedRevision: 1,
        expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
        settings: { officeKit: { revision: 2 } },
        objects: [{ id: "after" }],
      }),
    ).resolves.toMatchObject({ ok: false, status: "recovery_required" });
  });

  it("serializes competing commits so only the first expected revision wins", async () => {
    const paths = await fixture();
    let releaseFirst!: () => void;
    const pauseFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstPrepared!: () => void;
    const prepared = new Promise<void>((resolve) => {
      firstPrepared = resolve;
    });
    const base = {
      paths,
      expectedRevision: 1,
      expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
      settings: { officeKit: { revision: 2 } },
    };
    const first = commitOfficeKitState({
      ...base,
      objects: [{ id: "first" }],
      onPhase: async (phase) => {
        if (phase !== "before_prepare") return;
        firstPrepared();
        await pauseFirst;
      },
    });
    await prepared;
    const second = commitOfficeKitState({ ...base, objects: [{ id: "second" }] });
    releaseFirst();

    await expect(first).resolves.toMatchObject({ ok: true, status: "committed" });
    await expect(second).resolves.toMatchObject({ ok: false, status: "conflict", revision: 2 });
    expect(await json(paths.objectsPath)).toEqual([{ id: "first" }]);
  });

  it("keeps a locked reader from recovering an in-flight commit", async () => {
    const paths = await fixture();
    let releaseWriter!: () => void;
    const pauseWriter = new Promise<void>((resolve) => {
      releaseWriter = resolve;
    });
    let writerPrepared!: () => void;
    const prepared = new Promise<void>((resolve) => {
      writerPrepared = resolve;
    });
    const writer = commitOfficeKitState({
      paths,
      expectedRevision: 1,
      expectedObjectStateToken: officeObjectStateToken(BEFORE_OBJECTS),
      settings: { officeKit: { revision: 2 } },
      objects: [{ id: "committed" }],
      onPhase: async (phase) => {
        if (phase !== "before_objects_commit") return;
        writerPrepared();
        await pauseWriter;
      },
    });
    await prepared;
    const reader = withOfficeKitStateLock(async () => {
      const recovery = await recoverOfficeKitState(paths);
      return { recovery, objects: await json(paths.objectsPath) };
    });
    releaseWriter();

    await expect(writer).resolves.toMatchObject({ ok: true, status: "committed" });
    await expect(reader).resolves.toEqual({
      recovery: { ok: true, recovered: false },
      objects: [{ id: "committed" }],
    });
  });
});
