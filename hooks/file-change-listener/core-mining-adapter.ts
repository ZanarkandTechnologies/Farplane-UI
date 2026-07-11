import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publishHookTelemetryWithOutbox } from "../shared/telemetry-outbox";

type JsonRecord = Record<string, unknown>;

export type CoreFileEventRunner = (input: {
  args: readonly string[];
  cwd: string;
  stdin: string;
}) => Promise<unknown>;

function defaultRunner(input: {
  args: readonly string[];
  cwd: string;
  stdin: string;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn("farplane", [...input.args], {
      cwd: input.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      const errorText = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        reject(new Error(errorText || `farplane_mining_file_change_failed:${code ?? "unknown"}`));
        return;
      }
      const text = Buffer.concat(stdout).toString("utf8").trim();
      try {
        resolve(text ? JSON.parse(text) : null);
      } catch {
        reject(new Error("farplane_mining_file_change_invalid_json"));
      }
    });
    child.stdin.end(input.stdin);
  });
}

function eventRows(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value.events)) return value.events.filter(isRecord);
  if (Array.isArray(value.captured_event_ids)) {
    return value.captured_event_ids.map((eventId) => ({ event_id: String(eventId) }));
  }
  if (isRecord(value.data)) return eventRows(value.data);
  return [];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Hands the raw PostToolUse payload to Core. Core owns event classification,
 * project routing, dedupe, run creation, and durable delivery state.
 */
export async function handleFileChangeWithCore(
  stdin: string,
  projectPath: string,
  runner: CoreFileEventRunner = defaultRunner,
): Promise<JsonRecord[]> {
  const result = await runner({
    args: ["mining", "handle-file-change", "--payload", "-", "--json"],
    cwd: projectPath,
    stdin,
  });
  const rows = eventRows(result);
  return Promise.all(
    rows.map(async (row) => {
      const eventId = String(row.event_id ?? "").trim();
      if (!/^[a-f0-9]{64}$/i.test(eventId) || row.event_name) return row;
      try {
        const stored = JSON.parse(
          await readFile(
            path.join(projectPath, ".farplane", "events", "records", `${eventId}.json`),
            "utf8",
          ),
        );
        return isRecord(stored) ? stored : row;
      } catch {
        return row;
      }
    }),
  );
}

/** Mirrors Core records to Convex when configured; Core remains authoritative. */
export async function publishCoreFileEventMirrors(
  events: JsonRecord[],
  options: {
    endpointBaseUrl?: string;
    telemetryToken?: string;
    fetchImpl?: typeof fetch;
    projectPath: string;
  },
): Promise<{ attempted: number; published: number; skipped: boolean }> {
  const rows = events.filter((event) => event.event_name && event.event_id);
  return publishHookTelemetryWithOutbox(
    rows.map((event) => {
      const provenance = isRecord(event.provenance) ? event.provenance : {};
      const eventAt = Date.parse(String(event.event_at ?? ""));
      return {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        projectId: String(event.project_id ?? "") || undefined,
        sessionId: String(provenance.session_id ?? "") || undefined,
        payload: {
          schemaVersion: event.schema_version,
          eventId: event.event_id,
          eventName: event.event_name,
          entityRef: event.entity_ref,
          terminal: event.terminal,
          privacySafeDelta: event.privacy_safe_delta,
          source: "farplane_core",
        },
        eventAt: Number.isFinite(eventAt) ? eventAt : Date.now(),
        eventKey: String(event.event_key ?? `farplane-file-event:${event.event_id}`),
      };
    }),
    options,
  );
}
