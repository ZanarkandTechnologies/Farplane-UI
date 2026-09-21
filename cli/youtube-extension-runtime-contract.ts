/**
 * YouTube extension runtime contract and local-process dependencies.
 *
 * Inputs: fixed loopback endpoints plus the Farplane sidecar directory.
 * Outputs: validated health/record data and resolved runtime operations.
 * Side effects: probes listeners and reads or writes the private runtime record.
 */

import { execFile, spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import {
  YOUTUBE_APP_SERVER_PORT,
  YOUTUBE_BRIDGE_PORT,
  YOUTUBE_BRIDGE_URL,
  YOUTUBE_HEALTH_PATH,
  YOUTUBE_LOCAL_HOST,
  YOUTUBE_RUNTIME_CLIENT,
  YOUTUBE_RUNTIME_CLIENT_HEADER,
  YOUTUBE_RUNTIME_DIRECTORY,
  YOUTUBE_RUNTIME_NAME,
  YOUTUBE_RUNTIME_RECORD_FILENAME,
  YOUTUBE_RUNTIME_TOKEN_HEADER,
} from "../apps/youtube-shortcut/local-runtime.js";
import { resolveFarplaneUiRepoRoot } from "./repo-root.js";
import { resolveFarplaneHome } from "./runtime-config.js";

const START_TIMEOUT_MS = 60_000;
export const YOUTUBE_HEALTH_TIMEOUT_MS = 30_000;
export const YOUTUBE_START_RETRY_DELAY_MS = 300;

export type YoutubeBridgeHealth = {
  ok: true;
  service: true;
  /** Absent only on an already-running bridge from before TASK-0446. */
  runtime?: typeof YOUTUBE_RUNTIME_NAME;
  appServer: boolean;
  authentication?: "ready" | "required" | "unavailable";
  authenticationMessage?: string;
  intelligestSkill: boolean;
  userProfile?: boolean;
  runtimeToken?: string;
};

export type YoutubeBridgeProbe =
  | { state: "absent" }
  | { state: "ready" | "unready"; health: YoutubeBridgeHealth }
  | { state: "conflict"; reason: "unreachable" | "unexpected_response" | "unknown_service" };

export type YoutubeRuntimeRecord = {
  schemaVersion: 1;
  bridgePid: number;
  runtimeToken: string;
  startedAt: string;
};

export type YoutubeRuntimeStore = {
  path: string;
  read(): Promise<YoutubeRuntimeRecord | undefined>;
  write(record: YoutubeRuntimeRecord): Promise<void>;
  remove(): Promise<void>;
};

export type YoutubeOwnedChild = { kind: "app-server" | "bridge"; child: ChildProcess };

export type YoutubeStartResult = {
  action: "start";
  outcome: "started" | "attached" | "conflict";
  ready: boolean;
  bridge: { port: number; state: "started" | "attached" | "conflict" };
  appServer: { port: number; state: "started" | "attached" | "unavailable" };
  reason?: string;
};

export type YoutubeStartOperation = {
  result: YoutubeStartResult;
  ownedChildren: YoutubeOwnedChild[];
  runtimeRecord?: YoutubeRuntimeRecord;
};

export type YoutubeRuntimeInspection = {
  action: "status" | "doctor";
  ready: boolean;
  bridge: { port: number; state: YoutubeBridgeProbe["state"]; pid?: number };
  appServer: { port: number; state: "ready" | "listening" | "absent" | "unknown" };
  runtimeRecord: { state: "present" | "absent" | "invalid"; bridgePid?: number };
  issues?: string[];
};

export type YoutubeStopResult = {
  action: "stop";
  outcome: "stopped" | "not_running" | "not_managed" | "identity_mismatch" | "failed";
  bridge: { port: number; pid?: number };
  reason?: string;
};

export type YoutubeRuntimeDependencies = {
  signal?: AbortSignal;
  probeBridge?: (runtimeToken?: string) => Promise<YoutubeBridgeProbe>;
  isAppServerListening?: () => Promise<boolean>;
  findListeningPid?: (port: number) => Promise<number | undefined>;
  spawnProcess?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  signalProcess?: (pid: number, signal: NodeJS.Signals) => void;
  runtimeStore?: YoutubeRuntimeStore;
  repoRoot?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  randomToken?: () => string;
  startTimeoutMs?: number;
};

export type ResolvedYoutubeRuntimeDependencies = Required<YoutubeRuntimeDependencies>;

function parseRuntimeRecord(value: unknown): YoutubeRuntimeRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (
    row.schemaVersion !== 1 ||
    !Number.isInteger(row.bridgePid) ||
    (row.bridgePid as number) <= 0 ||
    typeof row.runtimeToken !== "string" ||
    row.runtimeToken.length < 20 ||
    typeof row.startedAt !== "string"
  )
    return undefined;
  return row as unknown as YoutubeRuntimeRecord;
}

