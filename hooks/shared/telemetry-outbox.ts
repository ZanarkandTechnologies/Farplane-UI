/**
 * TELEMETRY OUTBOX
 * ================
 * Ownership: Farplane hook runtime.
 * Inputs: hook telemetry envelopes and endpoint config.
 * Outputs: best-effort publish with local replay for failed sends.
 * Side effects: writes `.farplane/hooks/outbox.jsonl` in the project root.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type HookTelemetryEnvelope<TPayload = unknown> = {
  hookName: string;
  hookType: string;
  projectId?: string;
  sessionId?: string;
  payload?: TPayload;
  eventAt?: number;
  eventKey?: string;
};

export type HookTelemetryPublishOptions = {
  endpointBaseUrl?: string;
  telemetryToken?: string;
  fetchImpl?: typeof fetch;
  projectPath?: string;
  outboxPath?: string;
  maxReplay?: number;
};

type OutboxRow = {
  envelope: HookTelemetryEnvelope;
  queuedAt: number;
  attempts: number;
  lastError?: string;
};

const DEFAULT_MAX_REPLAY = 25;

function defaultOutboxPath(projectPath: string | undefined): string | undefined {
  return projectPath ? path.join(projectPath, ".farplane", "hooks", "outbox.jsonl") : undefined;
}

async function readOutboxRows(outboxPath: string): Promise<OutboxRow[]> {
  let raw = "";
  try {
    raw = await readFile(outboxPath, "utf8");
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): OutboxRow | null => {
      try {
        const parsed = JSON.parse(line) as OutboxRow;
        return parsed?.envelope ? parsed : null;
      } catch {
        return null;
      }
    })
    .filter((row): row is OutboxRow => row !== null);
}

async function writeOutboxRows(outboxPath: string, rows: readonly OutboxRow[]): Promise<void> {
  await mkdir(path.dirname(outboxPath), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  const tmpPath = `${outboxPath}.${process.pid}.tmp`;
  await writeFile(tmpPath, body ? `${body}\n` : "", "utf8");
  await rename(tmpPath, outboxPath);
}

async function postEnvelope(
  envelope: HookTelemetryEnvelope,
  options: Required<Pick<HookTelemetryPublishOptions, "fetchImpl">> & Pick<HookTelemetryPublishOptions, "endpointBaseUrl" | "telemetryToken">,
): Promise<void> {
  const endpointBaseUrl = options.endpointBaseUrl?.replace(/\/+$/, "");
  if (!endpointBaseUrl) throw new Error("telemetry_endpoint_missing");
  const response = await options.fetchImpl(`${endpointBaseUrl}/telemetry/hooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.telemetryToken ? { "x-farplane-telemetry-token": options.telemetryToken } : {}),
    },
    body: JSON.stringify(envelope),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`telemetry_ingest_failed:${response.status}${detail ? `:${detail.slice(0, 160)}` : ""}`);
  }
}

export async function publishHookTelemetryWithOutbox<TPayload = unknown>(
  envelopes: readonly HookTelemetryEnvelope<TPayload>[],
  options: HookTelemetryPublishOptions = {},
): Promise<{ attempted: number; published: number; queued: number; replayed: number; skipped: boolean }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const outboxPath = options.outboxPath ?? defaultOutboxPath(options.projectPath);
  const queuedRows = outboxPath ? await readOutboxRows(outboxPath) : [];
  if (!options.endpointBaseUrl || (envelopes.length === 0 && queuedRows.length === 0)) {
    return { attempted: envelopes.length, published: 0, queued: queuedRows.length, replayed: 0, skipped: true };
  }
  const replayLimit = Math.max(0, options.maxReplay ?? DEFAULT_MAX_REPLAY);
  const replayRows = queuedRows.slice(0, replayLimit);
  const remainingRows = queuedRows.slice(replayRows.length);
  let published = 0;
  let replayed = 0;
  const nextRows: OutboxRow[] = [];

  for (const row of replayRows) {
    try {
      await postEnvelope(row.envelope, { endpointBaseUrl: options.endpointBaseUrl, telemetryToken: options.telemetryToken, fetchImpl });
      published += 1;
      replayed += 1;
    } catch (error) {
      nextRows.push({
        ...row,
        attempts: row.attempts + 1,
        lastError: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      });
    }
  }

  for (const envelope of envelopes) {
    try {
      await postEnvelope(envelope, { endpointBaseUrl: options.endpointBaseUrl, telemetryToken: options.telemetryToken, fetchImpl });
      published += 1;
    } catch (error) {
      nextRows.push({
        envelope,
        queuedAt: Date.now(),
        attempts: 1,
        lastError: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      });
    }
  }

  const allRows = [...nextRows, ...remainingRows];
  if (outboxPath && (allRows.length > 0 || queuedRows.length > 0)) await writeOutboxRows(outboxPath, allRows);
  return {
    attempted: envelopes.length,
    published,
    queued: allRows.length,
    replayed,
    skipped: false,
  };
}
