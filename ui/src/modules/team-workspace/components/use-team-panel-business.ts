"use client";

/**
 * TEAM PANEL BUSINESS STATE
 * =========================
 * Purpose
 * - Keep Team Panel ledger orchestration out of the panel shell.
 *
 * KEY CONCEPTS:
 * - Ledger writes flow through the adapter and remain project-local.
 *
 * USAGE:
 * - Call from TeamPanel with resolved project/team context and refresh callback.
 *
 * MEMORY REFERENCES:
 * - MEM-0197
 * - MEM-0206
 */

import { useMemo, useState } from "react";
import type {
  ProjectAccountEventModel,
  ProjectAccountModel,
  ProjectModel,
} from "@/modules/runtime";
import type { OpenClawAdapter } from "@/modules/runtime";

type LedgerEntryLike = {
  id: string;
  projectId: string;
  timestamp: string;
  type: "revenue" | "cost";
  amount: number;
  source: string;
  description: string;
};

type ProjectLike = (ProjectModel & {
  ledger?: LedgerEntryLike[];
  account?: ProjectAccountModel;
  accountEvents?: ProjectAccountEventModel[];
}) | null;

interface UseTeamPanelBusinessStateInput {
  adapter: OpenClawAdapter;
  refresh: () => Promise<void>;
  project: ProjectLike;
}

interface ActionState {
  pending: boolean;
  error?: string;
  ok?: string;
}

export function useTeamPanelBusinessState({
  adapter,
  refresh,
  project,
}: UseTeamPanelBusinessStateInput): {
  ledgerActionState: ActionState;
  hasBusinessConfig: boolean;
  accountEvents: ProjectAccountEventModel[];
  teamAccount: ProjectAccountModel;
  handleRecordAccountEvent: (input: {
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
  }) => Promise<void>;
} {
  const [ledgerActionState, setLedgerActionState] = useState<ActionState>({ pending: false });

  const hasBusinessConfig = Boolean(project?.businessConfig);

  const accountEvents = useMemo<ProjectAccountEventModel[]>(() => {
    if (project?.accountEvents?.length) return project.accountEvents;
    const ledgerRows = [...(project?.ledger ?? [])].sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
    );
    let running = 0;
    return ledgerRows.map((entry) => {
      running += entry.type === "revenue" ? entry.amount : -entry.amount;
      return {
        id: `ledger-derived-${entry.id}`,
        projectId: entry.projectId,
        accountId: `${entry.projectId}:account`,
        timestamp: entry.timestamp,
        type: (entry.type === "revenue" ? "credit" : "debit") as "credit" | "debit",
        amountCents: entry.amount,
        source: entry.source,
        note: entry.description,
        balanceAfterCents: running,
      };
    });
  }, [project?.accountEvents, project?.ledger]);

  const teamAccount = useMemo<ProjectAccountModel>(() => {
    if (project?.account) return project.account;
    const latest = accountEvents[accountEvents.length - 1];
    return {
      id: `${project?.id ?? "project"}:account`,
      projectId: project?.id ?? "project",
      currency: "USD",
      balanceCents: latest?.balanceAfterCents ?? 0,
      updatedAt: latest?.timestamp ?? new Date().toISOString(),
    };
  }, [accountEvents, project?.account, project?.id]);

  async function handleRecordAccountEvent(input: {
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
  }): Promise<void> {
    if (!project?.id) return;
    setLedgerActionState({ pending: true });
    const result = await adapter.recordProjectAccountEvent({
      projectId: project.id,
      type: input.type,
      amountCents: input.amountCents,
      source: input.source,
      note: input.note,
      currency: teamAccount.currency,
    });
    if (!result.ok) {
      setLedgerActionState({ pending: false, error: result.error ?? "ledger_update_failed" });
      return;
    }
    await refresh();
    setLedgerActionState({
      pending: false,
      ok: input.type === "credit" ? "Funding recorded." : "Spend recorded.",
    });
  }

  return {
    ledgerActionState,
    hasBusinessConfig,
    accountEvents,
    teamAccount,
    handleRecordAccountEvent,
  };
}
