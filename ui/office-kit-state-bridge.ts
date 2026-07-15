/**
 * OFFICE KIT STATE BRIDGE
 * =======================
 * Ownership: edge-owned, revision-checked persistence of office settings + objects.
 * Inputs/outputs: normalized next state -> committed/conflict/rollback/recovery receipt.
 * Side effects: journaled local filesystem writes beneath the Farplane sidecar root.
 * Invariant: a partial pair write is recoverable from the durable journal.
 */

import path from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { officeObjectStateToken } from "./office-kit-state-token";

type JsonObject = Record<string, unknown>;

export type OfficeKitCommitPaths = {
  settingsPath: string;
  objectsPath: string;
  journalPath: string;
};

export type OfficeKitCommitPhase =
  | "before_prepare"
  | "before_objects_commit"
  | "before_settings_commit"
  | "before_rollback_objects"
  | "before_rollback_settings";

export type OfficeKitCommitResult =
  | { ok: true; status: "committed"; revision: number; settings: JsonObject; objects: JsonObject[] }
  | { ok: false; status: "conflict"; revision: number; error: "office_kit_revision_conflict" }
  | { ok: false; status: "rolled_back"; revision: number; error: string }
  | { ok: false; status: "recovery_required"; revision: number; error: string };

type OfficeKitJournal = {
  version: 1;
  phase: "prepared" | "objects_committed";
  expectedRevision: number;
  nextRevision: number;
  previousSettings: JsonObject;
  previousObjects: JsonObject[];
  nextSettings: JsonObject;
  nextObjects: JsonObject[];
};

let commitQueue: Promise<void> = Promise.resolve();

export async function withOfficeKitStateLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = commitQueue;
  let release!: () => void;
  commitQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function readJsonIfMissing<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await rename(temporaryPath, filePath);
}

function revisionFromSettings(settings: JsonObject): number {
  const officeKit =
    settings.officeKit && typeof settings.officeKit === "object" && !Array.isArray(settings.officeKit)
      ? (settings.officeKit as JsonObject)
      : {};
  return Math.max(0, Math.floor(Number(officeKit.revision) || 0));
}

async function restoreJournal(
  paths: OfficeKitCommitPaths,
  journal: OfficeKitJournal,
  onPhase?: (phase: OfficeKitCommitPhase) => void | Promise<void>,
): Promise<void> {
  await onPhase?.("before_rollback_objects");
  await writeJsonAtomic(paths.objectsPath, journal.previousObjects);
  await onPhase?.("before_rollback_settings");
  await writeJsonAtomic(paths.settingsPath, journal.previousSettings);
  await rm(paths.journalPath, { force: true });
}

export async function recoverOfficeKitState(
  paths: OfficeKitCommitPaths,
): Promise<{ ok: true; recovered: boolean } | { ok: false; error: string }> {
  try {
    const journal = await readJsonIfMissing<OfficeKitJournal | null>(paths.journalPath, null);
    if (!journal) return { ok: true, recovered: false };
    await restoreJournal(paths, journal);
    return { ok: true, recovered: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "office_kit_recovery_failed",
    };
  }
}

export async function commitOfficeKitState(input: {
  paths: OfficeKitCommitPaths;
  expectedRevision: number;
  expectedObjectStateToken: string;
  settings: JsonObject;
  objects: JsonObject[];
  onPhase?: (phase: OfficeKitCommitPhase) => void | Promise<void>;
}): Promise<OfficeKitCommitResult> {
  return withOfficeKitStateLock(() => commitOfficeKitStateLocked(input));
}

async function commitOfficeKitStateLocked(input: {
  paths: OfficeKitCommitPaths;
  expectedRevision: number;
  expectedObjectStateToken: string;
  settings: JsonObject;
  objects: JsonObject[];
  onPhase?: (phase: OfficeKitCommitPhase) => void | Promise<void>;
}): Promise<OfficeKitCommitResult> {
  const recovery = await recoverOfficeKitState(input.paths);
  if (!recovery.ok) {
    return {
      ok: false,
      status: "recovery_required",
      revision: input.expectedRevision,
      error: recovery.error,
    };
  }

  let previousSettings: JsonObject;
  let previousObjects: JsonObject[];
  try {
    previousSettings = await readJsonIfMissing<JsonObject>(input.paths.settingsPath, {});
    previousObjects = await readJsonIfMissing<JsonObject[]>(input.paths.objectsPath, []);
  } catch (error) {
    return {
      ok: false,
      status: "recovery_required",
      revision: input.expectedRevision,
      error: error instanceof Error ? error.message : "office_kit_state_parse_failed",
    };
  }
  const currentRevision = revisionFromSettings(previousSettings);
  if (
    currentRevision !== input.expectedRevision ||
    officeObjectStateToken(previousObjects) !== input.expectedObjectStateToken
  ) {
    return {
      ok: false,
      status: "conflict",
      revision: currentRevision,
      error: "office_kit_revision_conflict",
    };
  }
  const nextRevision = revisionFromSettings(input.settings);
  if (nextRevision !== input.expectedRevision + 1) {
    return {
      ok: false,
      status: "conflict",
      revision: currentRevision,
      error: "office_kit_revision_conflict",
    };
  }
  const journal: OfficeKitJournal = {
    version: 1,
    phase: "prepared",
    expectedRevision: input.expectedRevision,
    nextRevision,
    previousSettings,
    previousObjects,
    nextSettings: input.settings,
    nextObjects: input.objects,
  };

  try {
    await input.onPhase?.("before_prepare");
    await writeJsonAtomic(input.paths.journalPath, journal);
    await input.onPhase?.("before_objects_commit");
    await writeJsonAtomic(input.paths.objectsPath, input.objects);
    journal.phase = "objects_committed";
    await writeJsonAtomic(input.paths.journalPath, journal);
    await input.onPhase?.("before_settings_commit");
    await writeJsonAtomic(input.paths.settingsPath, input.settings);
    await rm(input.paths.journalPath, { force: true });
    return {
      ok: true,
      status: "committed",
      revision: nextRevision,
      settings: input.settings,
      objects: input.objects,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "office_kit_commit_failed";
    try {
      await restoreJournal(input.paths, journal, input.onPhase);
      return {
        ok: false,
        status: "rolled_back",
        revision: currentRevision,
        error: message,
      };
    } catch (rollbackError) {
      return {
        ok: false,
        status: "recovery_required",
        revision: currentRevision,
        error:
          rollbackError instanceof Error
            ? `${message};rollback:${rollbackError.message}`
            : `${message};rollback:office_kit_rollback_failed`,
      };
    }
  }
}
