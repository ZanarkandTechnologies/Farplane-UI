#!/usr/bin/env tsx
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFarplaneConfigValue } from "../../cli/runtime-config";
import { resolveCodexSummaryOptions } from "../shared/codex-summary";
import { resolveProjectHookConfig } from "../shared/project-hook-config";
import {
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "../skill-invocation-listener/handler";
import { handleFileChangeWithCore, publishCoreFileEventMirrors } from "./core-mining-adapter";
/**
 * Entrypoint for the Codex PostToolUse tracked file-change listener.
 */
import {
  parseFileChangeBubbleCandidatesFromStdin,
  publishFileChangeBubbleCandidates,
} from "./handler";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const debugEnabled = readFarplaneConfigValue("FARPLANE_FILE_CHANGE_HOOK_DEBUG") === "1";
  const stdin = await readStdin();
  const projectPath = (() => {
    try {
      const parsed = JSON.parse(stdin) as Record<string, unknown>;
      return String(
        parsed.cwd ?? parsed.projectPath ?? parsed.project_path ?? process.cwd(),
      ).trim();
    } catch {
      return process.cwd();
    }
  })();
  const hookConfig = resolveProjectHookConfig(projectPath, process.env);
  const parseOptions = {
    trackedPathPatterns: hookConfig.patterns,
    codexSummary: resolveCodexSummaryOptions(process.env),
    summaryDebounceMs: hookConfig.summaryDebounceMs,
  };
  const candidates = hookConfig.summaryEnabled
    ? await parseFileChangeBubbleCandidatesFromStdin(stdin, Date.now(), parseOptions)
    : [];
  try {
    const searchDirs = [
      repoRoot,
      process.cwd(),
      ...candidates.map((candidate) => candidate.projectPath),
    ];
    const endpointBaseUrl = resolveDefaultEndpointBaseUrl(process.env, searchDirs);
    const telemetryToken = resolveDefaultTelemetryToken(process.env, searchDirs);
    const coreEvents = await handleFileChangeWithCore(stdin, projectPath);
    const mirrorResult = await publishCoreFileEventMirrors(coreEvents, {
      endpointBaseUrl,
      telemetryToken,
      projectPath,
    });
    const result = await publishFileChangeBubbleCandidates(candidates, {
      endpointBaseUrl,
      telemetryToken,
    });
    if (debugEnabled) {
      console.error(
        `[file-change-listener] coreEvents=${coreEvents.length} mirrors=${mirrorResult.published}/${mirrorResult.attempted} summaries=${result.attempted}/${result.published}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[file-change-listener] ${message}`);
  }
}

void main();
