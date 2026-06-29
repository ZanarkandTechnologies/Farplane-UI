#!/usr/bin/env tsx
/**
 * Entrypoint for the Codex PostToolUse tracked file-change listener.
 */
import {
  parseFarplaneFileEventCandidatesFromStdin,
  parseFileChangeBubbleCandidatesFromStdin,
  publishFarplaneFileEventCandidates,
  publishFileChangeBubbleCandidates,
} from "./handler";
import { resolveCodexSummaryOptions } from "../shared/codex-summary";
import {
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "../skill-invocation-listener/handler";
import { resolveProjectHookConfig } from "../shared/project-hook-config";
import { readFarplaneConfigValue } from "../../cli/runtime-config";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const debugEnabled = readFarplaneConfigValue("FARPLANE_FILE_CHANGE_HOOK_DEBUG") === "1";
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
  const parseOptions = {
    trackedPathPatterns: hookConfig.patterns,
    codexSummary: resolveCodexSummaryOptions(process.env),
  };
  const fileEventCandidates = parseFarplaneFileEventCandidatesFromStdin(stdin, Date.now(), parseOptions);
  const candidates = await parseFileChangeBubbleCandidatesFromStdin(stdin, Date.now(), parseOptions);
  if (candidates.length === 0 && fileEventCandidates.length === 0) {
    if (debugEnabled) console.error("[file-change-listener] no tracked file changes detected");
    return;
  }
  try {
    const searchDirs = [
      process.cwd(),
      ...fileEventCandidates.map((candidate) => candidate.projectPath),
      ...candidates.map((candidate) => candidate.projectPath),
    ];
    const endpointBaseUrl = resolveDefaultEndpointBaseUrl(process.env, searchDirs);
    const telemetryToken = resolveDefaultTelemetryToken(process.env, searchDirs);
    const eventResult = await publishFarplaneFileEventCandidates(fileEventCandidates, {
      endpointBaseUrl,
      telemetryToken,
    });
    const result = await publishFileChangeBubbleCandidates(candidates, {
      endpointBaseUrl,
      telemetryToken,
    });
    if (debugEnabled) {
      console.error(
        `[file-change-listener] fileEvents=${eventResult.attempted}/${eventResult.published} summaries=${result.attempted}/${result.published}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[file-change-listener] ${message}`);
  }
}

void main();
