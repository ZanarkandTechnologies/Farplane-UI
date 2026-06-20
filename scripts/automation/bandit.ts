import type {
  ActionArm,
  AutomationActionKind,
  AutomationContext,
  AutomationPolicy,
  BanditState,
  RewardRecord,
} from "./types.js";

export type ActionChoice = {
  arm: ActionArm;
  mode: "explore" | "exploit" | "forced";
  reason: string;
  score: number;
};

export function chooseAction(input: {
  policy: AutomationPolicy;
  arms: ActionArm[];
  state: BanditState;
  context: AutomationContext;
}): ActionChoice {
  const allowed = input.arms.filter((arm) => input.policy.allowedActions.includes(arm.id));
  if (allowed.length === 0) {
    throw new Error("automation_no_allowed_actions");
  }

  const forced = forcedAction(input.policy, input.context, allowed);
  if (forced) return forced;

  const totalPulls =
    Object.values(input.state.arms).reduce((sum, stats) => sum + Math.max(0, stats.pulls), 0) || 1;
  const scored = allowed.map((arm) => {
    const stats = input.state.arms[arm.id] ?? { pulls: 0, totalReward: 0 };
    const mean = stats.pulls > 0 ? stats.totalReward / stats.pulls : 0;
    const exploration = Math.sqrt((2 * Math.log(totalPulls + 1)) / (stats.pulls + 1));
    const score = mean + exploration + arm.baseWeight + contextBoost(arm.id, input.context);
    return { arm, stats, score };
  });
  scored.sort((a, b) => b.score - a.score || a.arm.id.localeCompare(b.arm.id));
  const winner = scored[0];
  if (!winner) throw new Error("automation_no_scored_action");
  return {
    arm: winner.arm,
    mode: winner.stats.pulls === 0 ? "explore" : "exploit",
    reason:
      winner.stats.pulls === 0
        ? `Explore unsampled action ${winner.arm.id}.`
        : `Exploit highest current UCB score for ${winner.arm.id}.`,
    score: Number(winner.score.toFixed(4)),
  };
}

function forcedAction(
  policy: AutomationPolicy,
  context: AutomationContext,
  arms: ActionArm[],
): ActionChoice | undefined {
  const find = (id: AutomationActionKind) => arms.find((arm) => arm.id === id);
  if (context.unreconciledThreadCount >= policy.forcedActions.maxUnreconciledThreads) {
    const arm = find("reward_update");
    if (arm) {
      return {
        arm,
        mode: "forced",
        reason: `Forced reward_update because ${context.unreconciledThreadCount} spawned threads need reconciliation.`,
        score: Number.POSITIVE_INFINITY,
      };
    }
  }
  if (isOlderThanHours(context.latestMetricSnapshotAt, policy.forcedActions.metricSnapshotMaxAgeHours)) {
    const arm = find("metric_snapshot");
    if (arm) {
      return {
        arm,
        mode: "forced",
        reason: `Forced metric_snapshot because latest metrics are older than ${policy.forcedActions.metricSnapshotMaxAgeHours}h.`,
        score: Number.POSITIVE_INFINITY,
      };
    }
  }
  if (isOlderThanDays(context.latestWeeklyReflectionAt, policy.forcedActions.weeklyReflectionMaxAgeDays)) {
    const arm = find("weekly_reflection");
    if (arm) {
      return {
        arm,
        mode: "forced",
        reason: `Forced weekly_reflection because latest reflection is older than ${policy.forcedActions.weeklyReflectionMaxAgeDays}d.`,
        score: Number.POSITIVE_INFINITY,
      };
    }
  }
  return undefined;
}

function isOlderThanHours(iso: string | undefined, hours: number): boolean {
  if (!iso) return false;
  return Date.now() - Date.parse(iso) > hours * 60 * 60 * 1000;
}

function isOlderThanDays(iso: string | undefined, days: number): boolean {
  if (!iso) return false;
  return Date.now() - Date.parse(iso) > days * 24 * 60 * 60 * 1000;
}

function contextBoost(actionId: AutomationActionKind, context: AutomationContext): number {
  if (actionId === "ticket_execution" && context.openTicketCount > 0) return 0.35;
  if (actionId === "planning" && context.staleTicketCount > 3) return 0.25;
  if (actionId === "reward_update" && context.unreconciledThreadCount > 0) return 0.2;
  if (actionId === "growth_research" && context.recentDecisionCount > 0) return 0.1;
  return 0;
}

export function applyRewardsToBandit(
  state: BanditState,
  rewards: RewardRecord[],
  nowIso: string,
): BanditState {
  const next: BanditState = {
    version: 1,
    updatedAt: nowIso,
    arms: { ...state.arms },
    rewardedSnapshotIds: [...state.rewardedSnapshotIds],
  };
  for (const reward of rewards) {
    const stats = next.arms[reward.actionId] ?? { pulls: 0, totalReward: 0 };
    next.arms[reward.actionId] = {
      pulls: stats.pulls + 1,
      totalReward: Number((stats.totalReward + reward.reward).toFixed(4)),
      lastSelectedAt: stats.lastSelectedAt,
    };
    if (reward.snapshotId && !next.rewardedSnapshotIds.includes(reward.snapshotId)) {
      next.rewardedSnapshotIds.push(reward.snapshotId);
    }
  }
  return next;
}

export function recordSelectedArm(
  state: BanditState,
  actionId: AutomationActionKind,
  nowIso: string,
): BanditState {
  const stats = state.arms[actionId] ?? { pulls: 0, totalReward: 0 };
  return {
    ...state,
    updatedAt: nowIso,
    arms: {
      ...state.arms,
      [actionId]: {
        ...stats,
        lastSelectedAt: nowIso,
      },
    },
  };
}
