#!/usr/bin/env tsx
/**
 * Entrypoint for the Codex PostToolUse skill invocation listener.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSkillInvocationsFromStdin,
  publishSkillInvocations,
  resolveDefaultEndpointBaseUrl,
  resolveDefaultTelemetryToken,
} from "./handler";
import { readFarplaneConfigValue } from "../../cli/runtime-config";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const debugEnabled = readFarplaneConfigValue("FARPLANE_SKILL_HOOK_DEBUG") === "1";
  const stdin = await readStdin();
  const candidates = parseSkillInvocationsFromStdin(stdin);
  if (candidates.length === 0) {
    if (debugEnabled) console.error("[skill-invocation-listener] no skill reads detected");
    return;
  }
  try {
    const searchDirs = [
      repoRoot,
      process.cwd(),
      ...candidates
        .map((candidate) => candidate.projectPath)
        .filter((value): value is string => Boolean(value)),
    ];
    const result = await publishSkillInvocations(candidates, {
      endpointBaseUrl: resolveDefaultEndpointBaseUrl(process.env, searchDirs),
      telemetryToken: resolveDefaultTelemetryToken(process.env, searchDirs),
    });
    if (debugEnabled) {
      console.error(
        `[skill-invocation-listener] candidates=${result.attempted} published=${result.published} skipped=${result.skipped}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[skill-invocation-listener] ${message}`);
  }
}

void main();