export function resolveYoutubeRuntimeRecordPath(farplaneHome = resolveFarplaneHome()): string {
  return path.join(farplaneHome, YOUTUBE_RUNTIME_DIRECTORY, YOUTUBE_RUNTIME_RECORD_FILENAME);
}

export function createYoutubeRuntimeStore(
  farplaneHome = resolveFarplaneHome(),
): YoutubeRuntimeStore {
  const recordPath = resolveYoutubeRuntimeRecordPath(farplaneHome);
  return {
    path: recordPath,
    async read() {
      try {
        const parsed = parseRuntimeRecord(JSON.parse(await readFile(recordPath, "utf8")));
        if (!parsed) throw new Error("invalid_youtube_runtime_record");
        return parsed;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    async write(record) {
      const parent = path.dirname(recordPath);
      const temporaryPath = `${recordPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
      await mkdir(parent, { recursive: true, mode: 0o700 });
      await writeFile(temporaryPath, `${JSON.stringify(record)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, recordPath);
    },
    async remove() {
      await rm(recordPath, { force: true });
    },
  };
}

function isConnectionRefused(error: unknown): boolean {
  const cause =
    error && typeof error === "object" && "cause" in error
      ? (error as { cause?: unknown }).cause
      : undefined;
  const code =
    (error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined) ??
    (cause && typeof cause === "object" && "code" in cause
      ? (cause as { code?: unknown }).code
      : undefined);
  return code === "ECONNREFUSED";
}

function validHealth(value: unknown): YoutubeBridgeHealth | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  if (
    body.ok !== true ||
    body.service !== true ||
    (body.runtime !== undefined && body.runtime !== YOUTUBE_RUNTIME_NAME) ||
    typeof body.appServer !== "boolean" ||
    typeof body.intelligestSkill !== "boolean"
  )
    return undefined;
  return body as unknown as YoutubeBridgeHealth;
}

export async function probeYoutubeBridge(runtimeToken?: string): Promise<YoutubeBridgeProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${YOUTUBE_BRIDGE_URL}${YOUTUBE_HEALTH_PATH}`, {
      method: "POST",
      headers: {
        [YOUTUBE_RUNTIME_CLIENT_HEADER]: YOUTUBE_RUNTIME_CLIENT,
        "x-farplane-auth-refresh": "true",
        ...(runtimeToken ? { [YOUTUBE_RUNTIME_TOKEN_HEADER]: runtimeToken } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) return { state: "conflict", reason: "unexpected_response" };
    const health = validHealth(await response.json());
    if (!health) return { state: "conflict", reason: "unknown_service" };
    return health.appServer && health.intelligestSkill && health.authentication === "ready"
      ? { state: "ready", health }
      : { state: "unready", health };
  } catch (error) {
    return isConnectionRefused(error)
      ? { state: "absent" }
      : { state: "conflict", reason: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}

async function portIsListening(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: YOUTUBE_LOCAL_HOST, port });
    const finish = (listening: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(listening);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function lsofListeningPid(port: number): Promise<number | undefined> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8" },
      (error, stdout) => {
        if (error) {
          const code = (error as { code?: number | string }).code;
          if (code === 1 || code === "1") return resolvePromise(undefined);
          return reject(error);
        }
        const pid = Number.parseInt(stdout.trim().split(/\s+/)[0] ?? "", 10);
        resolvePromise(Number.isInteger(pid) && pid > 0 ? pid : undefined);
      },
    );
  });
}

export function resolveYoutubeRuntimeDependencies(
  overrides: YoutubeRuntimeDependencies,
): ResolvedYoutubeRuntimeDependencies {
  return {
    signal: overrides.signal ?? new AbortController().signal,
    probeBridge: overrides.probeBridge ?? probeYoutubeBridge,
    isAppServerListening:
      overrides.isAppServerListening ?? (() => portIsListening(YOUTUBE_APP_SERVER_PORT)),
    findListeningPid: overrides.findListeningPid ?? lsofListeningPid,
    spawnProcess: overrides.spawnProcess ?? spawn,
    signalProcess: overrides.signalProcess ?? ((pid, signal) => process.kill(pid, signal)),
    runtimeStore: overrides.runtimeStore ?? createYoutubeRuntimeStore(),
    repoRoot: overrides.repoRoot ?? resolveFarplaneUiRepoRoot(import.meta.url),
    now: overrides.now ?? Date.now,
    sleep:
      overrides.sleep ?? ((ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))),
    randomToken: overrides.randomToken ?? (() => randomBytes(32).toString("base64url")),
    startTimeoutMs: overrides.startTimeoutMs ?? START_TIMEOUT_MS,
  };
}
