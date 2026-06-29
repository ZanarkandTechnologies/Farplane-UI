/**
 * FARPLANE FILE EVENT SNAPSHOT STORE
 * ==================================
 * Ownership: file-change listener hook.
 * Inputs/outputs: project-relative file paths and sanitized file-event snapshots.
 * Side effects: reads/writes `.farplane/file-events/state/*.json`.
 * Invariants: stores parser snapshots only, never raw file bodies.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FarplaneFileSnapshot } from "./file-event-registry";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function defaultFileEventStateDir(projectPath: string): string {
  return path.join(projectPath, ".farplane", "file-events", "state");
}

function snapshotPath(input: { projectPath: string; filePath: string; stateDir?: string }): string {
  const stateRoot = input.stateDir ?? defaultFileEventStateDir(input.projectPath);
  const hash = createHash("sha1").update(input.filePath).digest("hex").slice(0, 20);
  return path.join(stateRoot, `${hash}.json`);
}

export function readFileEventSnapshot(input: {
  projectPath: string;
  filePath: string;
  stateDir?: string;
}): FarplaneFileSnapshot | undefined {
  const filePath = snapshotPath(input);
  if (!existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return undefined;
    return parsed as FarplaneFileSnapshot;
  } catch {
    return undefined;
  }
}

export function writeFileEventSnapshot(input: {
  projectPath: string;
  filePath: string;
  stateDir?: string;
  snapshot: FarplaneFileSnapshot;
}): void {
  const filePath = snapshotPath(input);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(input.snapshot, null, 2)}\n`, "utf8");
}
