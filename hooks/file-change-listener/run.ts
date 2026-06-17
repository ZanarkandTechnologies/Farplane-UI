#!/usr/bin/env tsx
/**
 * Entrypoint for the Codex PostToolUse tracked file-change listener.
 */
import {
  parseFileChangeBubbleCandidatesFromStdin,
  publishFileChangeBubbleCandidates,
} from "./handler";
import {
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "../skill-invocation-listener/handler";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseTrackedPathPatterns(value: string | undefined): string[] | undefined {
  const patterns = value
    ?.split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return patterns && patterns.length > 0 ? patterns : undefined;
}

async function main(): Promise<void> {
  const debugEnabled = process.env.FARPLANE_FILE_CHANGE_HOOK_DEBUG === "1";
  const stdin = await readStdin();
  const candidates = parseFileChangeBubbleCandidatesFromStdin(stdin, Date.now(), {
    trackedPathPatterns: parseTrackedPathPatterns(process.env.FARPLANE_FILE_CHANGE_PATTERNS),
  });
  if (candidates.length === 0) {
    if (debugEnabled) console.error("[file-change-listener] no tracked file changes detected");
    return;
  }
  try {
    const searchDirs = [
      process.cwd(),
      ...candidates.map((candidate) => candidate.projectPath),
    ];
    const result = await publishFileChangeBubbleCandidates(candidates, {
      endpointBaseUrl: resolveDefaultEndpointBaseUrl(process.env, searchDirs),
      telemetryToken: resolveDefaultTelemetryToken(process.env, searchDirs),
    });
    if (debugEnabled) {
      console.error(
        `[file-change-listener] candidates=${result.attempted} published=${result.published} skipped=${result.skipped}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[file-change-listener] ${message}`);
  }
}

void main();
