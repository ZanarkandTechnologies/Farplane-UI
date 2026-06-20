import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyRewardsToBandit, chooseAction, recordSelectedArm } from "./bandit.js";
import { spawnCodexThread } from "./codex-spawn.js";
import {
  appendJsonl,
  automationPaths,
  ensureAutomationDir,
  loadActionArms,
  loadBanditState,
  loadLedger,
  loadPolicy,
  writeJsonFile,
} from "./state.js";
import type {
  ActionOutcomeRecord,
  AutomationActionKind,
  AutomationContext,
  DecisionRecord,
  HeartbeatRunResult,
  MetricSnapshot,
  RewardRecord,
  SpawnedThreadRecord,
} from "./types.js";

export type RunHeartbeatOptions = {
  projectRoot: string;
  automationId: string;
  dryRun?: boolean;
  stateBase?: string;
  now?: Date;
  spawnImpl?: typeof spawnCodexThread;
};

export async function runHeartbeat(options: RunHeartbeatOptions): Promise<HeartbeatRunResult> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const paths = automationPaths(options.projectRoot);
  await ensureAutomationDir(paths);

  const policy = await loadPolicy(paths, options.automationId);
  if (!policy.enabled) {
    throw new Error(`automation_disabled:${policy.automationId}`);
  }
  const arms = await loadActionArms(paths);
  const ledger = await loadLedger(paths);
  const bandit = await loadBanditState(paths, nowIso);
  const context = await buildContext({
    projectRoot: paths.root,
    automationId: policy.automationId,
    nowIso,
    decisions: ledger.decisions,
    spawnedThreads: ledger.spawnedThreads,
    metricSnapshots: ledger.metricSnapshots,
  });

  const outcomes = await reconcileThreads(paths.root, policy.automationId, ledger.spawnedThreads, nowIso);
  const outcomeRewards = outcomes.map((outcome): RewardRecord => ({
    rewardId: `reward-${outcome.decisionId}-${outcome.occurredAt}`,
    automationId: outcome.automationId,
    actionId: outcome.actionId,
    decisionId: outcome.decisionId,
    source: "outcome",
    horizon: "immediate",
    reward: outcome.reward,
    reason: outcome.reason,
    occurredAt: outcome.occurredAt,
  }));
  const metricRewards = buildMetricRewards({
    automationId: policy.automationId,
    snapshots: ledger.metricSnapshots,
    decisions: ledger.decisions,
    rewardedSnapshotIds: bandit.rewardedSnapshotIds,
    nowIso,
  });
  const rewardsApplied = [...outcomeRewards, ...metricRewards];
  let nextBandit = applyRewardsToBandit(bandit, rewardsApplied, nowIso);

  const choice = chooseAction({ policy, arms, state: nextBandit, context });
  nextBandit = recordSelectedArm(nextBandit, choice.arm.id, nowIso);
  await writeJsonFile(paths.banditState, nextBandit);

  const reflection = buildReflection({ context, rewardsApplied, outcomes, selectedAction: choice.arm.id, reason: choice.reason });
  await writeFile(paths.reflectionLatest, reflection, "utf-8");

  const decisionId = `hb-${policy.automationId}-${nowIso.replace(/[:.]/g, "-")}`;
  const prompt = buildChildPrompt({
    actionId: choice.arm.id,
    description: choice.arm.description,
    projectRoot: paths.root,
    gates: policy.gates,
    expectedOutputs: choice.arm.expectedOutputs,
    reflection,
  });
  const promptHash = hashText(prompt);
  const threadName = `[Farplane] ${choice.arm.label}: ${nowIso.slice(0, 16)}`;
  const decision: DecisionRecord = {
    decisionId,
    automationId: policy.automationId,
    actionId: choice.arm.id,
    mode: choice.mode,
    reason: choice.reason,
    score: choice.score,
    context,
    expectedRewardHorizon: choice.arm.expectedRewardHorizon,
    expectedOutputs: choice.arm.expectedOutputs,
    promptHash,
    createdAt: nowIso,
    dryRun: Boolean(options.dryRun),
  };

  let thread: SpawnedThreadRecord = {
    decisionId,
    automationId: policy.automationId,
    actionId: choice.arm.id,
    threadName,
    promptHash,
    status: options.dryRun ? "preview" : "spawned",
    expectedOutputs: choice.arm.expectedOutputs,
    startedAt: nowIso,
    updatedAt: nowIso,
    dryRun: Boolean(options.dryRun),
  };

  if (!options.dryRun) {
    const stateBase = options.stateBase ?? process.env.FARPLANE_STATE_BASE ?? process.env.CODEX_STATE_BASE;
    if (!stateBase) throw new Error("codex_state_base_missing:pass_--state-base_or_set_FARPLANE_STATE_BASE");
    const spawned = await (options.spawnImpl ?? spawnCodexThread)({
      stateBase,
      cwd: paths.root,
      threadName,
      prompt,
    });
    decision.spawnedThreadId = spawned.threadId;
    thread = { ...thread, threadId: spawned.threadId };
  }

  await appendJsonl(paths.decisions, decision);
  await appendJsonl(paths.spawnedThreads, thread);
  for (const outcome of outcomes) await appendJsonl(paths.actionOutcomes, outcome);
  for (const reward of rewardsApplied) await appendJsonl(paths.rewards, reward);

  return {
    ok: true,
    dryRun: Boolean(options.dryRun),
    decision,
    thread,
    reflectionPath: paths.reflectionLatest,
    rewardsApplied,
    outcomes,
  };
}

