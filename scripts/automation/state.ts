import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ActionArm,
  ActionOutcomeRecord,
  AutomationActionKind,
  AutomationPolicy,
  BanditState,
  DecisionRecord,
  MetricSnapshot,
  RewardRecord,
  SpawnedThreadRecord,
} from "./types.js";

export type AutomationPaths = {
  root: string;
  dir: string;
  policy: string;
  actionArms: string;
  banditState: string;
  decisions: string;
  spawnedThreads: string;
  actionOutcomes: string;
  rewards: string;
  metricSnapshots: string;
  reflectionLatest: string;
};

export function automationPaths(projectRoot: string): AutomationPaths {
  const root = path.resolve(projectRoot);
  const dir = path.join(root, ".farplane", "automation");
  return {
    root,
    dir,
    policy: path.join(dir, "heartbeat-policy.json"),
    actionArms: path.join(dir, "action-arms.json"),
    banditState: path.join(dir, "bandit-state.json"),
    decisions: path.join(dir, "decisions.jsonl"),
    spawnedThreads: path.join(dir, "spawned-threads.jsonl"),
    actionOutcomes: path.join(dir, "action-outcomes.jsonl"),
    rewards: path.join(dir, "rewards.jsonl"),
    metricSnapshots: path.join(dir, "metric-snapshots.jsonl"),
    reflectionLatest: path.join(dir, "reflections", "latest.md"),
  };
}

export function defaultPolicy(automationId: string): AutomationPolicy {
  return {
    version: 1,
    automationId,
    enabled: true,
    cadenceMinutes: 30,
    maxSpawnedThreadsPerBeat: 1,
    maxOpenSpawnedThreads: 5,
    allowedActions: [
      "ticket_execution",
      "planning",
      "growth_research",
      "skill_hardening",
      "eval_writing",
      "qa_app",
      "automation_building",
      "reward_update",
    ],
    gates: [
      "no_push",
      "no_deploy",
      "no_publish",
      "no_spend",
      "no_account_changes",
      "no_destructive_cleanup",
    ],
    forcedActions: {
      metricSnapshotMaxAgeHours: 24,
      weeklyReflectionMaxAgeDays: 7,
      maxUnreconciledThreads: 5,
    },
    rewardConfig: {
      primaryMetric: "profit",
      dailyMetrics: ["views", "subscribers", "qualified_replies"],
      weeklyMetrics: ["profit", "paid_users", "retention"],
      dailyWeight: 0.35,
      weeklyWeight: 0.65,
      immediateWeight: 0.25,
    },
  };
}

export function defaultActionArms(): ActionArm[] {
  return [
    arm("ticket_execution", "Pick and advance one ready ticket", 0.9, "immediate"),
    arm("planning", "Improve strategy, roadmap, or ticket shape", 0.75, "daily_weekly"),
    arm("growth_research", "Find or sharpen a user acquisition experiment", 0.8, "daily_weekly"),
    arm("skill_hardening", "Improve a skill with guardrails or tests", 0.65, "weekly"),
    arm("eval_writing", "Write or improve an eval/proof workflow", 0.6, "weekly"),
    arm("qa_app", "QA a product workflow and capture evidence", 0.55, "immediate"),
    arm("automation_building", "Identify or improve repeatable automation", 0.65, "weekly"),
    arm("reward_update", "Reconcile metrics and rewards without spawning product work", 0.4, "immediate"),
    arm("metric_snapshot", "Capture fresh metric snapshots for future rewards", 0.3, "daily"),
    arm("weekly_reflection", "Run a weekly strategy reflection from recent outcomes", 0.5, "weekly"),
  ];
}

function arm(
  id: AutomationActionKind,
  description: string,
  baseWeight: number,
  expectedRewardHorizon: ActionArm["expectedRewardHorizon"],
): ActionArm {
  return {
    id,
    label: id.replace(/_/g, " "),
    description,
    baseWeight,
    expectedRewardHorizon,
    prompt: description,
    expectedOutputs: [
      ".farplane/reports",
      "tickets",
      "docs",
      ".farplane/automation",
    ],
  };
}

export async function ensureAutomationDir(paths: AutomationPaths): Promise<void> {
  await mkdir(paths.dir, { recursive: true });
  await mkdir(path.dirname(paths.reflectionLatest), { recursive: true });
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

export async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(filePath, "utf-8");
  } catch {
    existing = "";
  }
  await writeFile(filePath, `${existing}${JSON.stringify(value)}\n`, "utf-8");
}

export async function loadPolicy(paths: AutomationPaths, automationId: string): Promise<AutomationPolicy> {
  const policy = await readJsonFile(paths.policy, defaultPolicy(automationId));
  return { ...defaultPolicy(automationId), ...policy, automationId };
}

export async function loadActionArms(paths: AutomationPaths): Promise<ActionArm[]> {
  const configured = await readJsonFile<ActionArm[]>(paths.actionArms, defaultActionArms());
  return configured.length > 0 ? configured : defaultActionArms();
}

export async function loadBanditState(paths: AutomationPaths, nowIso: string): Promise<BanditState> {
  return readJsonFile<BanditState>(paths.banditState, {
    version: 1,
    updatedAt: nowIso,
    arms: {},
    rewardedSnapshotIds: [],
  });
}

export async function writeDefaultConfig(paths: AutomationPaths, automationId: string): Promise<void> {
  await ensureAutomationDir(paths);
  await writeJsonFile(paths.policy, defaultPolicy(automationId));
  await writeJsonFile(paths.actionArms, defaultActionArms());
}

export type AutomationLedger = {
  decisions: DecisionRecord[];
  spawnedThreads: SpawnedThreadRecord[];
  actionOutcomes: ActionOutcomeRecord[];
  rewards: RewardRecord[];
  metricSnapshots: MetricSnapshot[];
};

export async function loadLedger(paths: AutomationPaths): Promise<AutomationLedger> {
  return {
    decisions: await readJsonl<DecisionRecord>(paths.decisions),
    spawnedThreads: await readJsonl<SpawnedThreadRecord>(paths.spawnedThreads),
    actionOutcomes: await readJsonl<ActionOutcomeRecord>(paths.actionOutcomes),
    rewards: await readJsonl<RewardRecord>(paths.rewards),
    metricSnapshots: await readJsonl<MetricSnapshot>(paths.metricSnapshots),
  };
}
