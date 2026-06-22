#!/usr/bin/env tsx
/**
 * Entrypoint for the Codex PostToolUse tracked file-change listener.
 */
import {
  parseFileChangeBubbleCandidatesFromStdin,
  publishFileChangeBubbleCandidates,
} from "./handler";
import { resolveCodexSummaryOptions } from "../shared/codex-summary";
import {
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "../skill-invocation-listener/handler";
import { resolveProjectHookConfig } from "../shared/project-hook-config";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const debugEnabled = process.env.FARPLANE_FILE_CHANGE_HOOK_DEBUG === "1";
  const stdin = await readStdin();
  const projectPath = (() => {
    try {
      const parsed = JSON.parse(stdin) as Record<string, unknown>;
      return String(parsed.cwd ?? parsed.projectPath ?? parsed.project_path ?? process.cwd()).trim();
    } catch {
      return process.cwd();
    }
  })();
  const hookConfig = resolveProjectHookConfig(projectPath, process.env);
  if (!hookConfig.enabled) {
    if (debugEnabled) console.error("[file-change-listener] disabled by project hook config");
    return;
  }
  const candidates = await parseFileChangeBubbleCandidatesFromStdin(stdin, Date.now(), {
    trackedPathPatterns: hookConfig.patterns,
    codexSummary: resolveCodexSummaryOptions(process.env),
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