async function buildContext(input: {
  projectRoot: string;
  automationId: string;
  nowIso: string;
  decisions: Array<{ actionId: string; createdAt: string }>;
  spawnedThreads: SpawnedThreadRecord[];
  metricSnapshots: MetricSnapshot[];
}): Promise<AutomationContext> {
  const tickets = await readTicketFiles(path.join(input.projectRoot, "tickets"));
  const openTicketCount = tickets.filter((ticket) => !/\bstatus:\s*done\b/i.test(ticket)).length;
  const staleTicketCount = tickets.filter((ticket) => /last_verification:\s*not run/i.test(ticket)).length;
  const openSpawned = input.spawnedThreads.filter((row) => row.status === "spawned" || row.status === "still_running");
  const latestMetric = latestIso(input.metricSnapshots.map((snapshot) => snapshot.capturedAt));
  const latestWeekly = latestIso(
    input.decisions
      .filter((decision) => decision.actionId === "weekly_reflection")
      .map((decision) => decision.createdAt),
  );
  const lastDecision = [...input.decisions].reverse()[0];
  return {
    projectRoot: input.projectRoot,
    automationId: input.automationId,
    nowIso: input.nowIso,
    openTicketCount,
    staleTicketCount,
    recentDecisionCount: input.decisions.length,
    openSpawnedThreadCount: openSpawned.length,
    unreconciledThreadCount: openSpawned.length,
    latestMetricSnapshotAt: latestMetric,
    latestWeeklyReflectionAt: latestWeekly,
    lastActionId: lastDecision?.actionId,
  };
}

async function readTicketFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const chunks = await Promise.all(
      entries.map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return readTicketFiles(full);
        if (!entry.name.endsWith(".md")) return [];
        try {
          return [await readFile(full, "utf-8")];
        } catch {
          return [];
        }
      }),
    );
    return chunks.flat();
  } catch {
    return [];
  }
}

async function reconcileThreads(
  projectRoot: string,
  automationId: string,
  threads: SpawnedThreadRecord[],
  nowIso: string,
): Promise<ActionOutcomeRecord[]> {
  const outcomes: ActionOutcomeRecord[] = [];
  for (const thread of threads) {
    if (thread.status !== "spawned" && thread.status !== "still_running") continue;
    const observedOutputs: string[] = [];
    for (const output of thread.expectedOutputs) {
      const target = path.resolve(projectRoot, output);
      try {
        const info = await stat(target);
        if (info.mtimeMs >= Date.parse(thread.startedAt)) observedOutputs.push(output);
      } catch {
        // Missing outputs are no signal, not an error.
      }
    }
    if (observedOutputs.length === 0) continue;
    outcomes.push({
      decisionId: thread.decisionId,
      automationId,
      actionId: thread.actionId,
      outcome: "partial",
      reward: 0.25,
      reason: `Observed changed expected output path(s): ${observedOutputs.join(", ")}`,
      observedOutputs,
      occurredAt: nowIso,
    });
  }
  return outcomes;
}

function buildMetricRewards(input: {
  automationId: string;
  snapshots: MetricSnapshot[];
  decisions: DecisionRecord[];
  rewardedSnapshotIds: string[];
  nowIso: string;
}): RewardRecord[] {
  const rewards: RewardRecord[] = [];
  for (const snapshot of input.snapshots) {
    if (input.rewardedSnapshotIds.includes(snapshot.id)) continue;
    const actionId = snapshot.actionId ?? [...input.decisions].reverse()[0]?.actionId;
    if (!actionId) continue;
    rewards.push({
      rewardId: `reward-${snapshot.id}`,
      automationId: input.automationId,
      actionId,
      decisionId: snapshot.decisionId,
      source: "metric_snapshot",
      horizon: snapshot.horizon,
      reward: scoreSnapshot(snapshot),
      snapshotId: snapshot.id,
      reason: `Applied ${snapshot.horizon} metric snapshot ${snapshot.id}.`,
      occurredAt: input.nowIso,
    });
  }
  return rewards;
}

function scoreSnapshot(snapshot: MetricSnapshot): number {
  if (typeof snapshot.reward === "number" && Number.isFinite(snapshot.reward)) return snapshot.reward;
  const values = Object.values(snapshot.metrics ?? {}).filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  const raw = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(Math.max(-1, Math.min(1, raw)).toFixed(4));
}

function buildReflection(input: {
  context: AutomationContext;
  rewardsApplied: RewardRecord[];
  outcomes: ActionOutcomeRecord[];
  selectedAction: AutomationActionKind;
  reason: string;
}): string {
  return [
    "# Automation Reflection",
    "",
    `Updated: ${input.context.nowIso}`,
    `Selected action: ${input.selectedAction}`,
    `Reason: ${input.reason}`,
    "",
    `Open tickets: ${input.context.openTicketCount}`,
    `Open spawned threads: ${input.context.openSpawnedThreadCount}`,
    `Rewards applied this beat: ${input.rewardsApplied.length}`,
    `Outcomes reconciled this beat: ${input.outcomes.length}`,
    "",
  ].join("\n");
}

function buildChildPrompt(input: {
  actionId: AutomationActionKind;
  description: string;
  projectRoot: string;
  gates: string[];
  expectedOutputs: string[];
  reflection: string;
}): string {
  return [
    "You are a child Codex thread spawned by the Farplane automation heartbeat.",
    "",
    `Action: ${input.actionId}`,
    `Objective: ${input.description}`,
    `Project root: ${input.projectRoot}`,
    "",
    "Recent reflection:",
    input.reflection,
    "Gates:",
    ...input.gates.map((gate) => `- ${gate}`),
    "",
    "Expected outputs:",
    ...input.expectedOutputs.map((output) => `- ${output}`),
    "",
    "Work boundedly. Write useful local artifacts or ticket progress. Do not rely on farplane status.",
  ].join("\n");
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
