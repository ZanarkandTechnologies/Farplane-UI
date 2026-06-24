#!/usr/bin/env tsx
/**
 * Entrypoint for the Codex PostToolUse thread lineage listener.
 */

import {
  parseThreadLineageEventsFromStdin,
  publishThreadLineageEvents,
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "./handler";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const debugEnabled = process.env.FARPLANE_THREAD_LINEAGE_HOOK_DEBUG === "1";
  const stdin = await readStdin();
  const candidates = parseThreadLineageEventsFromStdin(stdin);
  if (candidates.length === 0) {
    if (debugEnabled) console.error("[thread-lineage-listener] no thread lineage event detected");
    return;
  }
  try {
    const searchDirs = [
      process.cwd(),
      ...candidates
        .map((candidate) => candidate.projectPath)
        .filter((value): value is string => Boolean(value)),
    ];
    const result = await publishThreadLineageEvents(candidates, {
      endpointBaseUrl: resolveDefaultEndpointBaseUrl(process.env, searchDirs),
      telemetryToken: resolveDefaultTelemetryToken(process.env, searchDirs),
    });
    if (debugEnabled) {
      console.error(
        `[thread-lineage-listener] candidates=${result.attempted} published=${result.published} skipped=${result.skipped}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[thread-lineage-listener] ${message}`);
  }
}

void main();
