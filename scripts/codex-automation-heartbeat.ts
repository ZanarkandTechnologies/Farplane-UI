#!/usr/bin/env node

import path from "node:path";
import { readFarplaneConfigValue } from "../cli/runtime-config.js";
import { applyRewardsToBandit } from "./automation/bandit.js";
import { runHeartbeat } from "./automation/heartbeat.js";
import { automationPaths, loadBanditState, loadLedger, writeDefaultConfig, writeJsonFile } from "./automation/state.js";

type Mode = "run" | "init" | "rewards-update";

type Args = {
  mode: Mode;
  automationId: string;
  projectRoot: string;
  dryRun: boolean;
  stateBase?: string;
  json: boolean;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = resolveProjectRoot(args.projectRoot);
  if (args.mode === "init") {
    const paths = automationPaths(projectRoot);
    await writeDefaultConfig(paths, args.automationId);
    print(args.json, { ok: true, automationId: args.automationId, dir: paths.dir }, `Initialized ${paths.dir}`);
    return;
  }

  if (args.mode === "rewards-update") {
    const paths = automationPaths(projectRoot);
    const nowIso = new Date().toISOString();
    const ledger = await loadLedger(paths);
    const state = await loadBanditState(paths, nowIso);
    const unapplied = ledger.rewards.filter(
      (reward) => reward.snapshotId && !state.rewardedSnapshotIds.includes(reward.snapshotId),
    );
    const next = applyRewardsToBandit(state, unapplied, nowIso);
    await writeJsonFile(paths.banditState, next);
    print(args.json, { ok: true, applied: unapplied.length, banditState: next }, `Applied ${unapplied.length} reward(s)`);
    return;
  }

  const result = await runHeartbeat({
    projectRoot,
    automationId: args.automationId,
    dryRun: args.dryRun,
    stateBase: args.stateBase,
  });
  print(args.json, result, `${result.decision.actionId} (${result.decision.mode}): ${result.decision.reason}`);
}

function parseArgs(argv: string[]): Args {
  let mode: Mode = "run";
  let automationId = process.env.FARPLANE_AUTOMATION_ID || "farplane-ui-founder-heartbeat";
  let projectRoot = process.env.FARPLANE_PROJECT_ROOT || ".";
  let dryRun = false;
  let stateBase = readFarplaneConfigValue("FARPLANE_STATE_BASE");
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "init" || arg === "run" || arg === "rewards-update") {
      mode = arg;
    } else if (arg === "--automation-id" && next) {
      automationId = next;
      index += 1;
    } else if (arg === "--project-root" && next) {
      projectRoot = next;
      index += 1;
    } else if (arg === "--state-base" && next) {
      stateBase = next;
      index += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { mode, automationId, projectRoot, dryRun, stateBase, json };
}

function resolveProjectRoot(projectRoot: string): string {
  if (path.isAbsolute(projectRoot)) return projectRoot;
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), projectRoot);
}

function print(json: boolean, payload: unknown, text: string): void {
  console.log(json ? JSON.stringify(payload, null, 2) : text);
}

function printHelp(): void {
  console.log(`Usage:
  npx tsx scripts/codex-automation-heartbeat.ts [run] --project-root . --automation-id farplane-ui-founder-heartbeat [--dry-run] [--json]
  npx tsx scripts/codex-automation-heartbeat.ts init --project-root . --automation-id farplane-ui-founder-heartbeat
  npx tsx scripts/codex-automation-heartbeat.ts rewards-update --project-root . --automation-id farplane-ui-founder-heartbeat
`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
