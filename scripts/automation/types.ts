export type AutomationActionKind =
  | "ticket_execution"
  | "planning"
  | "growth_research"
  | "skill_hardening"
  | "eval_writing"
  | "qa_app"
  | "automation_building"
  | "reward_update"
  | "metric_snapshot"
  | "weekly_reflection";

export type AutomationPolicy = {
  version: 1;
  automationId: string;
  enabled: boolean;
  cadenceMinutes: number;
  maxSpawnedThreadsPerBeat: number;
  maxOpenSpawnedThreads: number;
  allowedActions: AutomationActionKind[];
  gates: string[];
  forcedActions: {
    metricSnapshotMaxAgeHours: number;
    weeklyReflectionMaxAgeDays: number;
    maxUnreconciledThreads: number;
  };
  rewardConfig: {
    primaryMetric: string;
    dailyMetrics: string[];
    weeklyMetrics: string[];
    dailyWeight: number;
    weeklyWeight: number;
    immediateWeight: number;
  };
};

export type ActionArm = {
  id: AutomationActionKind;
  label: string;
  description: string;
  baseWeight: number;
  expectedRewardHorizon: "immediate" | "daily" | "weekly" | "daily_weekly";
  prompt: string;
  expectedOutputs: string[];
};

export type ArmStats = {
  pulls: number;
  totalReward: number;
  lastSelectedAt?: string;
};

export type BanditState = {
  version: 1;
  updatedAt: string;
  arms: Record<string, ArmStats>;
  rewardedSnapshotIds: string[];
};

export type AutomationContext = {
  projectRoot: string;
  automationId: string;
  nowIso: string;
  openTicketCount: number;
  staleTicketCount: number;
  recentDecisionCount: number;
  openSpawnedThreadCount: number;
  unreconciledThreadCount: number;
  latestMetricSnapshotAt?: string;
  latestWeeklyReflectionAt?: string;
  lastActionId?: string;
};

export type DecisionRecord = {
  decisionId: string;
  automationId: string;
  actionId: AutomationActionKind;
  mode: "explore" | "exploit" | "forced";
  reason: string;
  score: number;
  context: AutomationContext;
  expectedRewardHorizon: ActionArm["expectedRewardHorizon"];
  expectedOutputs: string[];
  promptHash: string;
  createdAt: string;
  dryRun: boolean;
  spawnedThreadId?: string;
};

export type SpawnedThreadRecord = {
  decisionId: string;
  automationId: string;
  actionId: AutomationActionKind;
  threadId?: string;
  threadName: string;
  promptHash: string;
  status: "preview" | "spawned" | "completed" | "partial" | "blocked" | "no_signal" | "still_running";
  expectedOutputs: string[];
  startedAt: string;
  updatedAt: string;
  dryRun: boolean;
  error?: string;
};

export type ActionOutcomeRecord = {
  decisionId: string;
  automationId: string;
  actionId: AutomationActionKind;
  outcome: SpawnedThreadRecord["status"];
  reward: number;
  reason: string;
  observedOutputs: string[];
  occurredAt: string;
};

export type MetricSnapshot = {
  id: string;
  capturedAt: string;
  horizon: "daily" | "weekly" | "immediate";
  actionId?: AutomationActionKind;
  decisionId?: string;
  reward?: number;
  metrics?: Record<string, number>;
};

export type RewardRecord = {
  rewardId: string;
  automationId: string;
  actionId: AutomationActionKind;
  decisionId?: string;
  source: "outcome" | "metric_snapshot";
  horizon: MetricSnapshot["horizon"];
  reward: number;
  snapshotId?: string;
  reason: string;
  occurredAt: string;
};

export type HeartbeatRunResult = {
  ok: true;
  dryRun: boolean;
  decision: DecisionRecord;
  thread: SpawnedThreadRecord;
  reflectionPath: string;
  rewardsApplied: RewardRecord[];
  outcomes: ActionOutcomeRecord[];
};
