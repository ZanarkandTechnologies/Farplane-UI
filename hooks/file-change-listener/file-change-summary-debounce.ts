/**
 * FILE CHANGE SUMMARY DEBOUNCE
 * ============================
 * Ownership: file-change listener hook.
 * Inputs/outputs: project-relative file paths and a tiny per-file pending ledger.
 * Side effects: reads/writes `.farplane/file-events/summary-debounce/*.json`.
 * Invariants: records timing and hashes only, never raw file bodies or tool payloads.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_FILE_CHANGE_SUMMARY_DEBOUNCE_MS } from "../shared/file-change-summary-settings";

type SummaryDebounceRecord = {
  schemaVersion: 1;
  filePath: string;
  token: string;
  lastChangeAt: number;
  lastContentHash?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function defaultDebounceStateDir(projectPath: string): string {
  return path.join(projectPath, ".farplane", "file-events", "summary-debounce");
}

function debouncePath(input: { projectPath: string; filePath: string; stateDir?: string }): string {
  const stateRoot = input.stateDir ?? defaultDebounceStateDir(input.projectPath);
  const hash = createHash("sha1").update(input.filePath).digest("hex").slice(0, 20);
  return path.join(stateRoot, `${hash}.json`);
}

function readDebounceRecord(input: {
  projectPath: string;
  filePath: string;
  stateDir?: string;
}): SummaryDebounceRecord | undefined {
  const filePath = debouncePath(input);
  if (!existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return undefined;
    if (
      typeof parsed.filePath !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.lastChangeAt !== "number"
    ) {
      return undefined;
    }
    return parsed as SummaryDebounceRecord;
  } catch {
    return undefined;
  }
}

function writeDebounceRecord(input: {
  projectPath: string;
  filePath: string;
  now: number;
  stateDir?: string;
  contentHash?: string;
}): string {
  const token = `${input.now}-${randomUUID()}`;
  const filePath = debouncePath(input);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        filePath: input.filePath,
        token,
        lastChangeAt: input.now,
        lastContentHash: input.contentHash,
      } satisfies SummaryDebounceRecord,
      null,
      2,
    )}\n`,
    "utf8",
  );
  return token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function contentDebounceHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

export async function waitForSettledFileChangeSummary(input: {
  projectPath: string;
  filePath: string;
  now: number;
  debounceMs?: number;
  stateDir?: string;
  contentHash?: string;
}): Promise<boolean> {
  const debounceMs =
    typeof input.debounceMs === "number" && Number.isFinite(input.debounceMs)
      ? Math.max(0, Math.floor(input.debounceMs))
      : DEFAULT_FILE_CHANGE_SUMMARY_DEBOUNCE_MS;
  const token = writeDebounceRecord(input);
  if (debounceMs === 0) return true;

  await sleep(debounceMs);
  const latest = readDebounceRecord(input);
  return latest?.token === token;
}
